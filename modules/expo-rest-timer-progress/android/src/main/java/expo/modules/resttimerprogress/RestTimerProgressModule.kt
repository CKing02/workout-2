package expo.modules.resttimerprogress

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * RestTimerProgress — 本地 expo-module
 *
 * 用 NotificationCompat.Builder.setProgress() 让 Android 系统用自带 ProgressBar
 * 渲染通知栏进度条,而不是在 body 字符串里手画 unicode 块字符。
 *
 * 三个 JS 调用:
 *   - ensureChannel() : 建/复用 "rest_timer" channel (HIGH importance, silent, vibrate)
 *   - show(rem, total, title, colorHex) : 首次发通知(全量:title + color + progress)
 *   - setProgress(rem, total) : 增量更新进度(每秒 1 次,从 activeNotifications 读旧 title)
 *   - dismiss() : cancel notification
 *
 * 跟现有 expo-notifications 的 channel("rest_timer")同 id — 创建幂等,无冲突。
 */
class RestTimerProgressModule : Module() {
  companion object {
    const val CHANNEL_ID = "rest_timer"
    const val NOTIFICATION_ID = 1001
    const val PROGRESS_BODY = "倒计时中"

    /** show() 第一次设置的颜色,setProgress() 不再传 color —— 沿用首次。 */
    @Volatile var cachedColorHex: String? = null
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
        val nm = NotificationManagerCompat.from(ctx)
        val safeTotal = totalSec.coerceAtLeast(1)
        val safeRemaining = remainingSec.coerceIn(0, safeTotal)
        val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
          .setSmallIcon(android.R.drawable.ic_menu_recent_history)
          .setContentTitle(title)
          .setContentText(PROGRESS_BODY)
          .setOngoing(true)
          .setSilent(true)
          .setPriority(NotificationCompat.PRIORITY_HIGH)
          .setProgress(safeTotal, safeRemaining, false)
        if (!colorHex.isNullOrBlank()) {
          try {
            builder.color = android.graphics.Color.parseColor(colorHex)
            cachedColorHex = colorHex
          } catch (_: IllegalArgumentException) {
            // 颜色格式错就跳过,不让 JS 错破通知
          }
        }
        nm.notify(NOTIFICATION_ID, builder.build())
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_SHOW", e.message ?: "show failed", e)
      }
    }

    /**
     * 增量更新进度 —— 每秒 1 次。
     * 必须重建 builder(NotificationCompat.Builder 不支持 mutate),
     * 但从 activeNotifications 读旧 title 避免 JS 端每次重传。
     */
    AsyncFunction("setProgress") { remainingSec: Int, totalSec: Int ->
      val ctx = appContext.reactContext ?: return@AsyncFunction
      val nm = NotificationManagerCompat.from(ctx)
      val existing = nm.activeNotifications.find { it.id == NOTIFICATION_ID }
        ?: return@AsyncFunction
      val safeTotal = totalSec.coerceAtLeast(1)
      val safeRemaining = remainingSec.coerceIn(0, safeTotal)
      val oldTitle = existing.notification.extras
        .getCharSequence(NotificationCompat.EXTRA_TITLE)
        ?.toString()
        ?: ""
      val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_menu_recent_history)
        .setContentTitle(oldTitle)
        .setContentText(PROGRESS_BODY)
        .setOngoing(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setProgress(safeTotal, safeRemaining, false)
      cachedColorHex?.let {
        try {
          builder.color = android.graphics.Color.parseColor(it)
        } catch (_: IllegalArgumentException) { /* skip */ }
      }
      nm.notify(NOTIFICATION_ID, builder.build())
    }

    AsyncFunction("dismiss") { promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("ReactContext lost")
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID)
        cachedColorHex = null
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_DISMISS", e.message ?: "dismiss failed", e)
      }
    }
  }
}