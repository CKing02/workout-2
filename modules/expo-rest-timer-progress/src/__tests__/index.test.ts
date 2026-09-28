/**
 * expo-rest-timer-progress 单元测试 — JS 端包装
 *
 * 验证:
 *   1. iOS 上 ensureChannel / showOrUpdate / dismiss 全部 noop
 *   2. Android 上 3 个函数都正确转发到 native module,参数不变
 */

let mockPlatformOS: 'android' | 'ios' = 'android';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

const mockEnsureChannel = jest.fn();
const mockShow = jest.fn();
const mockDismiss = jest.fn();

jest.mock('expo-modules-core', () => ({
  requireNativeModule: () => ({
    ensureChannel: (...args: unknown[]) => mockEnsureChannel(...args),
    show: (...args: unknown[]) => mockShow(...args),
    dismiss: (...args: unknown[]) => mockDismiss(...args),
  }),
}));

describe('expo-rest-timer-progress', () => {
  beforeEach(() => {
    mockPlatformOS = 'android';
    mockEnsureChannel.mockReset();
    mockShow.mockReset();
    mockDismiss.mockReset();
    mockEnsureChannel.mockResolvedValue(undefined);
    mockShow.mockResolvedValue(undefined);
    mockDismiss.mockResolvedValue(undefined);
  });

  it('Android: ensureChannel 转发到 native', async () => {
    let mod!: typeof import('../index');
    jest.isolateModules(() => {
      mod = require('../index');
    });
    await mod.ensureChannel();
    expect(mockEnsureChannel).toHaveBeenCalledTimes(1);
  });

  it('Android: showOrUpdate 转发 (rem, total, title, colorHex)', async () => {
    let mod!: typeof import('../index');
    jest.isolateModules(() => {
      mod = require('../index');
    });
    await mod.showOrUpdate(45, 90, '杠铃卧推 0:45', '#FF6B35');
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith(45, 90, '杠铃卧推 0:45', '#FF6B35');
  });

  it('Android: showOrUpdate 支持 colorHex=null', async () => {
    let mod!: typeof import('../index');
    jest.isolateModules(() => {
      mod = require('../index');
    });
    await mod.showOrUpdate(30, 60, '0:30', null);
    expect(mockShow).toHaveBeenCalledWith(30, 60, '0:30', null);
  });

  it('Android: dismiss 转发', async () => {
    let mod!: typeof import('../index');
    jest.isolateModules(() => {
      mod = require('../index');
    });
    await mod.dismiss();
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('expo-rest-timer-progress (iOS — noop)', () => {
  beforeEach(() => {
    mockPlatformOS = 'ios';
    mockEnsureChannel.mockReset();
    mockShow.mockReset();
    mockDismiss.mockReset();
  });

  it('iOS: ensureChannel / show / dismiss 全部 noop', async () => {
    let mod!: typeof import('../index');
    jest.isolateModules(() => {
      mod = require('../index');
    });
    await mod.ensureChannel();
    await mod.showOrUpdate(45, 90, 'x', '#fff');
    await mod.dismiss();
    expect(mockEnsureChannel).not.toHaveBeenCalled();
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
  });
});