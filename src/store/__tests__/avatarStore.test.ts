/**
 * avatarStore 测试。
 *
 * 被测的是「串起来」这件事：file 层与 picker 层各自都单独测过了
 * （`avatarFile.test.ts` / `avatarPicker.test.ts`），这里只钉 store 的编排 ——
 * 什么时候该动 state、什么时候不该动、失败时会不会把旧头像搞没。
 *
 * ⚠️ 不要整体 mock `expo-modules-core`（原因见 avatarFile.test.ts 顶部）。
 */

import { useToastStore } from '@/hooks/useToast';

const mockGetStoredAvatar = jest.fn();
const mockSaveAvatar = jest.fn();
const mockClearAvatar = jest.fn();
const mockPickAvatarFromLibrary = jest.fn();

jest.mock('@/utils/avatarFile', () => ({
  __esModule: true,
  getStoredAvatar: (...a: unknown[]) => mockGetStoredAvatar(...a),
  saveAvatar: (...a: unknown[]) => mockSaveAvatar(...a),
  clearAvatar: (...a: unknown[]) => mockClearAvatar(...a),
}));

jest.mock('@/utils/avatarPicker', () => ({
  __esModule: true,
  pickAvatarFromLibrary: (...a: unknown[]) => mockPickAvatarFromLibrary(...a),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useAvatarStore } = require('@/store/avatarStore') as typeof import('@/store/avatarStore');

let showSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  showSpy = jest.spyOn(useToastStore.getState(), 'show').mockImplementation(() => {});
  useAvatarStore.getState().resetForTests();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('G-avatar avatarStore', () => {
  describe('load', () => {
    it('有文件 → uri 就位，loaded = true', async () => {
      mockGetStoredAvatar.mockResolvedValue({ uri: 'file:///a/avatar-1.jpg' });
      await useAvatarStore.getState().load();
      expect(useAvatarStore.getState().uri).toBe('file:///a/avatar-1.jpg');
      expect(useAvatarStore.getState().loaded).toBe(true);
    });

    it('没有文件 → uri = null，loaded 仍然置位（不卡在未加载态）', async () => {
      mockGetStoredAvatar.mockResolvedValue(null);
      await useAvatarStore.getState().load();
      expect(useAvatarStore.getState().uri).toBeNull();
      expect(useAvatarStore.getState().loaded).toBe(true);
    });

    it('读文件抛异常 → 吞掉，回落 null，不向上抛', async () => {
      mockGetStoredAvatar.mockRejectedValue(new Error('fs boom'));
      await expect(useAvatarStore.getState().load()).resolves.toBeUndefined();
      expect(useAvatarStore.getState().uri).toBeNull();
      expect(useAvatarStore.getState().loaded).toBe(true);
    });
  });

  describe('pickFromLibrary', () => {
    it('成功 → 用 picker 给的 uri 调 saveAvatar，state 换成新 uri', async () => {
      mockPickAvatarFromLibrary.mockResolvedValue('file:///cache/pick.jpg');
      mockSaveAvatar.mockResolvedValue({ uri: 'file:///doc/avatar-9.jpg' });

      await useAvatarStore.getState().pickFromLibrary();

      expect(mockSaveAvatar).toHaveBeenCalledWith('file:///cache/pick.jpg');
      expect(useAvatarStore.getState().uri).toBe('file:///doc/avatar-9.jpg');
    });

    it('用户取消（picker 返回 null）→ 什么都不做，不 toast，不落盘', async () => {
      useAvatarStore.setState({ uri: 'file:///doc/old.jpg' });
      mockPickAvatarFromLibrary.mockResolvedValue(null);

      await useAvatarStore.getState().pickFromLibrary();

      expect(mockSaveAvatar).not.toHaveBeenCalled();
      expect(useAvatarStore.getState().uri).toBe('file:///doc/old.jpg');
      expect(showSpy).not.toHaveBeenCalled();
    });

    it('落盘失败 → 保留旧头像 + error toast（不能把已有头像搞没）', async () => {
      useAvatarStore.setState({ uri: 'file:///doc/old.jpg' });
      mockPickAvatarFromLibrary.mockResolvedValue('file:///cache/pick.jpg');
      mockSaveAvatar.mockResolvedValue(null);

      await useAvatarStore.getState().pickFromLibrary();

      expect(useAvatarStore.getState().uri).toBe('file:///doc/old.jpg');
      expect(showSpy).toHaveBeenCalledWith(
        expect.stringContaining('头像保存失败'),
        expect.anything(),
      );
    });

    it('saveAvatar 抛异常也不向上冒（兜底；且旧头像仍在）', async () => {
      useAvatarStore.setState({ uri: 'file:///doc/old.jpg' });
      mockPickAvatarFromLibrary.mockResolvedValue('file:///cache/pick.jpg');
      mockSaveAvatar.mockRejectedValue(new Error('boom'));

      await expect(useAvatarStore.getState().pickFromLibrary()).resolves.toBeUndefined();

      expect(useAvatarStore.getState().uri).toBe('file:///doc/old.jpg');
      expect(showSpy).toHaveBeenCalledWith(
        expect.stringContaining('头像保存失败'),
        expect.anything(),
      );
    });
  });

  describe('clear', () => {
    it('删文件 + uri 归 null', async () => {
      useAvatarStore.setState({ uri: 'file:///doc/old.jpg' });
      mockClearAvatar.mockResolvedValue(undefined);

      await useAvatarStore.getState().clear();

      expect(mockClearAvatar).toHaveBeenCalledTimes(1);
      expect(useAvatarStore.getState().uri).toBeNull();
    });
  });
});
