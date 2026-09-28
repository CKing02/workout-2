package expo.modules.resttimerprogress

import android.app.ActivityManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * 休息计时到点的兜底提醒 —— **闹钟入口**。
 *
 * 真正的动作全在 [handleRestExpired]:它是两个入口共用的到点处理器
 * (另一个是 [RestTimerTickerService] 的 1s ticker)。本类只负责把 Intent
 * 里的 extras 取出来转交。
 *
 * **为什么到点必须有闹钟兜**:退后台后 RN 的 JS 定时器不再触发,App 内那条
 * `haptic.success()`(`RestTimerOverlay.tsx`)和"到点 dismiss 通知"的路径
 * 都不会执行 —— 用户既看不到真实剩余时间,也不知道休息已经结束。
 * 而休息计时器最主要的使用场景恰恰是人不在看屏幕(组间休息、手机放兜里),
 * 所以"到点"这件事必须由原生闹钟来兜,不能依赖 JS 存活。
 *
 * **为什么 ticker 也要能触发到点**:前台服务不持 wake lock,息屏进 Doze 后
 * CPU 会睡,ticker 停摆,那时只有 `setExactAndAllowWhileIdle` 能唤醒 CPU;
 * 反过来拿不到精确闹钟权限时(receiver 注释里的降级路径)闹钟可能迟到几分钟,
 * 而 ticker 只要进程活着就更准。两条都留,谁先到谁干活,由去抖保证只干一次。
 */
class RestTimerAlarmReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_REST_DONE = "expo.modules.resttimerprogress.REST_DONE"
    const val EXTRA_TITLE = "title"
    const val EXTRA_COLOR_HEX = "color_hex"

    /** 与 builder.setVibrate 同样的 pattern — 双路径走通才稳。 */
    private val VIBRATION_PATTERN = longArrayOf(0, 400, 200, 400)

    /** logcat tag — 与 RestTimerProgressModule 一致,方便 filter。 */
    private const val TAG = "RestTimerProgress"

    /**
     * 去抖窗口:闹钟与 ticker 几乎同时到点,两个入口都会调 [handleRestExpired]。
     * 窗口内重复触发直接忽略 —— 否则会震两次、并且把「休息结束」通知连发两遍。
     *
     * 5s 是个宽裕值:两条路径的触发时刻差通常在毫秒级(都盯着同一个
     * endElapsedMs),最坏情况也超不过 ticker 的一个周期(1s)。
     * 只有"上一次到点 5s 内又到点"这种数据异常才会被误吞,而那是坏数据,吞掉更好。
     */
    private const val EXPIRY_DEDUPE_MS = 5000L

    private val dedupeLock = Any()

    /** 上次真正执行到点动作的 elapsedRealtime;0 = 从未。 */
    @Volatile
    private var lastExpiredHandledAt = 0L

    /**
     * 自己这个进程是否处于前台。
     *
     * `getRunningAppProcesses()` 在 API 21+ 只会返回**本应用**的进程,
     * 所以不需要任何权限。查不到时按"后台"处理 —— 宁可多震一次,
     * 也不要漏掉提醒(漏掉是整个功能失效,多震只是轻微打扰)。
     *
     * 注意用的是 `== IMPORTANCE_FOREGROUND`(100)而不是 `>=`:
     * 只有前台服务活着时进程是 `IMPORTANCE_FOREGROUND_SERVICE`(125),
     * 用 `>=` 会把"App 在后台但服务在跑"误判成前台,从而不发「休息结束」。
     * 这正是 [RestTimerTickerService] 引入后必须区分的一种状态。
     */
    private fun isAppForeground(ctx: Context): Boolean {
      return try {
        val am = ctx.getSystemService(ActivityManager::class.java) ?: return false
        val myPid = Process.myPid()
        val procs = am.runningAppProcesses ?: return false
        procs.any {
          it.pid == myPid &&
            it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        }
      } catch (_: Throwable) {
        false
      }
    }

    /**
     * 直接调 Vibrator service 强制震动,绕过通知 channel 路径。
     *
     * 必要性:channel vibrate 在锁屏下**可能**被 OEM(OPPO ColorOS / 小米 MIUI)拦截,
     * 所以留一条不经过 NotificationManager 的兜底路径。
     *
     * **[2026-09-27 修正] 必须带 AudioAttributes,否则后台静默失效。**
     * 早先的注释断言"Vibrator 是 system service,OEM 不能拦截"—— 这个前提是错的:
     * 拦截它的不是 OEM,是 AOSP 自己的 VibratorService。不带 AudioAttributes 时
     * usage 默认 USAGE_UNKNOWN,而 frameworks/base 的判定是
     *
     *     if (procState > IMPORTANT_FOREGROUND && !vib.isNotification()
     *             && !vib.isRingtone() && !vib.isAlarm())
     *         Slog.e(TAG, "Ignoring incoming vibration ... is background, usage = USAGE_UNKNOWN");
     *
     * 即后台进程 + 非(通知/铃声/闹钟)的震动一律丢弃。真机(OPPO PBEM00 / Android 10)
     * 复现过这条日志。更坑的是它是**静默丢弃**(不抛异常),下面 catch 永不触发,
     * App 侧完全无感。传 USAGE_ALARM 后走进豁免分支。
     *
     * 双震取舍:后台场景下重建的「休息结束」通知也会经 channel 震一次
     * (usageHint=USAGE_NOTIFICATION,同样豁免),所以这里会"多震一次"——
     * 沿用"宁可多震一次,也不要漏掉提醒"的既有取舍;
     * 且只有在锁屏拦截 channel 真的发生时,这条兜底才有存在意义。
     *
     * 兼容性:覆盖 minSdk 24 到 ~35。
     *   - API 31+:`VibratorManager.getDefaultVibrator()`
     *   - API 26-30:`getSystemService(Vibrator::class.java)` + `vibrate(VibrationEffect, AudioAttributes)`
     *   - API 24-25:`getSystemService(Vibrator::class.java)` + `vibrate(long[], int, AudioAttributes)`(deprecated 但 work)
     *
     * 失败兜底:try/catch 所有 Throwable —— 震动不是关键功能,失败不能影响通知本身。
     */
    private fun triggerVibration(ctx: Context) {
      try {
        val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
          @Suppress("DEPRECATION")
          ctx.getSystemService(Vibrator::class.java)
        }
        if (vibrator == null) {
          Log.w(TAG, "vibrator service unavailable")
          return
        }
        // USAGE_ALARM 让震动在后台也被 VibratorService 放行(见上)。
        // CONTENT_TYPE_SONIFICATION 与"提醒音"语义一致,配合 USAGE_ALARM 会按
        // 系统的"闹钟强度"(mRingIntensity / mAlarmIntensity)输出。
        val attrs = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, -1), attrs)
        } else {
          @Suppress("DEPRECATION")
          vibrator.vibrate(VIBRATION_PATTERN, -1, attrs)
        }
      } catch (t: Throwable) {
        // 不再静默吞 —— 让真机复现时能 logcat 抓到根因
        // (SecurityException / 系统禁震动 等)。注意:被 VibratorService
        // 判定为"后台不允许"时不抛异常,只会打系统日志,这里抓不到。
        Log.w(TAG, "vibration failed", t)
      }
    }

    /**
     * 休息到点的**唯一**处理器 —— 闹钟 receiver 与 [RestTimerTickerService] 共用。
     *
     * 行为分流:
     *   - **App 在前台** → 只取消通知 + 震动。JS 侧的 haptic 已经震过了,
     *     且 in-app `RestTimerOverlay` 会接管收尾,不再发「休息结束」打扰。
     *   - **App 在后台 / 已被杀**(或只有前台服务在跑) → 用**同一个
     *     NOTIFICATION_ID** 顶掉那条冻结/刚取消的倒计时通知,换成「休息结束」+ 震动。
     *
     * 复用同一个 ID 是有意的:否则冻结的「杠铃卧推 00:45」会一直挂在通知栏,
     * 和新的「休息结束」并排显示,用户看到的是个互相矛盾的界面。
     *
     * 幂等:见 [EXPIRY_DEDUPE_MS]。两个入口谁先到谁执行,后来者在窗口内直接返回。
     */
    @JvmStatic
    fun handleRestExpired(ctx: Context, title: String, colorHex: String?) {
      val now = SystemClock.elapsedRealtime()
      synchronized(dedupeLock) {
        if (now - lastExpiredHandledAt < EXPIRY_DEDUPE_MS) return
        lastExpiredHandledAt = now
      }

      // 闹钟已兑现,清掉去抖记录 —— 否则下次 show() 会以为还排着旧闹钟
      RestTimerProgressModule.scheduledEndElapsedMs = null

      // [G42 hotfix] 无条件取消旧 Chronometer 通知。
      // 旧实现只在 `isAppForeground()` 为 false 时发新通知,前台早返路径下
      // 旧通知挂着 → Chronometer 的 base 已过 → SystemUI 显示 -0:01, -0:02 ...
      // 真实复现(2026-09-23 OPPO PBEM00):训练进入休息 → Home 键 → 锁屏 → 倒计时跑负数。
      // 修法:进处理器第一件事就是 cancel(NOTIFICATION_ID),无论前后台都先把
      // 这条通知清掉。后果:
      //   - 前台:通知消失,JS 侧 RestTimerOverlay 接管(本地 haptic + overlay 消失)
      //   - 后台:通知消失,然后下方重建为"休息结束"通知
      // 副作用:进度条"后台冻结"的视觉矛盾(数字动 + 进度条不动)也一并消失 —
      // 通知整体取消,不再显示冻结界面。
      NotificationManagerCompat.from(ctx).cancel(RestTimerProgressModule.NOTIFICATION_ID)

      // [G42 hotfix #2] 写 SP "expired_at" —— JS 端回前台时通过 consumeExpired()
      // 读到这标记 → 让 App 内 RestTimerOverlay 立即消失。
      // 现象:锁屏 / 后台期间通知栏已 cancel,但 App 内 overlay 仍显示 0 秒直到
      // 用户回前台触发 RAF tick。这条路径让"通知消失但 overlay 仍挂着"视觉同步:
      // 一旦唤起 → 通知 cancel + SP 写标记 → JS 回前台时立即 skip overlay。
      RestTimerProgressModule.markExpired(ctx)

      // **直调 Vibrator 兜底路径**(不经过 NotificationManager)。两条分支都走:
      //   - 前台:下面 isAppForeground() 会早返、不重建通知,所以 channel 根本不会震
      //     —— 这次直调其实是前台唯一的一次"到点"震动(JS 侧 RestTimerOverlay
      //     的 haptic 也会跑,属可接受的重叠)。
      //   - 后台:重建的「休息结束」通知会经 channel 再震一次,这里"多震一次"。
      // 多数情况下它是冗余的,但只有当 OEM 真把 channel 震动拦了,它才是唯一退路
      // —— 所以必须带 AudioAttributes.USAGE_ALARM,否则最需要它时恰好失效(详见上)。
      triggerVibration(ctx)

      if (isAppForeground(ctx)) return

      val builder = NotificationCompat.Builder(ctx, RestTimerProgressModule.CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_menu_recent_history)
        .setContentTitle("休息结束")
        .setContentText(if (title.isNotBlank()) title else null)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        // O 以下没有 channel,震动只能靠 builder 这两个字段;O+ 由 channel 决定
        // (rest_timer channel 是 enableVibration(true) + setSound(null, null))。
        .setDefaults(NotificationCompat.DEFAULT_VIBRATE)
        .setVibrate(longArrayOf(0, 400, 200, 400))
        .setAutoCancel(true)
        .setOngoing(false)

      if (!colorHex.isNullOrBlank()) {
        try {
          builder.color = Color.parseColor(colorHex)
        } catch (_: IllegalArgumentException) {
          // 颜色格式错就跳过,不影响提醒本身
        }
      }

      // 点通知回到 App;拿不到 launch intent 就退化为不可点(不影响提醒)
      try {
        ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let { launch ->
          launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
          var flags = PendingIntent.FLAG_UPDATE_CURRENT
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
          }
          builder.setContentIntent(PendingIntent.getActivity(ctx, 0, launch, flags))
        }
      } catch (_: Throwable) {
        // 忽略
      }

      try {
        NotificationManagerCompat.from(ctx)
          .notify(RestTimerProgressModule.NOTIFICATION_ID, builder.build())
      } catch (_: SecurityException) {
        // 用户拒了 POST_NOTIFICATIONS —— 静默吞掉,不该因为提醒发不出去而崩进程
      }
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_REST_DONE) return
    handleRestExpired(
      context,
      intent.getStringExtra(EXTRA_TITLE).orEmpty(),
      intent.getStringExtra(EXTRA_COLOR_HEX),
    )
  }
}
