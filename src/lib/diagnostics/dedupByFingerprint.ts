/**
 * G23 — In-memory deduplication for error-log writes.
 *
 * 背景：G21 扩 console.error 拦截后，单次 React dup-key 事件 5 秒内进表
 * 186 条同 fingerprint（`e4227087`），把 error_logs 撑到 300+ 条，污染
 * 导出 JSON。本模块提供一层"30 秒滑动窗口去重"，让高频 warning 不再
 * 爆表。
 *
 * 设计选择：
 *
 * 1. **30 秒窗口**（`DEDUPE_WINDOW_MS`）
 *    - 用户实机观察到的最严重 burst 是 5 秒 186 条 → 30 秒足够覆盖任何
 *      "React 重渲染 → 反复打 warning" 场景
 *    - 又远小于"同 fp 真有第二次错误"的合理间隔（用户重操作至少分钟级）
 *    - 命名为 public const，方便单测直接覆盖（不依赖 Date.now）
 *
 * 2. **LRU 容量上限 256**（`MAX_TRACKED`）
 *    - 内存：256 * (~50B Map entry) ≈ 13 KB，可忽略
 *    - 防内存泄漏：长时间运行下新 fp 不会无限增长
 *    - 真 LRU 满时淘汰最早 first-write 的 fp（命中时**不重排**，避免
 *      与插入顺序耦合的复杂 bug；溢出场景罕见）
 *
 * 3. **模块单例**
 *    - 与 `installErrorHandlers.ts` 里的 `buffer` / `dbHandle` 一样用模块
 *      作用域私有变量，不进 store
 *    - 测试可通过 `resetForTests()` 清空（不暴露给生产代码）
 *
 * 4. **不持久化去重状态**
 *    - App 重启 → 重新计数（这是有意的：重启后第一次同 fp 仍值得记录，
 *      因为它代表"用户重启后又遇到这个 bug"）
 *    - DB 里已累积的脏数据不动（用户可手动"清除全部数据"或迁移删）
 *
 * **接口**：`shouldRecord(fingerprint, now?)` 返回 true 表示"应该写一条
 * error_log"；返回 false 表示"30 秒内已写过，跳过"。`now` 参数仅测试用。
 */

/** 30 秒滑动窗口。 */
export const DEDUPE_WINDOW_MS = 30_000;

/** 跟踪的 fingerprint 最大数；超过则淘汰最早 first-write 的。 */
export const MAX_TRACKED = 256;

/**
 * fingerprint → 上次"通过 shouldRecord 返回 true"时的 wall-clock (ms)。
 *
 * 用 Map（而非普通对象）保留插入顺序，方便实现简单 LRU。
 */
const lastRecordedAt = new Map<string, number>();

/**
 * 判断 `fingerprint` 在 30 秒滑动窗口内是否已经记录过。
 *
 * @param fingerprint  通常是 `errorLogRepo.computeFingerprint` 算出的 8 字符 FNV-1a hex
 * @param now           可选；测试用，生产代码不传（默认 Date.now()）
 * @returns             true → 这次是新事件，应该 enqueue；false → 30 秒内已写过，跳过
 */
export function shouldRecord(fingerprint: string, now?: number): boolean {
  const t = now ?? Date.now();
  const prev = lastRecordedAt.get(fingerprint);

  if (prev !== undefined && t - prev < DEDUPE_WINDOW_MS) {
    // 30 秒窗口内已写过一次，跳过
    return false;
  }

  // 首次或跨过窗口：更新 lastRecordedAt 并返回 true
  lastRecordedAt.set(fingerprint, t);

  // LRU 淘汰：只在插入新 fp 时检查容量（命中更新不增长）
  if (lastRecordedAt.size > MAX_TRACKED) {
    const oldestKey = lastRecordedAt.keys().next().value;
    if (oldestKey !== undefined) lastRecordedAt.delete(oldestKey);
  }

  return true;
}

/**
 * 清空所有去重状态。**仅测试用** —— 生产代码不应调用。
 */
export function resetForTests(): void {
  lastRecordedAt.clear();
}

/**
 * 当前跟踪的 fingerprint 数量。**仅测试 / 诊断用**。
 */
export function trackedCount(): number {
  return lastRecordedAt.size;
}
