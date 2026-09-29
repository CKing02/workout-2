/**
 * 相册选图 —— 只管「拉起系统相册拿一个 URI」，不碰 store、不碰文件。
 *
 * 为什么要独立成一个模块（而不是塞进 avatarStore）：
 * 它和 `features/training/restTimerNotification.ts` 是同一类东西 —— 与原生
 * 能力打交道的边界层，出了错要在这里收口，别让调用方去 try/catch。
 *
 * ## 为什么不预申请相册权限
 *
 * Android 侧两条路都不需要存储权限：
 *  - Android 13+ 走系统 Photo Picker
 *  - 老版本走 `Intent(ACTION_GET_CONTENT).addCategory(CATEGORY_OPENABLE)`
 *    （见 `expo-image-picker/android/.../contracts/ImageLibraryContract.kt:115`）
 *    —— 由系统选择器按 URI 逐次授权
 *
 * 所以这里**故意不调** `requestMediaLibraryPermissionsAsync()`：那会在
 * Android ≤12 上白白弹一个 `READ_EXTERNAL_STORAGE` 授权框，而用户明确要的是
 * 「只要相册」的干净路径。（本模块第一版上线后若在 ColorOS 上发现选择器打不开，
 * 再补权限申请 —— 先按理论上正确的做法试。）
 *
 * ## API 依据
 *
 * `AGENTS.md` 要求照 v57 版本文档写，但本环境 docs.expo.dev 被网络策略挡住，
 * 故以下均取自装到本地的 `node_modules/expo-image-picker/build/*.d.ts`：
 *  - `launchImageLibraryAsync(options?): Promise<ImagePickerResult>`（ImagePicker.d.ts:96）
 *  - `MediaType = 'images' | 'videos' | 'livePhotos'`（ImagePicker.types.d.ts:48）
 *    → `mediaTypes: ['images']`；`MediaTypeOptions` 枚举已标 `@deprecated`（:19-21）
 *  - 取消字段是 `canceled`（一个 l，:342 / :355），**不是** `cancelled`
 *  - `assets[].uri`（:230-234）
 *  - `shape?: CropShape = 'rectangle' | 'oval'`（:374）存在，但**不用** ——
 *    方形裁剪 + 渲染层圆形遮罩才是对的；oval 裁出来的图再撑满圆形容器会变形
 */

import * as ImagePicker from 'expo-image-picker';

import { toast } from '@/hooks/useToast';

/**
 * 重入保护。
 *
 * 和 `restTimerNotification.ts:73` 的 module 级 guard 形状相同，但语义不同：
 * 那个是「一次性初始化，失败也别再试」，这里是「用户动作，别让他连点弹出两个
 * 相册」。所以**不**在失败后永久置位 —— 用户可能去系统设置里授权再回来，
 * 那时必须还能再试。
 */
let picking = false;

/**
 * 拉起系统相册，返回选中图片的 URI；取消或失败返回 null。
 *
 * 返回的 URI 大概率指向 app cache 目录（picker 会先拷一份过来），
 * 系统随时可能清 —— **调用方必须立刻把它落到 document 下**
 * （见 `avatarFile.saveAvatar`），不能直接存下来用。
 *
 * 用户主动取消不是错误：静默返回 null，不 toast
 * （同 `SettingsScreen.tsx:186-189` 对 DocumentPicker 取消的处理）。
 */
export async function pickAvatarFromLibrary(): Promise<string | null> {
  if (picking) return null;
  picking = true;
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      // 只出图片，不出视频。
      mediaTypes: ['images'],
      // 方形裁剪：头像要的，顺带把文件压到可控大小。
      allowsEditing: true,
      aspect: [1, 1],
      // 0.8 足够，头像没必要存原图；也降低 bytes() 进 JS 内存的体积。
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    if (!asset?.uri) {
      toast.show('没有取到图片，请重试', 'error');
      return null;
    }
    return asset.uri;
  } catch (err) {
    // 原生模块缺失（装了没重打 APK）、OEM 挡住了选择器 —— 都走这里。
    strongWarn(err);
    const msg = err instanceof Error ? err.message : String(err);
    toast.show(`打开相册失败：${msg}`, 'error');
    return null;
  } finally {
    picking = false;
  }
}

/** 只在 __DEV__ 下打日志，生产静默（同 `restTimerNotification.ts:93-98`）。 */
function strongWarn(err: unknown): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[avatar] launchImageLibraryAsync failed', err);
  }
}
