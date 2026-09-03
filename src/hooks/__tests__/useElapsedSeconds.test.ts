/**
 * G20 — useElapsedSeconds.formatElapsed 单元测试。
 *
 * `formatElapsed` 是 hook 文件导出的纯函数，可独立测试。hook 本身
 * 依赖 RAF + 真实时钟，留给 G20.x。
 */

import { formatElapsed } from '@/hooks/useElapsedSeconds';

describe('hooks/useElapsedSeconds.formatElapsed', () => {
  it('0 秒 → "00:00"', () => {
    expect(formatElapsed(0)).toBe('00:00');
  });

  it('59 秒 → "00:59"', () => {
    expect(formatElapsed(59)).toBe('00:59');
  });

  it('125 秒 → "02:05"', () => {
    expect(formatElapsed(125)).toBe('02:05');
  });

  it('3725 秒（≥1 小时） → "1:02:05"', () => {
    expect(formatElapsed(3725)).toBe('1:02:05');
  });

  it('负数 → "00:00"（防御 clamp）', () => {
    expect(formatElapsed(-100)).toBe('00:00');
  });

  it('小数向下取整：125.9 → "02:05"', () => {
    expect(formatElapsed(125.9)).toBe('02:05');
  });
});