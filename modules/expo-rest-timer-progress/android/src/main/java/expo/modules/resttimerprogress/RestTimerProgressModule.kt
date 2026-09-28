package expo.modules.resttimerprogress

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Build
import android.os.SystemClock
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * RestTimerProgress — 本地 expo-module
 *
 * 用 NotificationCompat.Builder.setProgress() 让系统渲染通知栏进度条,
 * 而不是在 body 字符串里手画 unicode 块字符。
 *
 * 三个 JS 调用:
 *   - ensureChannel() : 建/复用 "rest_timer" channel (HIGH importance, silent, vibrate)
 *   - show(rem, total, title, colorHex) : 把权威状态交给 [RestTimerTickerService]
 *     (**不直接渲染** —— 见下"渲染入口唯一")
 *   - dismiss() : 停服务 + cancel notification + 取消闹钟
 *
 * **渲染入口唯一(2026-09-28 改)**:真正的每秒重画在 [RestTimerTickerService]
 * 里。本模块只负责组装通知([build])、排到点闹钟、以及把 JS 推来的权威状态
 * 转交给服务。为什么不让 JS 继续每秒渲染:退后台后 JS 停摆,进度条会冻住
 * (详见下面"后台冻结修复"第 3 条),所以必须由原生进程内的 ticker 接管。
 *
 * 渲染方式(2026-09-20 改):内容区自绘 RemoteViews + DecoratedCustomViewStyle。
 *   - 系统头部(图标 / 应用名 / 时间 / 圆角卡片)保留,观感与其他通知一致
 *   - 内容区是一行「动作名 + 倒计时」+ 进度条 —— 原来的 "倒计时中" body 行删掉
 *   - 收起态与展开态**传同一个 RemoteViews**:点开箭头不会多出任何内容
 *   - 进度条用主题色着色(setProgressTintList):系统模板的进度条固定吃
 *     Material You 强调色,`.color` 只影响图标底色,所以必须自绘才跟得上主题
 *
 * 后台冻结修复(2026-09-22 起,2026-09-28 补全):
 *   退后台后 RN 的 JS 定时器不再触发(App 进程也会被 Android 的 cached-apps
 *   freezer 冻结),原来靠每秒 `show()` 推进的一切全部停摆 —— 通知定格在
 *   最后一帧,数字是假的;而且"到点 dismiss + 震动"也一起失效,用户完全
 *   不知道休息何时结束。三个层面都在原生兜:
 *     1. 倒计时数字 → `Chronometer`(由 SystemUI 自绘自走,详见布局注释)
 *     2. 到点提醒   → `AlarmManager` + [RestTimerAlarmReceiver]
 *     3. 进度条     → [RestTimerTickerService](前台服务 + 原生 1s ticker)
 *
 *   **为什么第 3 条必须上前台服务**:进度条的值只能由 App 主动写
 *   (`RemoteViews.setProgressBar`),RemoteViews 里唯一会自走的控件是
 *   `Chronometer` —— 没有能自走的进度控件。所以第 1 条修完会出现一个
 *   自相矛盾的画面:**数字照走、进度条卡死**。2026-09-27 真机实测确认:
 *   App 退后台后数字从 00:49 正常走到 00:41,进度条却停在 ~99% 不动
 *   (真值应是 49/60=82%)。前台服务把每秒重画挪进原生进程,ticker 就不会停。
 *   代价是 targetSdk 34+ 需要声明 foregroundServiceType,见模块 AndroidManifest。
 *
 * 跟现有 expo-notifications 的 channel("rest_timer")同 id — 创建幂等,无冲突。
 */
class RestTimerProgressModule : Module() {
  companion object {
    const val CHANNEL_ID = "rest_timer"

    /**
     * 倒计时通知的固定 id。
     *
     * **三个写入方共用它,这是有意的**:[RestTimerTickerService](每秒重画)、
     * [RestTimerAlarmReceiver.handleRestExpired] 的「休息结束」、以及本模块的
     * dismiss。共用才能保证"同一时刻通知栏只有一条与休息有关的通知",
     * 不会出现冻结的「杠铃卧推 00:45」和「休息结束」并排显示。
     * 也因此 [RestTimerTickerService.onDestroy] 到点收尾时必须 DETACH 而非 REMOVE。
     */
    const val NOTIFICATION_ID = 1001

    /** 闹钟 PendingIntent 的 requestCode —— 跟通知 ID 分开命名空间,别混用。 */
    const val ALARM_REQUEST_CODE = 2001

    /**
     * 已排闹钟的到点时刻(elapsedRealtime ms);null = 没排。
     *
     * 用途是**去抖**:前台运行时 JS 每秒都会调 show(),如果每秒都重排闹钟
     * 纯属浪费。只有当新算出的到点时刻跟已排的差 > [ALARM_RESCHEDULE_TOLERANCE_MS]
     * 才重排 —— 这样"新一轮 / +15s / 跳过重开"会重排,而每秒的普通 tick 不会。
     */
    @Volatile var scheduledEndElapsedMs: Long? = null

    /** 允许的到点时刻漂移。1s 量化的 tick 抖动不会超这个值,但 +15s 一定超。 */
    private const val ALARM_RESCHEDULE_TOLERANCE_MS = 2000L

    /** SharedPreferences 名(alarm receiver 写 / JS consumeExpired 读)。 */
    private const val PREFS_NAME = "rest_timer_progress"

    /** receiver 唤起时写入的"已到点"时间戳(elapsedRealtime ms);0 = 未触发。 */
    private const val KEY_EXPIRED_AT = "expired_at_elapsed_ms"

    /**
     * 到点处理器([RestTimerAlarmReceiver.handleRestExpired])写 SP,
     * JS 端 `consumeExpired()` 读 + 清。
     * 用 SP 而不是静态字段:闹钟那条路径的 receiver 可能在 App 进程已被杀之后
     * 才被唤起,静态字段已随进程死。SP 持久化到磁盘,下次 App 启动仍能读到。
     *
     * 调用方必须用 applicationContext 拿 SharedPreferences —— receiver 的
     * context 可能是 Activity 上下文,receiver 路径走完就销毁,SP 跟着死。
     * 用 `apply()` 而非 `commit()`:见 [markExpired] 的说明。
     */
    private fun prefs(ctx: Context): SharedPreferences =
      ctx.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * [RestTimerAlarmReceiver] 在 `onReceive` 里调本方法,标记"闹钟已到点"。
     *
     * 为什么走 SP:receiver 可能被 Android 在 App 进程已被 cache/freeze 后唤起,
     * 静态字段已丢;且 receiver 走完即销毁,静态字段也活不下来。SP 是 receiver
     * 与 JS 端唯一可靠的跨进程通道。
     *
     * 用 `apply()` 而非 `commit()`:`BroadcastReceiver.onReceive` 必须在
     * 8-10 秒内返回,否则 ANR。`apply()` 异步落盘足够 —— JS 端 `consumeExpired`
     * 总在下次 App 进程启动 / 回前台时被调,中间几秒足够 SP 落盘。
     */
    @JvmStatic
    fun markExpired(ctx: Context) {
      prefs(ctx).edit()
        .putLong(KEY_EXPIRED_AT, SystemClock.elapsedRealtime())
        .apply()
    }

    /**
     * 内容区 RemoteViews:一行「动作名 + 倒计时」+ 主题色进度条。
     *
     * 收起态和展开态都返回这一份 —— 两者的视觉必须完全一致,
     * 展开后没有新内容可显示,这正是「不需要展开状态」的实现方式。
     */
    private fun contentView(
      ctx: Context,
      title: String,
      totalSec: Int,
      remainingSec: Int,
      colorHex: String?,
    ): RemoteViews {
      val rv = RemoteViews(ctx.packageName, R.layout.notification_rest_timer)
      rv.setTextViewText(R.id.rest_timer_title, title)

      // 倒计时交给 Chronometer 自绘:base 用 elapsedRealtime(跨进程一致的单调时钟),
      // 到点时刻取"未来" → countDown 模式下它自己往下走,归零即停在 00:00。
      // 关键是 SystemUI 负责刷新,App 进程冻不冻结都照走。
      rv.setChronometer(
        R.id.rest_timer_chrono,
        SystemClock.elapsedRealtime() + remainingSec * 1000L,
        null,
        true,
      )
      rv.setChronometerCountDown(R.id.rest_timer_chrono, true)

      rv.setProgressBar(R.id.rest_timer_progress, totalSec, remainingSec, false)

      val argb = colorHex?.let {
        try {
          Color.parseColor(it)
        } catch (_: IllegalArgumentException) {
          null // 颜色格式错就跳过,不让 JS 错破通知
        }
      }
      // setProgressTintList 收 ColorStateList(不是 int),RemoteViews 需要用
      // setColorStateList 走反射 —— 该重载 API 31 才有。更低版本退化为系统强调色。
      if (argb != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        rv.setColorStateList(
          R.id.rest_timer_progress,
          "setProgressTintList",
          ColorStateList.valueOf(argb),
        )
      }
      return rv
    }

    /**
     * 组装通知 —— **唯一的渲染入口**。
     *
     * 调用方是 [RestTimerTickerService.render](每个 tick 一次)。
     * `internal` 而非 `private`:service 在同 Gradle module 内的另一个文件里。
     */
    internal fun build(
      ctx: Context,
      title: String,
      totalSec: Int,
      remainingSec: Int,
      colorHex: String?,
    ): Notification {
      val content = contentView(ctx, title, totalSec, remainingSec, colorHex)
      val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_menu_recent_history)
        .setContentTitle(title) // 无障碍朗读 + 非装饰退化路径用;不再设 contentText
        .setOngoing(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        // Android 12+ 默认把"App 在前台时启动的前台服务通知"推迟 10s 才显示,
        // 避免一闪而过的通知。倒计时通知是要人看着走的,推迟等于没有 —— 关掉。
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        .setStyle(NotificationCompat.DecoratedCustomViewStyle())
        .setCustomContentView(content)
        .setCustomBigContentView(content) // 与收起态同一份 → 展开无新内容
      if (colorHex != null && colorHex.isNotBlank()) {
        try {
          builder.color = Color.parseColor(colorHex)
        } catch (_: IllegalArgumentException) {
          // 颜色格式错就跳过,不让 JS 错破通知
        }
      }
      return builder.build()
    }

    /** 构造闹钟用的 PendingIntent。extras 给 receiver 兜底(进程可能已被杀)。 */
    private fun alarmIntent(ctx: Context, title: String, colorHex: String?): PendingIntent {
      val intent = Intent(ctx, RestTimerAlarmReceiver::class.java).apply {
        action = RestTimerAlarmReceiver.ACTION_REST_DONE
        putExtra(RestTimerAlarmReceiver.EXTRA_TITLE, title)
        putExtra(RestTimerAlarmReceiver.EXTRA_COLOR_HEX, colorHex)
      }
      var flags = PendingIntent.FLAG_UPDATE_CURRENT // 重排时把 extras 一起刷新
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        flags = flags or PendingIntent.FLAG_IMMUTABLE
      }
      return PendingIntent.getBroadcast(ctx, ALARM_REQUEST_CODE, intent, flags)
    }

    /**
     * 排"休息到点"闹钟。已有闹钟且到点时刻跟新值几乎一致时跳过(去抖,见字段注释)。
     */
    private fun scheduleAlarm(ctx: Context, endElapsedMs: Long, title: String, colorHex: String?) {
      val existing = scheduledEndElapsedMs
      if (existing != null &&
        kotlin.math.abs(existing - endElapsedMs) <= ALARM_RESCHEDULE_TOLERANCE_MS
      ) {
        return
      }
      val am = ctx.getSystemService(AlarmManager::class.java) ?: return
      val pi = alarmIntent(ctx, title, colorHex)
      try {
        // Android 12+ 起 setExactAndAllowWhileIdle 需要 SCHEDULE_EXACT_ALARM;
        // targetSdk 33+ 时该权限默认不授予,要用户去系统设置里开。
        // 拿不到就降级到非精确闹钟 —— 平时误差秒级,只有进 Doze 才会明显延后。
        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
        if (canExact) {
          am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, endElapsedMs, pi)
        } else {
          am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, endElapsedMs, pi)
        }
        scheduledEndElapsedMs = endElapsedMs
      } catch (_: SecurityException) {
        // 部分 ROM 即便 canScheduleExactAlarms() 报了 true 仍会抛 —— 再退一步,
        // 实在排不上也只是"到点提醒可能迟到",不该连累通知本身。
        try {
          am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, endElapsedMs, pi)
          scheduledEndElapsedMs = endElapsedMs
        } catch (_: Throwable) {
          scheduledEndElapsedMs = null
        }
      }
    }

    /** 取消已排的闹钟(跳过 / 自然完成 / 离开训练屏时调)。 */
    private fun cancelAlarm(ctx: Context) {
      scheduledEndElapsedMs = null
      val am = ctx.getSystemService(AlarmManager::class.java) ?: return
      // 匹配只看 action + component,extras 不参与 —— 所以这里不用带 title/color。
      val intent = Intent(ctx, RestTimerAlarmReceiver::class.java).apply {
        action = RestTimerAlarmReceiver.ACTION_REST_DONE
      }
      var flags = PendingIntent.FLAG_NO_CREATE // 没排过就返回 null,别凭空造一个
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        flags = flags or PendingIntent.FLAG_IMMUTABLE
      }
      val pi = PendingIntent.getBroadcast(ctx, ALARM_REQUEST_CODE, intent, flags)
      if (pi != null) {
        am.cancel(pi)
        pi.cancel()
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("RestTimerProgress")

    AsyncFunction("ensureChannel") { promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("ReactContext lost")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val channel = NotificationChannel(
            CHANNEL_ID,
            "训练休息",
            NotificationManager.IMPORTANCE_HIGH
          ).apply {
            description = "训练中组间休息倒计时的持续通知,可在通知栏查看剩余秒数"
            vibrationPattern = longArrayOf(0, 250, 250, 250)
            setSound(null, null)
            enableVibration(true)
            setShowBadge(false)
          }
          ctx.getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
        }
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_CHANNEL", e.message ?: "ensureChannel failed", e)
      }
    }

    /**
     * 把 JS 侧的权威状态交给 [RestTimerTickerService]。
     *
     * **本方法不渲染**(2026-09-28 起)。JS 仍然每秒调它 —— 前台时它就是那个
     * 每秒心跳,但它只在状态**真的变了**的时候才动服务:
     * 开新一轮 / +15s 续命 / 主题色翻转 / 回前台校准。状态没变时是一次
     * 纯比较,几微秒,不产生任何 Binder 调用。
     *
     * 为什么改成这样:原来这里每秒 `nm.notify()`,退后台 JS 一停进度条就冻住。
     * 渲染权收归原生 ticker 之后,前台后台走的是同一条渲染路径,
     * 不会出现"两边都写、谁赢看时序"的抖动。
     */
    AsyncFunction("show") {
        remainingSec: Int, totalSec: Int, title: String, colorHex: String?, promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("ReactContext lost")
        val safeTotal = totalSec.coerceAtLeast(1)
        val safeRemaining = remainingSec.coerceIn(0, safeTotal)
        if (safeRemaining <= 0) {
          // 已经到点 —— **什么都不做**,直接返回。
          //
          // 典型触发场景:后台跑完后切回前台,bridge 的 AppState 校准会先推一次
          // remaining=0。这里若渲染,会挂出一条 00:00 的"进行中"通知。
          //
          // [2026-09-28 修正] 原实现在这里 cancel + cancelAlarm,本意是"别挂 00:00",
          // 但它操作的 NOTIFICATION_ID 是**共享**的 —— 于是把刚发的「休息结束」
          // 一起删掉了(那条通知用的也是这个 id),并且会在闹钟兑现前把它取消掉。
          // 收摊是 dismiss() 的职责(JS 在 tick 到 0 后立刻调它),
          // 服务的到点收尾在 RestTimerTickerService.render() 里,都不缺这一下。
          // 这里保持无副作用,是唯一不会误伤「休息结束」的写法。
        } else {
          // 到点提醒由原生兜底 —— JS 在后台不再触发,排不上就等于没有提醒。
          // 排闹钟自带去抖(ALARM_RESCHEDULE_TOLERANCE_MS),每秒调它不会重排。
          val endElapsed = SystemClock.elapsedRealtime() + safeRemaining * 1000L
          scheduleAlarm(ctx, endElapsed, title, colorHex)
          if (!RestTimerTickerService.matches(endElapsed, safeTotal, title, colorHex)) {
            RestTimerTickerService.start(ctx, endElapsed, safeTotal, title, colorHex)
          }
        }
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_SHOW", e.message ?: "show failed", e)
      }
    }

    /**
     * 隐藏"休息中"通知(用户跳过 / 自然完成 / 切换到下一组时调)。
     *
     * 三件事的顺序有讲究:先停服务,再 cancel 通知。
     * [RestTimerTickerService.stop] 会**同步**把服务的运行标记置 false,
     * 所以哪怕服务此刻正好在 tick,那一帧也会被丢掉 —— 否则它会把这里
     * 刚 cancel 掉的通知重新画回来(通知栏闪一下)。
     */
    AsyncFunction("dismiss") { promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("ReactContext lost")
        RestTimerTickerService.stop(ctx)
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID)
        cancelAlarm(ctx) // 跳过 / 自然完成 → 到点提醒必须一起撤,否则会在休息结束后乱震
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_DISMISS", e.message ?: "dismiss failed", e)
      }
    }

    /**
     * JS 端 "消费" alarm receiver 写入的"已到点"标记 —— 读 + 清 SharedPreferences。
     *
     * 触发场景:退后台 + 锁屏后,App 进程被 freezer/cache 冻结,JS 端 RAF tick
     * 不再触发。闹钟到点时 receiver 唤起 → cancel 通知 + 震动 + SP 写时间戳。
     * **此时 App 内 `RestTimerOverlay` 还在显示 0 秒**(因为 JS 端没机会推进 state)。
     *
     * 用户回前台,bridge mount + AppState 'active' 时调本方法:
     *   - 返回 > 0 → App 内 store 进入"已到点"分支,跳过 1 秒折叠延迟,立即 skip
     *     让 overlay 消失(视觉与通知栏一致 — 通知栏已 cancel,App 内也别挂着)
     *   - 返回 0   → 没发生过 receiver 唤起,JS 走正常 RAF tick 路径
     *
     * read + clear 用 `commit()` 同步原子:避免 mount 多次 / AppState 抖动时
     * 第一次拿到时间戳、第二次误报"又触发了"。`commit()` 在 SP 文件已存在时是
     * KB 量级同步写,JS 端 mount 时一次性调用,负担可接受;若切到 apply() 则
     * 需自己处理竞争(给 key 加一次性 token,逻辑更绕)。
     *
     * 返回:`Long`(elapsedRealtime ms),0 = 无未消费的到点事件。
     */
    AsyncFunction("consumeExpired") { promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("ReactContext lost")
        val sp = prefs(ctx)
        val expiredAt = sp.getLong(KEY_EXPIRED_AT, 0L)
        sp.edit().remove(KEY_EXPIRED_AT).commit()
        promise.resolve(expiredAt)
      } catch (e: Throwable) {
        promise.reject("ERR_CONSUME_EXPIRED", e.message ?: "consumeExpired failed", e)
      }
    }
  }
}
