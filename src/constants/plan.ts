/**
 * 计划编辑器共享常量。
 *
 * - `STUB_NEW_PLAN_ID` 是新建计划时暂存内存草稿用的 sentinel,真正的 plan_id
 *   要等保存后才由 SQLite 生成 (random UUID via `newId()`)。屏幕与 store 都
 *   用这个常量引用同一份字符串,避免任一侧漂移导致 set drafts 关联错乱。
 */
export const STUB_NEW_PLAN_ID = '__new';
