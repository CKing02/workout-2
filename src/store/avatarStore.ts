/**
 * avatarStore — 用户自定义头像的内存投影。
 *
 * **数据源是文件系统，不是数据库。** 头像图片存在
 * `Paths.document/avatars/` 下，本 store 只是把「当前是哪个文件」投影成
 * 可订阅的 state，好让 UI 能响应变化（和 settingsStore 的 `loaded` 套路一致）。
 *
 * 为什么不走 `settings` 表：`exportData.ts` 用 `listSettings()` 整表 dump、
 * `importData.ts:210` 又 `DELETE FROM settings` 整表覆盖 —— 存进去的话
 * 「导入一份旧备份」会静默清掉或污染头像。放在文件系统里，
 * 「不参与导出/导入」是结构性保证，而不是要一直记着维护的过滤规则。
 *
 * 生命周期：
 *  - `load()`   —— App 启动时由 `App.tsx` 的 DatabaseBootstrap 调一次
 *  - `pickFromLibrary()` —— 唯一的写入口，串起「拉起相册 → 落盘 → 更新 state」
 *  - `clear()`  —— 「清除全部数据」调用，删文件 + 清 state
 *
 * 所有方法都**不抛**：头像失败不该让 App 崩，最坏情况是回落到首字符圆圈。
 */

import { create } from 'zustand';

import { toast } from '@/hooks/useToast';
import { clearAvatar, getStoredAvatar, saveAvatar } from '@/utils/avatarFile';
import { pickAvatarFromLibrary } from '@/utils/avatarPicker';

export interface AvatarState {
  /** 当前头像的 `file://` URI；没有头像时为 null（UI 回落首字符）。 */
  uri: string | null;
  /** load() 是否跑过一次。 */
  loaded: boolean;

  load: () => Promise<void>;
  /** 拉起相册 → 落盘 → 更新 state。用户取消或失败时保持原头像。 */
  pickFromLibrary: () => Promise<void>;
  /** 恢复默认头像（删除文件）。 */
  clear: () => Promise<void>;

  resetForTests: () => void;
}

const DEFAULTS = {
  uri: null as string | null,
  loaded: false,
};

export const useAvatarStore = create<AvatarState>((set) => ({
  ...DEFAULTS,

  load: async () => {
    try {
      const stored = await getStoredAvatar();
      set({ uri: stored?.uri ?? null, loaded: true });
    } catch (err) {
      // 读不到就是没有头像 —— 回落首字符，不打扰用户。
      if (__DEV__) console.warn('[avatar] load failed', err);
      set({ uri: null, loaded: true });
    }
  },

  pickFromLibrary: async () => {
    const sourceUri = await pickAvatarFromLibrary();
    // null = 用户取消，或 picker 已经 toast 过了。两种情况都不动 state。
    if (!sourceUri) return;

    // saveAvatar 自己已经把失败折成 null，这里的 try 是兜底：文件层以后要是被人
    // 改出个会抛的分支，也不该让它冒到 UI 变成未处理的 promise rejection。
    let saved: Awaited<ReturnType<typeof saveAvatar>> = null;
    try {
      saved = await saveAvatar(sourceUri);
    } catch (err) {
      if (__DEV__) console.warn('[avatar] save failed', err);
    }
    if (!saved) {
      toast.show('头像保存失败，请重试', 'error');
      return;
    }
    set({ uri: saved.uri });
  },

  clear: async () => {
    await clearAvatar();
    set({ uri: null });
  },

  resetForTests: () => {
    set({ ...DEFAULTS });
  },
}));
