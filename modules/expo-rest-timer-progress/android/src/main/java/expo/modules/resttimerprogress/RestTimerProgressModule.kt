package expo.modules.resttimerprogress

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Build
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
 *   - show(rem, total, title, colorHex) : 首次发通知(全量:title + color + progress)
 *   - setProgress(rem, total) : 增量更新进度(从 activeNotifications 读旧 title)
 *   - dismiss() : cancel notification
 *
 * 渲染方式(2026-09-20 改):内容区自绘 RemoteViews + DecoratedCustomViewStyle。
 *   - 系统头部(图标 / 应用名 / 时间 / 圆角卡片)保留,观感与其他通知一致
 *   - 内容区只有一行「动作名 mm:ss」+ 进度条 —— 原来的 "倒计时中" body 行删掉
 *   - 收起态与展开态**传同一个 RemoteViews**:点开箭头不会多出任何内容
 *   - 进度条用主题色着色(setProgressTintList):系统模板的进度条固定吃
 *     Material You 强调色,`.color` 只影响图标底色,所以必须自绘才跟得上主题
 *
 * 跟现有 expo-notifications 的 channel("rest_timer")同 id — 创建幂等,无冲突。
 */
class RestTimerProgressModule : Module() {
  companion object {
    const val CHANNEL_ID = "rest_timer"
    const val NOTIFICATION_ID = 1001

    /** show() 第一次设置的颜色,setProgress() 不再传 color —— 沿用首次。 */
    @Volatile var cachedColorHex: String? = null

    /**
     * 内容区 RemoteViews:一行「动作名 mm:ss」+ 主题色进度条。
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
        NotificationManagerCompat.from(ctx)
          .notify(NOTIFICATION_ID, build(ctx, title, safeTotal, safeRemaining, colorHex))
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_SHOW", e.message ?: "show failed", e)
      }
    }

    /**
     * 增量更新进度。
     * 必须重建整个通知(NotificationCompat.Builder 不支持 mutate),
     * 但 title / 颜色沿用上一次 show() 的,避免 JS 端每帧重复传。
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
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_DISMISS", e.message ?: "dismiss failed", e)
      }
    }
  }
}
