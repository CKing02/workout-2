package expo.modules.resttimerprogress

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
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
 * 四个 JS 调用:
 *   - ensureChannel() : 建/复用 "rest_timer" channel (HIGH importance, silent, vibrate)
 *   - show(rem, total, title, colorHex) : 首次发通知 + 排"到点"闹钟
 *   - setProgress(rem, total) : 增量更新进度(从 activeNotifications 读旧 title)
 *   - dismiss() : cancel notification + 取消闹钟
 *
 * 渲染方式(2026-09-20 改):内容区自绘 RemoteViews + DecoratedCustomViewStyle。
 *   - 系统头部(图标 / 应用名 / 时间 / 圆角卡片)保留,观感与其他通知一致
 *   - 内容区是一行「动作名 + 倒计时」+ 进度条 —— 原来的 "倒计时中" body 行删掉
 *   - 收起态与展开态**传同一个 RemoteViews**:点开箭头不会多出任何内容
 *   - 进度条用主题色着色(setProgressTintList):系统模板的进度条固定吃
 *     Material You 强调色,`.color` 只影响图标底色,所以必须自绘才跟得上主题
 *
 * 后台冻结修复(2026-09-22):
 *   退后台后 RN 的 JS 定时器不再触发(App 进程也会被 Android 的 cached-apps
 *   freezer 冻结),原来靠每秒 `show()` 推进的一切全部停摆 —— 通知定格在
 *   最后一帧,数字是假的;而且"到点 dismiss + 震动"也一起失效,用户完全
 *   不知道休息何时结束。两个层面都在原生兜:
 *     1. 倒计时数字 → `Chronometer`(由 SystemUI 自绘自走,详见布局注释)
 *     2. 到点提醒   → `AlarmManager` + [RestTimerAlarmReceiver]
 *   进度条仍会冻结(要靠 JS 的 setProgressBar),这是有意的取舍:让它在后台
 *   也动需要前台服务 + 原生 ticker,成本与收益不成比例。
 *
 * 跟现有 expo-notifications 的 channel("rest_timer")同 id — 创建幂等,无冲突。
 */
class RestTimerProgressModule : Module() {
  companion object {
    const val CHANNEL_ID = "rest_timer"
    const val NOTIFICATION_ID = 1001

    /** 闹钟 PendingIntent 的 requestCode —— 跟通知 ID 分开命名空间,别混用。 */
    const val ALARM_REQUEST_CODE = 2001

    /** show() 第一次设置的颜色,setProgress() 不再传 color —— 沿用首次。 */
    @Volatile var cachedColorHex: String? = null

    /** 当前轮的动作名 —— setProgress() 重建通知时沿用。 */
    @Volatile var cachedTitle: String = ""

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

    /** 组装通知。show() 和 setProgress() 只有 title / 进度来源不同,其余完全一致。 */
    private fun build(
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

    AsyncFunction("show") {
        remainingSec: Int, totalSec: Int, title: String, colorHex: String?, promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("ReactContext lost")
        val safeTotal = totalSec.coerceAtLeast(1)
        val safeRemaining = remainingSec.coerceIn(0, safeTotal)
        if (colorHex != null && colorHex.isNotBlank()) {
          cachedColorHex = colorHex
        }
        cachedTitle = title
        val nm = NotificationManagerCompat.from(ctx)
        if (safeRemaining <= 0) {
          // 已经到点:不要再挂一条 00:00 的"进行中"通知。
          // 典型触发场景是"后台跑完后切回前台" —— bridge 的 AppState 校准会先推一次
          // remaining=0,若不拦,它会把 receiver 刚发的「休息结束」顶掉,
          // 闪一下 00:00 再消失。直接收掉,JS 侧的 dismiss 随后也走同一条路。
          nm.cancel(NOTIFICATION_ID)
          cancelAlarm(ctx)
        } else {
          nm.notify(NOTIFICATION_ID, build(ctx, title, safeTotal, safeRemaining, colorHex))
          // 到点提醒由原生兜底 —— JS 在后台不再触发,排不上就等于没有提醒。
          val endElapsed = SystemClock.elapsedRealtime() + safeRemaining * 1000L
          scheduleAlarm(ctx, endElapsed, title, colorHex)
        }
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_SHOW", e.message ?: "show failed", e)
      }
    }

    /**
     * 增量更新进度。
     * 必须重建整个通知(NotificationCompat.Builder 不支持 mutate),
     * 但 title / 颜色沿用上一次 show() 的,避免 JS 端每帧重复传。
     *
     * 到点(remaining<=0)走 cancel 而非 rebuild —— 与 show() 对齐。
     * 不拦会让 Chronometer 的 base 落在 `elapsedRealtime` 之后,
     * SystemUI 把它解释成"已经过多久"显示成 -0:01、-0:02 这种无效时间。
     */
    AsyncFunction("setProgress") { remainingSec: Int, totalSec: Int ->
      val ctx = appContext.reactContext ?: return@AsyncFunction
      val nm = NotificationManagerCompat.from(ctx)
      val existing = nm.activeNotifications.find { it.id == NOTIFICATION_ID }
        ?: return@AsyncFunction
      val safeTotal = totalSec.coerceAtLeast(1)
      val safeRemaining = remainingSec.coerceIn(0, safeTotal)
      if (safeRemaining <= 0) {
        nm.cancel(NOTIFICATION_ID)
        cancelAlarm(ctx)
        return@AsyncFunction
      }
      val oldTitle = existing.notification.extras
        .getCharSequence(NotificationCompat.EXTRA_TITLE)
        ?.toString()
        ?: ""
      nm.notify(
        NOTIFICATION_ID,
        build(ctx, oldTitle, safeTotal, safeRemaining, cachedColorHex),
      )
    }

    AsyncFunction("dismiss") { promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("ReactContext lost")
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID)
        cachedColorHex = null
        cachedTitle = ""
        cancelAlarm(ctx) // 跳过 / 自然完成 → 到点提醒必须一起撤,否则会在休息结束后乱震
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_DISMISS", e.message ?: "dismiss failed", e)
      }
    }
  }
}
