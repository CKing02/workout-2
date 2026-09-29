/**
 * 头像文件读写 —— 纯文件系统层，不依赖任何 store。
 *
 * 设计要点：
 *
 * 1. **文件是唯一真相。** 头像路径不进 SQLite 的 settings 表：
 *    `exportData.ts` 用 `listSettings()` 整表 dump、`importData.ts:210`
 *    还会 `DELETE FROM settings` 整表覆盖，把路径存进去等于让「导入一份旧备份」
 *    静默清掉/污染头像。放在文件系统里，「不参与备份」就成了结构性保证，
 *    而不是一条以后得记着维护的过滤规则。
 *
 * 2. **根目录是 Paths.document，不是 Paths.cache。**
 *    cache 会被系统在空间紧张时清掉（见 `Paths.d.ts` 的注释），头像会莫名消失。
 *    和导出备份同级（`exportData.ts:163` 也写 document）。
 *
 * 3. **文件名唯一（`avatar-<ts>.<ext>`）+ 扫目录清理**，而不是固定名覆盖。
 *    `expo-image` 按 source **URI 字符串**做内存/磁盘缓存键，固定名覆盖后
 *    UI 会继续显示旧图 —— 这个 bug 只有真机才能发现。唯一文件名让 URI 本身
 *    每次变化，从原理上不可能踩到缓存；代价只是多一次目录扫描。
 *    副产品：URI 始终是个真路径，不会被查询串（`?v=`）绊倒。
 *
 * 4. **写入走 `bytes()` + `write()`，不走 `copy()`。**
 *    这是唯一一条对 `file://`（picker 的 cache 副本）和 `content://`
 *    （部分 ContentProvider）都成立的路径 —— 它经 `ContentResolver.openInputStream`，
 *    正是 `SettingsScreen.tsx:195-199` 为绕开 Android 16 上 expo #32706 而采用的机制。
 *
 * 全部函数失败时静默返回 null / no-op，绝不抛 —— 调用方是 UI 动作，
 * 不该因为文件系统抖动而崩。
 */

import { Directory, File, Paths } from 'expo-file-system';

/** document 下的头像子目录名。 */
const AVATAR_DIR_NAME = 'avatars';

/** 文件名前缀 —— 清理时只认自己写的文件，不碰目录里的其它东西。 */
const AVATAR_PREFIX = 'avatar-';

/**
 * 每次调用都新建 Directory 实例，不在模块顶层建。
 *
 * 不为性能（开销可忽略），而是为了可测：模块顶层 `new Directory()` 属于
 * 顶层副作用，会让测试必须在 `jest.mock` 之后用 `require()` 延迟加载
 * （`exerciseGifCache.test.ts:143-147` 记录的坑）。这里避开它。
 */
function avatarDir(): Directory {
  return new Directory(Paths.document, AVATAR_DIR_NAME);
}

/** 单次保证目录存在 —— 幂等。 */
function ensureDir(): void {
  const dir = avatarDir();
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
}

/**
 * 从源 URI 猜扩展名。
 *
 * `allowsEditing: true` 的裁剪路径通常会重编码成 JPEG，所以猜不准也无所谓 ——
 * expo-image 按内容识别，扩展名只是给人看的。
 */
function extFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]{1,5})(?:\?|#|$)/.exec(uri);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

/** 列出目录里所有头像文件（不递归，只要我们的前缀）。 */
function listAvatarFiles(): File[] {
  const dir = avatarDir();
  if (!dir.exists) return [];
  try {
    return dir
      .list()
      .filter((item): item is File => item instanceof File)
      .filter((file) => file.name.startsWith(AVATAR_PREFIX));
  } catch (err) {
    if (__DEV__) console.warn('[avatar] list failed', err);
    return [];
  }
}

/**
 * 删除除 `keep` 外的所有头像文件。
 *
 * 扫整个目录而不是只删「已知的上一个」：如果上次崩在 write 和 delete 之间，
 * 目录里会留两个文件，扫一遍才能自愈。单个删除失败不影响其它文件。
 */
function sweepExcept(keep: File | null): void {
  for (const file of listAvatarFiles()) {
    if (keep && file.uri === keep.uri) continue;
    try {
      file.delete();
    } catch (err) {
      // 删不掉就留着，下次 load 还会再扫一遍。不值得报错。
      if (__DEV__) console.warn('[avatar] sweep failed', err);
    }
  }
}

export interface StoredAvatar {
  /** 可直接喂给 expo-image 的 `file://` URI。 */
  uri: string;
}

/**
 * 读当前头像。
 *
 * 目录里有多个文件时取 `lastModified` 最大的（唯一文件名方案下正常只会有一个）。
 */
export async function getStoredAvatar(): Promise<StoredAvatar | null> {
  const files = listAvatarFiles();
  if (files.length === 0) return null;

  let newest: File | null = null;
  let newestAt = -1;
  for (const file of files) {
    // lastModified 为 null 表示文件不可读 —— 当它不存在。
    const at = file.lastModified ?? -1;
    if (at > newestAt) {
      newestAt = at;
      newest = file;
    }
  }
  if (!newest) return null;

  // 顺手清掉旧文件和不可读的残留。
  if (files.length > 1) sweepExcept(newest);

  return { uri: newest.uri };
}

/**
 * 把 `sourceUri` 拷进 app 目录，返回新的头像 URI。
 *
 * `sourceUri` 通常是 expo-image-picker 给的 cache 目录副本 —— 系统随时可能清掉，
 * 所以必须立刻落到 document 下，绝不能把 picker 返回的 URI 直接存下来用。
 *
 * 失败返回 null（调用方保持旧头像），不抛。
 */
export async function saveAvatar(sourceUri: string): Promise<StoredAvatar | null> {
  try {
    ensureDir();

    const source = new File(sourceUri);
    const bytes = await source.bytes();

    // 唯一文件名。Date.now() 足够 —— 人手操作不可能在同一毫秒内选两次图；
    // 真撞上了也不过是覆盖同名文件，sweep 之后状态依然一致。
    const dest = new File(avatarDir(), `${AVATAR_PREFIX}${Date.now()}${extFromUri(sourceUri)}`);

    // write 会创建文件；传 Uint8Array 走二进制，不做编码转换。
    dest.write(bytes);

    // 写完再清旧的 —— 中途失败时新文件已经在了，load 能自愈。
    sweepExcept(dest);

    return { uri: dest.uri };
  } catch (err) {
    if (__DEV__) console.warn('[avatar] save failed', err);
    return null;
  }
}

/**
 * 删除所有头像文件（保留目录）。
 *
 * 文件本来就不存在时静默 no-op —— 「恢复默认头像」在无头像状态下被调用
 * 不该报错。
 */
export async function clearAvatar(): Promise<void> {
  sweepExcept(null);
}

/** 给测试 / 断言用的存在性检查。 */
export function avatarExists(): boolean {
  return listAvatarFiles().length > 0;
}
