/**
 * G46 — `haptic` 触感分层 6 API 单元测（AC-3 + AC-4）。
 *
 * AC-3：6 个 API 全部存在；hapticsEnabled === false 时全部 no-op。
 * AC-4：mock `Haptics.notificationAsync` 验证 success/warning/error 路由正确。
 *
 * 设计覆盖：
 *  - 设置开关关闭 → 6 个 API 都不调 `expo-haptics`
 *  - 设置开关开启 → 走正确的 Haptics.* 调用
 *  - tick    → selectionAsync
 *  - success → notificationAsync(Success)
 *  - warning → notificationAsync(Warning)
 *  - error   → notificationAsync(Error)
 *  - heavy   → impactAsync(Heavy)
 *  - restComplete → impactAsync(Medium)（+ 90ms 后 Light，本测只验证同帧 Medium）
 *
 * 不验证：
 *  - 错误吞掉（catch 的链路）—— best-effort 体验，故意不观察
 *  - setTimeout 的二次轻触 —— 跨帧异步行为，避免 fake timer 副作用污染其它 jest
 *    worker，只验证同一帧行为
 *  - `isEnabled` 读 settingsStore.getState() 的时机一致性 —— G13 自检已覆盖
 */

const mockNotificationAsync = jest.fn<Promise<void>, [unknown]>();
const mockSelectionAsync = jest.fn<Promise<void>, []>();
const mockImpactAsync = jest.fn<Promise<void>, [unknown]>();

// 顶层变量前缀必须是 `mock`（jest.mock factory 闭包白名单规则）
let mockHapticsEnabled = true;

jest.mock('expo-haptics', () => ({
  __esModule: true,
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Rigid: 'rigid',
    Soft: 'soft',
  },
  notificationAsync: (type: unknown) => mockNotificationAsync(type),
  selectionAsync: () => mockSelectionAsync(),
  impactAsync: (style: unknown) => mockImpactAsync(style),
}));

jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ hapticsEnabled: mockHapticsEnabled }),
  },
}));

// jest.mock(...) 之后再 import 目标模块
import { haptic } from '@/utils/haptics';

describe('G46 haptic — 6 个语义化 API', () => {
  beforeEach(() => {
    mockNotificationAsync.mockClear().mockResolvedValue(undefined);
    mockSelectionAsync.mockClear().mockResolvedValue(undefined);
    mockImpactAsync.mockClear().mockResolvedValue(undefined);
    mockHapticsEnabled = true;
  });

  // ----------- AC-3：6 个 API 全部存在 -----------
  describe('AC-3 API surface', () => {
    it('导出 tick/success/warning/error/heavy/restComplete 6 个 API', () => {
      // 不能用 `haptic['tick']` —— TS 会展开；
      // 直接用 Reflect.ownKeys 做回归。
      const keys = Reflect.ownKeys(haptic).sort();
      // 老的 `selection()` 也保留（G13 兼容），所以一共 7 个。
      expect(keys).toEqual(
        ['error', 'heavy', 'restComplete', 'selection', 'success', 'tick', 'warning'],
      );
    });

    it('每个 API 都是 function', () => {
      expect(typeof haptic.tick).toBe('function');
      expect(typeof haptic.success).toBe('function');
      expect(typeof haptic.warning).toBe('function');
      expect(typeof haptic.error).toBe('function');
      expect(typeof haptic.heavy).toBe('function');
      expect(typeof haptic.restComplete).toBe('function');
    });

    it('保留 G13 旧签名 `selection()` 仍未删', () => {
      // 防回归：G13 现有 18+ 调用点用 `haptic.selection()`，新增时不能静默改名。
      expect(typeof haptic.selection).toBe('function');
    });
  });

  // ----------- AC-3 的另一半：关开关 → 全部 no-op -----------
  describe('hapticsEnabled = false 时全部 no-op', () => {
    beforeEach(() => {
      mockHapticsEnabled = false;
    });

    it('tick 不调 selectionAsync', () => {
      haptic.tick();
      expect(mockSelectionAsync).not.toHaveBeenCalled();
    });

    it('success/warning/error 都不调 notificationAsync', () => {
      haptic.success();
      haptic.warning();
      haptic.error();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
    });

    it('heavy 不调 impactAsync', () => {
      haptic.heavy();
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('restComplete 不调 impactAsync', () => {
      haptic.restComplete();
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('selection() (legacy) 也 no-op', () => {
      haptic.selection();
      expect(mockSelectionAsync).not.toHaveBeenCalled();
    });
  });

  // ----------- AC-4：开开关 → 路由正确 -----------
  describe('hapticsEnabled = true 时走正确路由', () => {
    it('tick → selectionAsync', () => {
      haptic.tick();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
      expect(mockNotificationAsync).not.toHaveBeenCalled();
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('success → notificationAsync(Success)', () => {
      haptic.success();
      expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockNotificationAsync).toHaveBeenCalledWith('success');
    });

    it('warning → notificationAsync(Warning)', () => {
      haptic.warning();
      expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockNotificationAsync).toHaveBeenCalledWith('warning');
    });

    it('error → notificationAsync(Error)', () => {
      haptic.error();
      expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockNotificationAsync).toHaveBeenCalledWith('error');
    });

    it('heavy → impactAsync(Heavy)', () => {
      haptic.heavy();
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith('heavy');
    });

    it('restComplete → impactAsync(Medium)（二次轻触是 setTimeout，本测同帧只验 Medium）', () => {
      haptic.restComplete();
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith('medium');
    });

    it('success 和 warning 用的是不同 type —— 防止"warning 误调为 success"', () => {
      haptic.success();
      haptic.warning();
      const types = mockNotificationAsync.mock.calls.map((c) => c[0]);
      expect(types).toEqual(['success', 'warning']);
    });
  });

  // ----------- 边界：catch 不吞错，仅忽略拒绝 -----------
  describe('原生层拒绝时静默（catch 链路）', () => {
    it('notificationAsync reject → 不抛', async () => {
      mockNotificationAsync.mockRejectedValueOnce(new Error('boom'));
      expect(() => haptic.success()).not.toThrow();
      // 让 microtask flush 确保 catch 已跑（Promise.catch 链）
      await Promise.resolve();
      await Promise.resolve();
    });

    it('selectionAsync reject → 不抛', async () => {
      mockSelectionAsync.mockRejectedValueOnce(new Error('boom'));
      expect(() => haptic.tick()).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('impactAsync reject → 不抛（heavy / restComplete 都覆盖）', async () => {
      mockImpactAsync.mockRejectedValueOnce(new Error('boom'));
      expect(() => haptic.heavy()).not.toThrow();
      expect(() => haptic.restComplete()).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
