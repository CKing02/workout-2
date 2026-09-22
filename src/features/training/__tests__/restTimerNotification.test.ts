/**
 * restTimerNotification 单测(2026-09-18 原生 ProgressBar 版)
 *
 * 验证:
 *  1. ensureChannelAndPermissions 在 Android 上正确调原生 ensureChannel +
 *     expo-notifications.getPermissionsAsync(权限已 granted → 不调 request)
 *  2. ensureChannelAndPermissions 未授权时主动 request
 *  3. ensureChannelAndPermissions module-level guard 防止重复 init
 *  4. ensureChannelAndPermissions 在 iOS 上整体跳过
 *  5. showOrUpdateRestTimerNotification 在 Android 上调原生 showOrUpdate,
 *     title 形如 "杠铃卧推 0:42"(动作名 + mm:ss);参数 4 个:rem/total/title/colorHex
 *  6. showOrUpdateRestTimerNotification exerciseName trim / 空串处理
 *  7. showOrUpdateRestTimerNotification mm:ss 格式化边界(0/9/60/90/3600)
 *  8. showOrUpdateRestTimerNotification 剩余秒数 < 0 / totalSec < 1 自动 clamp
 *  9. showOrUpdateRestTimerNotification 在 iOS 上 noop
 * 10. dismissRestTimerNotification 在 Android 上调原生 dismiss
 * 11. dismissRestTimerNotification 在 iOS 上 noop
 *
 * 注意:
 *  - 用 jest.isolateModules 让每个 it 重新载入模块,绕开 module-level guard
 *  - mock react-native 的 Platform.OS,默认 Android
 *  - mock expo-rest-timer-progress 本地模块(取代 expo-notifications.scheduleNotificationAsync)
 *  - mock expo-notifications 仅保留 getPermissionsAsync / requestPermissionsAsync / setNotificationHandler
 */

let mockPlatformOS: 'android' | 'ios' = 'android';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

/* ---- mock expo-rest-timer-progress(取代 expo-notifications.scheduleNotificationAsync) ---- */
const mockNativeEnsureChannel = jest.fn();
const mockNativeShow = jest.fn();
const mockNativeDismiss = jest.fn();

jest.mock('expo-rest-timer-progress', () => ({
  ensureChannel: (...args: unknown[]) => mockNativeEnsureChannel(...args),
  showOrUpdate: (...args: unknown[]) => mockNativeShow(...args),
  dismiss: (...args: unknown[]) => mockNativeDismiss(...args),
}));

/* ---- mock expo-notifications(只保留权限 + handler 两个) ---- */
const mockGetPerms = jest.fn();
const mockRequestPerms = jest.fn();
const mockSetHandler = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPerms(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPerms(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetHandler(...args),
}));

describe('G41 restTimerNotification (Android)', () => {
  beforeEach(() => {
    mockPlatformOS = 'android';
    mockNativeEnsureChannel.mockReset();
    mockNativeShow.mockReset();
    mockNativeDismiss.mockReset();
    mockGetPerms.mockReset();
    mockRequestPerms.mockReset();
    mockSetHandler.mockReset();
    // 默认权限已 granted → 不调 request
    mockGetPerms.mockResolvedValue({ status: 'granted' });
    mockRequestPerms.mockResolvedValue({ status: 'granted' });
    mockNativeEnsureChannel.mockResolvedValue(undefined);
    mockNativeShow.mockResolvedValue(undefined);
    mockNativeDismiss.mockResolvedValue(undefined);
  });

  it('ensureChannelAndPermissions:Android 上调原生 ensureChannel + 询问权限', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.ensureChannelAndPermissions();

    expect(mockNativeEnsureChannel).toHaveBeenCalledTimes(1);
    expect(mockGetPerms).toHaveBeenCalledTimes(1);
    // 已 granted → 不再 request
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('ensureChannelAndPermissions:未授权时主动 request', async () => {
    mockGetPerms.mockResolvedValue({ status: 'undetermined' });
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.ensureChannelAndPermissions();

    expect(mockNativeEnsureChannel).toHaveBeenCalledTimes(1);
    expect(mockGetPerms).toHaveBeenCalledTimes(1);
    expect(mockRequestPerms).toHaveBeenCalledTimes(1);
    expect(mockRequestPerms).toHaveBeenCalledWith({ android: {} });
  });

  it('ensureChannelAndPermissions:module-level guard 防止重复 init', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.ensureChannelAndPermissions();
    await mod.ensureChannelAndPermissions();
    await mod.ensureChannelAndPermissions();

    // 3 次调用,ensureChannel + getPerms 都只跑 1 次
    expect(mockNativeEnsureChannel).toHaveBeenCalledTimes(1);
    expect(mockGetPerms).toHaveBeenCalledTimes(1);
  });

  it('showOrUpdate:调原生 showOrUpdate,4 个参数(rem/total/title/colorHex)', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(45, 90, '杠铃卧推', '#FF6B35');

    expect(mockNativeShow).toHaveBeenCalledTimes(1);
    // 2026-09-22 起 title 只放动作名 —— mm:ss 由原生 <Chronometer> 画,不再是 title 的一部分
    expect(mockNativeShow).toHaveBeenCalledWith(45, 90, '杠铃卧推', '#FF6B35');
  });

  it('showOrUpdate:不传 exerciseName → title 兜底 "休息中"', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(45, 90, null, '#FF6B35');

    expect(mockNativeShow).toHaveBeenCalledWith(45, 90, '休息中', '#FF6B35');
  });

  it('showOrUpdate:exerciseName 前后空白自动 trim', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(45, 90, '  哑铃划船  ', '#FF6B35');

    expect(mockNativeShow).toHaveBeenCalledWith(45, 90, '哑铃划船', '#FF6B35');
  });

  it('showOrUpdate:空串 / 全空白 exerciseName → 当匿名处理,兜底 "休息中"', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(45, 90, '', '#FF6B35');

    expect(mockNativeShow).toHaveBeenCalledWith(45, 90, '休息中', '#FF6B35');
  });

  it('showOrUpdate:不传 colorHex → 第四参为 null(走 native 默认)', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(30, 60, '杠铃');

    expect(mockNativeShow).toHaveBeenCalledWith(30, 60, '杠铃', null);
  });

  it('showOrUpdate:秒数原样透传(原生 Chronometer 的 base 由它推导),不进 title', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    // mm:ss 的格式化 2026-09-22 起移到原生 <Chronometer>,JS 只负责把秒数原样传下去。
    // 边界值照旧要覆盖:原生按 elapsedRealtime() + remainingSec*1000 算起点,
    // 传错一个数量级就是倒计时差 1000 倍。
    await mod.showOrUpdateRestTimerNotification(0, 60, '杠铃', '#FF6B35');
    expect(mockNativeShow.mock.calls[0]).toEqual([0, 60, '杠铃', '#FF6B35']);

    await mod.showOrUpdateRestTimerNotification(9, 60, '杠铃', '#FF6B35');
    expect(mockNativeShow.mock.calls[1]).toEqual([9, 60, '杠铃', '#FF6B35']);

    await mod.showOrUpdateRestTimerNotification(60, 60, '杠铃', '#FF6B35');
    expect(mockNativeShow.mock.calls[2]).toEqual([60, 60, '杠铃', '#FF6B35']);

    await mod.showOrUpdateRestTimerNotification(90, 90, '杠铃', '#FF6B35');
    expect(mockNativeShow.mock.calls[3]).toEqual([90, 90, '杠铃', '#FF6B35']);

    await mod.showOrUpdateRestTimerNotification(3600, 3600, '杠铃', '#FF6B35');
    expect(mockNativeShow.mock.calls[4]).toEqual([3600, 3600, '杠铃', '#FF6B35']);
  });

  it('showOrUpdate:剩余秒数 < 0 自动 clamp 到 0', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(-10, 90, null, '#FF6B35');

    expect(mockNativeShow).toHaveBeenCalledWith(0, 90, '休息中', '#FF6B35');
  });

  it('showOrUpdate:totalSec < 1 自动 clamp 到 1', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(30, 0, null, '#FF6B35');

    expect(mockNativeShow).toHaveBeenCalledWith(30, 1, '休息中', '#FF6B35');
  });

  it('dismiss:调原生 dismiss(无参数)', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.dismissRestTimerNotification();

    expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
    expect(mockNativeDismiss).toHaveBeenCalledWith();
  });

  it('ensureChannel:原生 ensureChannel 抛错时静默吞掉 + 标记为 ensured', async () => {
    mockNativeEnsureChannel.mockRejectedValue(new Error('native channel failed'));
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    // 不应 throw
    await expect(mod.ensureChannelAndPermissions()).resolves.toBeUndefined();

    // 再次调用:channelAndPermissionsEnsured 应已 true,不再 nativeEnsureChannel
    await mod.ensureChannelAndPermissions();
    expect(mockNativeEnsureChannel).toHaveBeenCalledTimes(1);
  });
});

describe('G41 restTimerNotification (iOS — 本期不实现)', () => {
  beforeEach(() => {
    mockPlatformOS = 'ios';
    mockNativeEnsureChannel.mockReset();
    mockNativeShow.mockReset();
    mockNativeDismiss.mockReset();
    mockGetPerms.mockReset();
    mockRequestPerms.mockReset();
  });

  it('ensureChannel: iOS 上整体跳过', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.ensureChannelAndPermissions();

    expect(mockNativeEnsureChannel).not.toHaveBeenCalled();
    expect(mockGetPerms).not.toHaveBeenCalled();
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('showOrUpdate: iOS 上 noop', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(30, 90, 'x', '#FF6B35');

    expect(mockNativeShow).not.toHaveBeenCalled();
  });

  it('dismiss: iOS 上 noop', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.dismissRestTimerNotification();

    expect(mockNativeDismiss).not.toHaveBeenCalled();
  });
});