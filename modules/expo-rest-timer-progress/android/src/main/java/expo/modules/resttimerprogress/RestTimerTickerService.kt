package expo.modules.resttimerprogress

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import kotlin.math.abs
import kotlin.math.ceil

/**
 * 休息倒计时的前台服务 —— 让通知栏**进度条**在 App 退后台后继续走。
 *
 * **为什么需要它**:进度条的值只能由 App 主动写(`RemoteViews.setProgressBar`),
 * 而 RemoteViews 里唯一会自走的控件是 `Chronometer` —— 倒计时数字靠它,
 * SystemUI 自己每秒刷新,跟 App 进程死活无关。于是退后台后出现一个自相矛盾的
 * 画面:**数字照走,进度条卡死**。跑一个前台服务把每秒重画挪进原生,
 * 进程就不会被 Android 的 cached-app freezer 冻住。
 *
 * 职责边界(两条路径缺一不可):
 *   - **本服务** = 视觉保真。每 1s 重画一次进度条。
 *   - **AlarmManager**(见 [RestTimerProgressModule.scheduleAlarm])= 到点的**保证**。
 *     前台服务**不持有 wake lock**,息屏进 Doze 后 CPU 会睡,1s ticker 同样会停;
 *     只有 `setExactAndAllowWhileIdle` 能唤醒 CPU。所以两者分工明确:
 *     进度条只在"屏幕亮着"时有意义,ticker 足够;到点必须准,靠闹钟。
 *
 * **渲染入口唯一**:服务跑起来后,JS 每秒的 `show()` 会被 [matches] 去重成
 * no-op —— 否则两边同时写同一条通知,谁赢取决于时序,进度条会来回跳。
 * 服务是活着时的唯一渲染者,JS 只负责在状态**变化**时(开新一轮 / +15s / 回前台校准)
 * 把新的权威状态推过来。
 */
class RestTimerTickerService : Service() {

  companion object {
    private const val TAG = "RestTimerProgress"

    /** ticker 周期。与 Chronometer 的秒跳对齐;1s 是进度条视觉上"连续"的下限。 */
    private const val TICK_INTERVAL_MS = 1000L

    const val EXTRA_END_ELAPSED = "end_elapsed_ms"
    const val EXTRA_TOTAL_SEC = "total_sec"
    const val EXTRA_TITLE = "title"
    const val EXTRA_COLOR_HEX = "color_hex"

    /**
     * 到点时刻的容差。
     *
     * JS 侧算到点时刻用的是 `ceil(剩余ms/1000)` 再乘回去,量化误差 ≤1s ——
     * 也就是说哪怕倒计时没变,JS 每秒送来的 endElapsed 也会在 1s 内抖。
     * 没有容差的话服务会被每秒重启一次(还会连带重排闹钟)。
     *
     * 1500ms 覆盖这个抖动,同时远小于任何真实的"到点时刻变化":
     * +15s 续命差 15s,切换下一组至少差一个 rest 时长,都会正常触发重启。
     */
    private const val END_TOLERANCE_MS = 1500L

    /**
     * 服务当前渲染的状态。`isRunning == false` 时其余字段无意义。
     *
     * 用进程内静态而不是 SP:服务与 JS 同进程,服务活着静态就在;服务死了
     * 就说明没人渲染了,[matches] 自然返回 false,下次 `show()` 会重新拉起。
     * 不需要跨进程持久化 —— 进程没了就重新来过,这正是我们想要的语义。
     */
    @Volatile
    private var isRunning = false

    @Volatile
    private var curEndElapsedMs = 0L

    @Volatile
    private var curTotalSec = 0

    @Volatile
    private var curTitle = ""

    @Volatile
    private var curColorHex: String? = null

    /**
     * `show()` 用:服务是否已经在按**等价状态**渲染。
     *
     * 等价 = total / title / color 完全相同,且到点时刻差在 [END_TOLERANCE_MS] 内。
     */
    fun matches(
      endElapsedMs: Long,
      totalSec: Int,
      title: String,
      colorHex: String?,
    ): Boolean =
      isRunning &&
        curTotalSec == totalSec &&
        curTitle == title &&
        curColorHex == colorHex &&
        abs(curEndElapsedMs - endElapsedMs) <= END_TOLERANCE_MS

    /**
     * 拉起 / 更新服务。同进程内重复调用是幂等的(`onStartCommand` 只换状态重画)。
     *
     * API 26+ 走 `startForegroundService`(后台启动必须走这个入口,否则 API 26+
     * 直接抛 IllegalStateException);更早的版本 `startService` 就够。
     */
    fun start(
      ctx: Context,
      endElapsedMs: Long,
      totalSec: Int,
      title: String,
      colorHex: String?,
    ) {
      val intent = Intent(ctx, RestTimerTickerService::class.java).apply {
        putExtra(EXTRA_END_ELAPSED, endElapsedMs)
        putExtra(EXTRA_TOTAL_SEC, totalSec)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_COLOR_HEX, colorHex)
      }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ctx.startForegroundService(intent)
        } else {
          ctx.startService(intent)
        }
      } catch (t: Throwable) {
        // Android 12+ 从后台启动前台服务会被拒
        // (ForegroundServiceStartNotAllowedException)。正常路径都是用户刚做完一组、
        // App 还在前台时启动,够用;真被拒也只是退回"进度条会冻"的老行为,
        // 不该让异常冒到 JS。到点提醒由闹钟保证,不受影响。
        Log.w(TAG, "start service failed", t)
      }
    }

    /**
     * 收服务(用户跳过 / 到点 / 离开训练屏 / 切换到下一组)。
     *
     * **必须同步把 isRunning 置 false**:`stopService` 是异步的,服务在
     * `onDestroy` 之前还会再 tick 一次;若不提前置位,那一帧会把调用方
     * 紧接着 `cancel()` 掉的通知重新画回来 —— 通知栏闪一下又消失。
     */
    fun stop(ctx: Context) {
      isRunning = false
      try {
        ctx.stopService(Intent(ctx, RestTimerTickerService::class.java))
      } catch (t: Throwable) {
        Log.w(TAG, "stop service failed", t)
      }
    }
  }

  private val handler = Handler(Looper.getMainLooper())

  /** 当前实例的渲染参数 —— 与 companion 的镜像分开存,避免多实例互相踩。 */
  private var endElapsedMs = 0L
  private var totalSec = 1
  private var title = ""
  private var colorHex: String? = null

  /** 本次结束是否由"到点"引起 —— 决定 [onDestroy] 保留还是抹掉通知,见那里。 */
  private var endedByExpiry = false

  private val ticker = object : Runnable {
    override fun run() {
      // render() 返回 false = 不用再排下一次(已到点 / 已被要求停 / 启动失败)
      if (render()) handler.postDelayed(this, TICK_INTERVAL_MS)
    }
  }

  /** 不需要绑定,返回 null 即可。 */
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val end = intent?.getLongExtra(EXTRA_END_ELAPSED, 0L) ?: 0L
    if (intent == null || end <= 0L) {
      // 没有权威状态就没得渲染。正常不会走到(show() 只在 remaining > 0 时拉起),
      // 但 START_NOT_STICKY 下系统重建服务时 intent 可能为 null。
      stopSelf()
      return START_NOT_STICKY
    }

    endElapsedMs = end
    totalSec = intent.getIntExtra(EXTRA_TOTAL_SEC, 1).coerceAtLeast(1)
    title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
    colorHex = intent.getStringExtra(EXTRA_COLOR_HEX)
    endedByExpiry = false

    // 同步镜像给 show() 的 matches 读
    curEndElapsedMs = endElapsedMs
    curTotalSec = totalSec
    curTitle = title
    curColorHex = colorHex
    isRunning = true

    handler.removeCallbacks(ticker)
    // 立刻画一帧再排下一次:onStartCommand 里调了 startForeground 才算兑现
    // startForegroundService 的 5s 契约,不能等 1s。
    if (render()) handler.postDelayed(ticker, TICK_INTERVAL_MS)

    // 不粘:进程被杀后不要把服务拉起来 —— 那时 JS 也没了,没有权威状态可渲染
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(ticker)
    isRunning = false
    // 到点结束 → DETACH 保留通知:处理器刚发的「休息结束」用的就是这个 id,
    //   REMOVE 会把它一起抹掉(两条路径谁先跑不确定,是真实会踩到的竞态)。
    // 其他原因结束(跳过 / 切换 / 系统回收)→ REMOVE,别在通知栏留一条冻死的倒计时。
    stopForeground(
      if (endedByExpiry) STOP_FOREGROUND_DETACH else STOP_FOREGROUND_REMOVE
    )
    super.onDestroy()
  }

  /**
   * 渲染一帧。返回 `false` = 调用方不要再排下一次。
   */
  private fun render(): Boolean {
    // 调用方已经要求停了(用户跳过 / 切下一组)。这一帧必须丢掉,否则会把
    // 那边紧接着 cancel 掉的通知闪回来。
    if (!isRunning) return false

    val remainingMs = endElapsedMs - SystemClock.elapsedRealtime()
    // 与 JS 侧的 Math.max(0, Math.ceil(ms / 1000)) 保持同一套取整,
    // 否则同一时刻两边算出的秒数会差 1,进度条和数字对不上。
    val remainingSec = ceil(remainingMs / 1000.0).toInt()

    if (remainingSec <= 0) {
      // 到点:与闹钟走同一个处理器(内置 5s 去抖,两条路径只有一条真正执行),
      // 由它负责 cancel 通知 / 震动 / 落 SP / 后台时发「休息结束」。
      RestTimerAlarmReceiver.handleRestExpired(this, title, colorHex)
      endedByExpiry = true
      stopSelf()
      return false
    }

    val notification = RestTimerProgressModule.build(
      this, title, totalSec, remainingSec, colorHex,
    )
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          RestTimerProgressModule.NOTIFICATION_ID,
          notification,
          // API 34+ 必须给类型,否则 MissingForegroundServiceTypeException。
          // API 29-33 类型不强制,传 NONE 走传统路径(声明里的 specialUse
          // 在那些版本上不被解析,传它反而有风险)。
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
          } else {
            // 该常量在 API 34 起被标废弃(那边改为"必须显式给类型",NONE 不再合法),
            // 但这条分支只在 API 29-33 执行,那时它就是正确取值。
            @Suppress("DEPRECATION")
            ServiceInfo.FOREGROUND_SERVICE_TYPE_NONE
          },
        )
      } else {
        startForeground(RestTimerProgressModule.NOTIFICATION_ID, notification)
      }
    } catch (t: Throwable) {
      // 前台服务起不来(权限被撤 / OEM 限制 / 用户关了该应用的通知通道)。
      // 这里没有可用的降级路径 —— 直接收摊,退回"进度条会冻"的老行为;
      // 到点提醒由闹钟独立保证,不受影响。
      Log.w(TAG, "startForeground failed", t)
      isRunning = false
      stopSelf()
      return false
    }
    return true
  }
}
