/**
 * G20 — Jest globalSetup（worker 进程启动前执行一次）。
 *
 * 为什么需要 globalSetup 而不是 setupFiles：
 *   `process.env.TZ` 必须在 Node 进程初始化时设置才生效 — V8 / Node 在
 *   启动时读取 TZ 并缓存到 ICU / Date 原生代码里。setupFiles 在 jest
 *   worker 启动后才执行，已经太晚。
 *   globalSetup 在 jest spawn 第一个 worker 之前执行，是唯一能可靠
 *   设置 TZ 的 hook。
 *
 * 内容固定 TZ = 'UTC'，让 dayKey / weekKey / formatStartHHMM 等依赖
 * 本地时区的函数在 Windows (UTC+8 默认) 与 CI (UTC) 跑出同样的结果。
 */

module.exports = async () => {
  process.env.TZ = 'UTC';
};