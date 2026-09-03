/**
 * G20 — BarChart.niceMax 单元测试。
 *
 * `niceMax` 是导出纯函数（BarChart 内部使用），用于把 Y 轴最大值
 * 取整到"漂亮的整数"（1/2/5 × 10^n）。
 */

import { niceMax } from '@/features/data/charts/BarChart';

describe('charts/BarChart.niceMax', () => {
  it('0 → 10（默认下限）', () => {
    expect(niceMax(0)).toBe(10);
  });

  it('5 → 5（落在 1×10^0 ≤ 5）', () => {
    expect(niceMax(5)).toBe(5);
  });

  it('7 → 10（落在 1..2 区间 → 2×10^0 = 2 不够 → 升到 1×10^1）', () => {
    expect(niceMax(7)).toBe(10);
  });

  it('47 → 50（落在 2..5 区间 → 5×10^1）', () => {
    expect(niceMax(47)).toBe(50);
  });

  it('100 → 100（自身已经是 1×10^2）', () => {
    expect(niceMax(100)).toBe(100);
  });

  it('99 → 100（差一点点就升档）', () => {
    expect(niceMax(99)).toBe(100);
  });

  it('1234 → 2000（落在 1..2 区间 → 2×10^3）', () => {
    expect(niceMax(1234)).toBe(2000);
  });

  it('5000 → 5000（落在 5×10^3）', () => {
    expect(niceMax(5000)).toBe(5000);
  });
});