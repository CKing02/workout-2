/**
 * Repositories barrel.
 */

export * from './exerciseRepo';
export * from './planRepo';
export * from './trainingRepo';
export * from './trainingSetRepo';
export * from './settingsRepo';
export * from './errorLogRepo';
// G32 — 单动作历史下钻的查询（按 exercise_id + 时间窗口拉 normal set）；
// 与 useDataAggregates（全量内存聚合）路径不同，专门为下钻屏优化。
export * from './exerciseHistoryRepo';
// G32 — 「按动作」Tab 的列表数据源（max Brzycki 1RM + 总训练次数）。
export * from './exerciseListRepo';
// US-12 — 身体测量（体重 + 体脂）仓库。
export * from './bodyMeasurementRepo';
