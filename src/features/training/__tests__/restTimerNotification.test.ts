/**
 * restTimerNotification 单测(2026-09-18 极简版)
 *
 * 验证:
 *  1. ensureChannelAndPermissions 在 Android 上正确建 channel + 申请权限
 *  2. ensureChannelAndPermissions 只跑一次(module-level guard)
 *  3. ensureChannelAndPermissions 在 iOS 上整体跳过
 *  4. showOrUpdateRestTimerNotification 在 Android 上调 scheduleNotificationAsync,
 *     identifier 固定,title 形如 "0:42 杠铃卧推"(mm:ss + 动作名),body 是 20 段块字符进度条(纯条,无比例数字)
 *  5. showOrUpdateRestTimerNotification 在 iOS 上 noop
 *  6. dismissRestTimerNotification 在 Android 上调 dismissNotificationAsync
 *  7. dismissRestTimerNotification 在 iOS 上 noop
 *  8. showOrUpdate 防御:剩余秒数 < 0 时 clamp 到 0;totalSec < 1 时 clamp 到 1
 *  9. 块字符进度条:0% / 50% / 100% 三个边界 + 比例正确
 * 10. mm:ss 格式化:0/60/90/3600 边界
 *
 * 注意:
 *  - 用 jest.isolateModules 让每个 it 重新载入模块,绕开 module-level guard
 *    (channelAndPermissionsEnsured = false 重置)
 *  - mock react-native 的 Platform.OS,默认 Android
 */

let mockPlatformOS: 'android' | 'ios' = 'android';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

const mockSchedule = jest.fn();
const mockDismiss = jest.fn();
const mockSetChannel = jest.fn();
const mockGetPerms = jest.fn();
const mockRequestPerms = jest.fn();
const mockSetHandler = jest.fn();

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    MIN: 1,
    LOW: 2,
    DEFAULT: 3,
    HIGH: 4,
  },
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
  getPermissionsAsync: (...args: unknown[]) => mockGetPerms(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPerms(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  dismissNotificationAsync: (...args: unknown[]) => mockDismiss(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetHandler(...args),
}));

describe('G38 restTimerNotification (Android)', () => {
  beforeEach(() => {
    mockPlatformOS = 'android';
    mockSchedule.mockReset();
    mockDismiss.mockReset();
    mockSetChannel.mockReset();
    mockGetPerms.mockReset();
    mockRequestPerms.mockReset();
    mockSetHandler.mockReset();
    // 默认权限已 granted → 不调 request
    mockGetPerms.mockResolvedValue({ status: 'granted' });
    mockRequestPerms.mockResolvedValue({ status: 'granted' });
    mockSetChannel.mockResolvedValue(undefined);
    mockSchedule.mockResolvedValue('notif-id');
    mockDismiss.mockResolvedValue(undefined);
  });

  it('ensureChannelAndPermissions:Android 上建 channel + 询问权限', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.ensureChannelAndPermissions();

    expect(mockSetChannel).toHaveBeenCalledTimes(1);
    const [channelId, channelConfig] = mockSetChannel.mock.calls[0];
    expect(channelId).toBe('rest_timer');
    expect(channelConfig).toMatchObject({
      name: '训练休息',
      importance: 4, // HIGH
      sound: null,
      showBadge: false,
    });
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

    // 3 次调用,channel 只建 1 次
    expect(mockSetChannel).toHaveBeenCalledTimes(1);
    expect(mockGetPerms).toHaveBeenCalledTimes(1);
  });

  it('showOrUpdate:调 scheduleNotificationAsync,identifier 固定,极简两行布局', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(45, 90);

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const call = mockSchedule.mock.calls[0][0];
    expect(call.identifier).toBe('rest_timer_notification');
    expect(call.trigger).toBeNull();
    // 极简版:title 只剩 mm:ss,无动作名时不追加
    expect(call.content.title).toBe('0:45');
    // body 是 20 段块字符进度条(纯条,无比例数字)
    // 45/90 = 50% → 10 filled,10 empty
    expect(call.content.body).toBe('██████████░░░░░░░░░░');
    expect(call.content.autoDismiss).toBe(false);
    expect(call.content.data).toMatchObject({
      kind: 'restTimer',
      remainingSec: 45,
      totalSec: 90,
    });
  });

  it('showOrUpdate:传 exerciseName → title 拼接"0:45 杠铃卧推",data 也带上', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(45, 90, '杠铃卧推');

    const call = mockSchedule.mock.calls[0][0];
    // title 是 mm:ss + 半角空格 + 动作名(单行紧凑)
    expect(call.content.title).toBe('0:45 杠铃卧推');
    // body 进度条不变
    expect(call.content.body).toBe('██████████░░░░░░░░░░');
    // data 里也带上,后续接 Live Activity / tap 跳转能用到
    expect(call.content.data.exerciseName).toBe('杠铃卧推');
  });

  it('showOrUpdate:exerciseName 前后空白自动 trim', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(45, 90, '  哑铃划船  ');

    const call = mockSchedule.mock.calls[0][0];
    expect(call.content.title).toBe('0:45 哑铃划船');
    expect(call.content.data.exerciseName).toBe('哑铃划船');
  });

  it('showOrUpdate:空串 / 全空白 exerciseName → 当匿名处理,不追加', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(45, 90, '');

    const call = mockSchedule.mock.calls[0][0];
    expect(call.content.title).toBe('0:45');
    expect(call.content.data.exerciseName).toBeNull();
  });

  it('showOrUpdate:mm:ss 格式化边界(0 / 9 / 60 / 90 / 3600)', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(0, 60, '杠铃');
    expect(mockSchedule.mock.calls[0][0].content.title).toBe('0:00 杠铃');

    await mod.showOrUpdateRestTimerNotification(9, 60, '杠铃');
    expect(mockSchedule.mock.calls[1][0].content.title).toBe('0:09 杠铃');

    await mod.showOrUpdateRestTimerNotification(60, 60, '杠铃');
    expect(mockSchedule.mock.calls[2][0].content.title).toBe('1:00 杠铃');

    await mod.showOrUpdateRestTimerNotification(90, 90, '杠铃');
    expect(mockSchedule.mock.calls[3][0].content.title).toBe('1:30 杠铃');

    await mod.showOrUpdateRestTimerNotification(3600, 3600, '杠铃');
    expect(mockSchedule.mock.calls[4][0].content.title).toBe('60:00 杠铃');
  });

  it('showOrUpdate:剩余秒数 < 0 自动 clamp 到 0', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(-10, 90);

    const call = mockSchedule.mock.calls[0][0];
    // 0% 进度 → 20 empty
    expect(call.content.title).toBe('0:00');
    expect(call.content.body).toBe('░░░░░░░░░░░░░░░░░░░░');
    expect(call.content.data.remainingSec).toBe(0);
  });

  it('showOrUpdate:块字符进度条 100% 全填', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(60, 60);

    const call = mockSchedule.mock.calls[0][0];
    expect(call.content.body).toBe('████████████████████');
  });

  it('showOrUpdate:totalSec < 1 自动 clamp 到 1', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(30, 0);

    const call = mockSchedule.mock.calls[0][0];
    expect(call.content.data.totalSec).toBe(1);
  });

  it('showOrUpdate:同一 identifier 重复调用 = 覆盖式', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(89, 90);
    await mod.showOrUpdateRestTimerNotification(88, 90);
    await mod.showOrUpdateRestTimerNotification(87, 90);

    expect(mockSchedule).toHaveBeenCalledTimes(3);
    // 每次都传同一 identifier,让 OS 覆盖而非新增
    for (const call of mockSchedule.mock.calls) {
      expect(call[0].identifier).toBe('rest_timer_notification');
    }
  });

  it('dismiss:调 dismissNotificationAsync + 固定 identifier', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.dismissRestTimerNotification();

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockDismiss).toHaveBeenCalledWith('rest_timer_notification');
  });

  it('ensureChannel:channel 抛错时静默吞掉 + 标记为 ensured(不无限重试)', async () => {
    mockSetChannel.mockRejectedValue(new Error('channel exists with different importance'));
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    // 不应 throw
    await expect(mod.ensureChannelAndPermissions()).resolves.toBeUndefined();

    // 再次调用:channelAndPermissionsEnsured 应已 true,不再 setChannel
    await mod.ensureChannelAndPermissions();
    expect(mockSetChannel).toHaveBeenCalledTimes(1);
  });
});

describe('G38 restTimerNotification (iOS — 本期不实现)', () => {
  beforeEach(() => {
    mockPlatformOS = 'ios';
    mockSchedule.mockReset();
    mockDismiss.mockReset();
    mockSetChannel.mockReset();
    mockGetPerms.mockReset();
    mockRequestPerms.mockReset();
  });

  it('ensureChannel: iOS 上整体跳过(channel / 权限都不调)', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.ensureChannelAndPermissions();

    expect(mockSetChannel).not.toHaveBeenCalled();
    expect(mockGetPerms).not.toHaveBeenCalled();
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('showOrUpdate: iOS 上 noop', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.showOrUpdateRestTimerNotification(30, 90);

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('dismiss: iOS 上 noop', async () => {
    let mod!: typeof import('../restTimerNotification');
    jest.isolateModules(() => {
      mod = require('../restTimerNotification');
    });

    await mod.dismissRestTimerNotification();

    expect(mockDismiss).not.toHaveBeenCalled();
  });
});