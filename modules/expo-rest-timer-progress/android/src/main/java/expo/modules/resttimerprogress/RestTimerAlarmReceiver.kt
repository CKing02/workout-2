package expo.modules.resttimerprogress

import android.app.ActivityManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Process
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * 休息计时到点的兜底提醒(由 [RestTimerProgressModule] 排的 AlarmManager 闹钟唤起)。
 *
 * **为什么需要它**:退后台后 RN 的 JS 定时器不再触发,App 内那条
 * `haptic.success()`(`RestTimerOverlay.tsx`)和"到点 dismiss 通知"的路径
 * 都不会执行 —— 用户既看不到真实剩余时间,也不知道休息已经结束。
 * 而休息计时器最主要的使用场景恰恰是人不在看屏幕(组间休息、手机放兜里),
 * 所以"到点"这件事必须由原生闹钟来兜,不能依赖 JS 存活。
 *
 * 行为分流:
 *   - **App 在前台** → 什么都不做。JS 侧的 haptic 已经震过了,再来一次是打扰。
 *   - **App 在后台 / 已被杀** → 用**同一个 NOTIFICATION_ID** 顶掉那条冻结的
 *     倒计时通知,换成「休息结束」+ 震动。
 *
 * 复用同一个 ID 是有意的:否则冻结的「杠铃卧推 00:45」会一直挂在通知栏,
 * 和新的「休息结束」并排显示,用户看到的是个互相矛盾的界面。
 */
class RestTimerAlarmReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_REST_DONE = "expo.modules.resttimerprogress.REST_DONE"
    const val EXTRA_TITLE = "title"
    const val EXTRA_COLOR_HEX = "color_hex"

    /** 与 builder.setVibrate 同样的 pattern — 双路径走通才稳。 */
    private val VIBRATION_PATTERN = longArrayOf(0, 400, 200, 400)

    /**
     * 自己这个进程是否处于前台。
     *
     * `getRunningAppProcesses()` 在 API 21+ 只会返回**本应用**的进程,
     * 所以不需要任何权限。查不到时按"后台"处理 —— 宁可多震一次,
     * 也不要漏掉提醒(漏掉是整个功能失效,多震只是轻微打扰)。
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
     * 必要性:channel vibrate 在锁屏下会被 OPPO ColorOS / 小米 MIUI 等 OEM 拦截
     * (标准 Android 不拦),但 Vibrator 是 system service,**OEM 不能拦截**(系统级 API)。
     * 后台场景下 channel 路径已生效,会"多震一次"—— 是 G42 receiver 注释里
     * "宁可多震一次,也不要漏掉提醒"的明确取舍。
     *
     * 兼容性:覆盖 minSdk 24 到 ~35。
     *   - API 31+:`VibratorManager.getDefaultVibrator()`
     *   - API 26-30:`getSystemService(Vibrator::class.java)` + `VibrationEffect.createWaveform`
     *   - API 24-25:`getSystemService(Vibrator::class.java)` + `vibrate(longArrayOf, -1)`(deprecated 但 work)
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
        if (vibrator == null) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, -1))
        } else {
          @Suppress("DEPRECATION")
          vibrator.vibrate(VIBRATION_PATTERN, -1)
        }
      } catch (_: Throwable) {
        // 设备没 vibrator / 系统禁了震动 —— 不影响通知本身
      }
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_REST_DONE) return

    // 闹钟已兑现,清掉去抖记录 —— 否则下次 show() 会以为还排着旧闹钟
    RestTimerProgressModule.scheduledEndElapsedMs = null

    // **强制震动路径**(绕过 channel,OEM 锁屏拦截不了)。即便 App 在前台也走:
    // isAppForeground() 早返后会清掉 channel 通知,所以这里先震一下"已覆盖"。
    // 在前台时 JS 侧 RestTimerOverlay 已经 haptic 过了,这次多震一次是可接受打扰。
    triggerVibration(context)

    if (isAppForeground(context)) return

    val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
    val colorHex = intent.getStringExtra(EXTRA_COLOR_HEX)

    val builder = NotificationCompat.Builder(context, RestTimerProgressModule.CHANNEL_ID)
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
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        builder.setContentIntent(PendingIntent.getActivity(context, 0, launch, flags))
      }
    } catch (_: Throwable) {
      // 忽略
    }

    try {
      NotificationManagerCompat.from(context)
        .notify(RestTimerProgressModule.NOTIFICATION_ID, builder.build())
    } catch (_: SecurityException) {
      // 用户拒了 POST_NOTIFICATIONS —— 静默吞掉,不该因为提醒发不出去而崩进程
    }
  }
}
