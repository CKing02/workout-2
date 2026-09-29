/**
 * expo-rest-timer-progress 单元测试 — JS 端包装
 *
 * 验证:
 *   1. iOS 上 ensureChannel / showOrUpdate / dismiss / consumeExpired 全部 noop
 *   2. Android 上 4 个函数都正确转发到 native module,参数不变
 *   3. consumeExpired 把原生返回值透传给调用方(见下)
 *
 * ⚠️ **`expo-modules-core` 不能整体 mock** —— 踩过的坑,别回退:
 *
 *   jest.mock('expo-modules-core', () => ({ requireNativeModule: () => ({...}) }))
 *
 *   这样写会让**所有** native module 名都拿到同一个假对象,包括 expo 自己在
 *   winter runtime 里查的 `ExpoFetchModule` —— 于是
 *   `FetchResponse.ts` 的基类变成 undefined,加载期就炸:
 *
 *     TypeError: Super expression must either be null or a function
 *       at _inherits (@babel/runtime/helpers/inherits.js)
 *       at expo/src/winter/fetch/FetchResponse.ts
 *
 *   症状具有欺骗性:整个 suite「failed to run」,0 个用例跑,**看起来像环境问题**,
 *   实际是这个 mock 写法的锅。而且因为 suite 从来没跑起来过,它一直在静默掩盖真实覆盖缺口。
 *
 *   正确写法:**按名字分派** —— 只有 `'RestTimerProgress'` 走假对象,其余名字
 *   交给真实的 `requireNativeModule`(它自己在缺 native 时只会 warn,不会炸)。
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
const mockConsumeExpired = jest.fn();

jest.mock('expo-modules-core', () => {
  const actual = jest.requireActual('expo-modules-core');
  return {
    ...actual,
    requireNativeModule: (name: string) =>
      name === 'RestTimerProgress'
        ? {
            ensureChannel: (...args: unknown[]) => mockEnsureChannel(...args),
            show: (...args: unknown[]) => mockShow(...args),
            dismiss: (...args: unknown[]) => mockDismiss(...args),
            consumeExpired: (...args: unknown[]) => mockConsumeExpired(...args),
          }
        : // 其余 native module(如 expo winter runtime 的 ExpoFetchModule)
          // 必须走真实实现,否则会把 expo 自己的加载链打断 —— 见文件头注释。
          actual.requireNativeModule(name),
  };
});

/** 每个用例都在 isolateModules 里重新 require，确保读到当前的 mockPlatformOS。 */
function loadModule(): typeof import('../index') {
  let mod!: typeof import('../index');
  jest.isolateModules(() => {
    mod = require('../index');
  });
  return mod;
}

describe('expo-rest-timer-progress', () => {
  beforeEach(() => {
    mockPlatformOS = 'android';
    mockEnsureChannel.mockReset();
    mockShow.mockReset();
    mockDismiss.mockReset();
    mockConsumeExpired.mockReset();
    mockEnsureChannel.mockResolvedValue(undefined);
    mockShow.mockResolvedValue(undefined);
    mockDismiss.mockResolvedValue(undefined);
    mockConsumeExpired.mockResolvedValue(0);
  });

  it('Android: ensureChannel 转发到 native', async () => {
    const mod = loadModule();
    await mod.ensureChannel();
    expect(mockEnsureChannel).toHaveBeenCalledTimes(1);
  });

  it('Android: showOrUpdate 转发 (rem, total, title, colorHex)', async () => {
    const mod = loadModule();
    await mod.showOrUpdate(45, 90, '杠铃卧推 0:45', '#FF6B35');
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith(45, 90, '杠铃卧推 0:45', '#FF6B35');
  });

  it('Android: showOrUpdate 支持 colorHex=null', async () => {
    const mod = loadModule();
    await mod.showOrUpdate(30, 60, '0:30', null);
    expect(mockShow).toHaveBeenCalledWith(30, 60, '0:30', null);
  });

  it('Android: dismiss 转发', async () => {
    const mod = loadModule();
    await mod.dismiss();
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('Android: consumeExpired 转发并透传原生返回值', async () => {
    // 非 0 = receiver 在后台已经写过「到点」标记，调用方据此翻 idle。
    mockConsumeExpired.mockResolvedValue(1783456789012);
    const mod = loadModule();
    await expect(mod.consumeExpired()).resolves.toBe(1783456789012);
    expect(mockConsumeExpired).toHaveBeenCalledTimes(1);
  });

  it('Android: consumeExpired 无到点事件时返回 0', async () => {
    // 0 = 没发生过 receiver 唤起，调用方走正常 RAF tick 路径。
    mockConsumeExpired.mockResolvedValue(0);
    const mod = loadModule();
    await expect(mod.consumeExpired()).resolves.toBe(0);
  });
});

describe('expo-rest-timer-progress (iOS — noop)', () => {
  beforeEach(() => {
    mockPlatformOS = 'ios';
    mockEnsureChannel.mockReset();
    mockShow.mockReset();
    mockDismiss.mockReset();
    mockConsumeExpired.mockReset();
  });

  it('iOS: ensureChannel / show / dismiss / consumeExpired 全部 noop', async () => {
    const mod = loadModule();
    await mod.ensureChannel();
    await mod.showOrUpdate(45, 90, 'x', '#fff');
    await mod.dismiss();
    // iOS 上没有原生模块，必须返回 0 而不是抛错 —— 调用方按「无到点事件」处理。
    await expect(mod.consumeExpired()).resolves.toBe(0);
    expect(mockEnsureChannel).not.toHaveBeenCalled();
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockConsumeExpired).not.toHaveBeenCalled();
  });
});
