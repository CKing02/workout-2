/**
 * avatarPicker 测试。
 *
 * toast 不改模块 mock，而是直接 spy 真实 store 的方法 —— `toast.show` 是个
 * 绑到 Zustand 单例上的稳定对象（`useToast.ts` 末尾），
 * `jest.spyOn(useToastStore.getState(), 'show')` 就能拦到，既不用整体 mock 掉
 * 这个模块（那样会连带影响 `useToastStore` / `useToastDismiss` 的其它消费者），
 * 也能顺带验证真实的那层转发。
 *
 * ⚠️ 不要整体 mock `expo-modules-core`（原因见 avatarFile.test.ts 顶部）。
 */

import { useToastStore } from '@/hooks/useToast';

const mockLaunchImageLibraryAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pickAvatarFromLibrary } =
  require('@/utils/avatarPicker') as typeof import('@/utils/avatarPicker');

/** 成功结果。 */
function okResult(uri = 'file:///mock/Cache/ImagePicker/pick.jpg') {
  return {
    canceled: false,
    assets: [{ uri, width: 800, height: 800 }],
  };
}

let showSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  showSpy = jest.spyOn(useToastStore.getState(), 'show').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('G-avatar avatarPicker', () => {
  it('成功 → 返回 assets[0].uri', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue(okResult('file:///a/b.jpg'));
    expect(await pickAvatarFromLibrary()).toBe('file:///a/b.jpg');
  });

  it('传参符合约定（只出图片 / 方形裁剪 / 不传相机相关）', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue(okResult());
    await pickAvatarFromLibrary();

    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledTimes(1);
    const opts = mockLaunchImageLibraryAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.mediaTypes).toEqual(['images']);
    expect(opts.allowsEditing).toBe(true);
    expect(opts.aspect).toEqual([1, 1]);
    expect(opts.quality).toBe(0.8);
    expect(opts.allowsMultipleSelection).toBe(false);
    // 决策：只做相册，不引入相机入口。
    expect(opts).not.toHaveProperty('cameraType');
  });

  it('不预申请任何权限 —— 直接拉起选择器', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue(okResult());
    await pickAvatarFromLibrary();
    // expo-image-picker 的权限 API 在本 mock 里根本没提供；实现里若调用了
    // 就会因为 undefined 而抛。走到这里说明实现确实没有碰权限。
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });

  describe('取消 / 异常路径', () => {
    it('用户取消 → null，不 toast', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
      expect(await pickAvatarFromLibrary()).toBeNull();
      expect(showSpy).not.toHaveBeenCalled();
    });

    it('assets 为空数组 → null + error toast', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [] });
      expect(await pickAvatarFromLibrary()).toBeNull();
      expect(showSpy).toHaveBeenCalledWith(expect.stringContaining('没有取到图片'), expect.anything());
    });

    it('assets[0] 没有 uri → null + error toast', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ width: 1, height: 1 }],
      });
      expect(await pickAvatarFromLibrary()).toBeNull();
      expect(showSpy).toHaveBeenCalled();
    });

    it('原生模块抛异常（例如装了依赖但没重打 APK）→ null + toast，不向上抛', async () => {
      mockLaunchImageLibraryAsync.mockRejectedValue(new Error('module not found'));
      await expect(pickAvatarFromLibrary()).resolves.toBeNull();
      expect(showSpy).toHaveBeenCalledWith(
        expect.stringContaining('打开相册失败'),
        expect.anything(),
      );
    });
  });

  it('重入保护：上一次还没结束时的第二次调用直接返回 null，且不再拉起选择器', async () => {
    let release: (v: unknown) => void = () => {};
    mockLaunchImageLibraryAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const first = pickAvatarFromLibrary();
    // 第一次还挂着 —— 此时第二次应当被 guard 挡掉
    expect(await pickAvatarFromLibrary()).toBeNull();
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledTimes(1);

    release(okResult('file:///a/first.jpg'));
    expect(await first).toBe('file:///a/first.jpg');
  });

  it('guard 不是一次性的 —— 用户取消后还能再试', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: null });
    expect(await pickAvatarFromLibrary()).toBeNull();

    mockLaunchImageLibraryAsync.mockResolvedValueOnce(okResult('file:///a/second.jpg'));
    expect(await pickAvatarFromLibrary()).toBe('file:///a/second.jpg');
  });
});
