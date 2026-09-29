/**
 * G39 — CDN GIF 本地缓存管理器。
 *
 * 职责:
 *  - 把 https://... 的 GIF 下载到 Paths.cache/gifs/ 下,文件名 = URL basename
 *  - 命中缓存 → 直接返 file:// URI,秒开
 *  - 未命中 → 异步下载,文件名由 response headers / URL basename 决定
 *  - 缓存超 200MB → LRU(按 mtime 删最旧)直到低于阈值
 *  - 下载失败 → 返 null,UI 静默 fallback(Skeleton 持续)
 *
 * 为什么用 URL basename 而非 sha1:
 *  - File.downloadFileAsync(target: Directory) 会用 response headers 或
 *    URL basename 当文件名,所以我们顺着这个约定
 *  - URL basename 跟 hasaneyldrm 数据集 filename 一致,看到 `0025-EIeI8Vf.gif`
 *    就能反查是哪张动作,debug / 清理 cache 都直观
 *  - 防御性:文件名只保留 [a-zA-Z0-9._-],避免路径注入
 *
 * 平台注意:
 *  - iOS 上 Paths.cache 系统可在空间紧时清 → LRU 是 nice-to-have
 *  - Android 上一般 /data/data/.../cache,系统也会清
 *  - 真到 200MB 才触发 maybeEvict(留余量,通常系统早就清过了)
 *
 * 不依赖业务 store;只是个 util,可被任何下载 GIF 的场景复用。
 */

import { Directory, File, Paths } from 'expo-file-system';

/** 缓存根目录 — 系统可清理,所以 LRU 是 nice-to-have 而不是 must-have。 */
const CACHE_DIR = new Directory(Paths.cache, 'gifs');

/** LRU 触发阈值(字节)。1,324 × 98KB ≈ 130MB,200MB 留 ~50% 余量。 */
const MAX_CACHE_BYTES = 200 * 1024 * 1024;

/** 防御性白名单:只允许 [a-zA-Z0-9._-],避免路径注入 / 跨目录。 */
const SAFE_NAME_RE = /[^a-zA-Z0-9._-]/g;

/**
 * 从 URL 取 basename(末段路径),并做白名单清洗。
 *
 * 例:
 *   'https://pub-abc.r2.dev/workout2-gifs/exercises/0025-EIeI8Vf.gif' → '0025-EIeI8Vf.gif'
 *   'https://cdn/?token=x&file=foo.gif' → 'foo.gif'(丢 query)
 */
function basenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const cleaned = last.replace(SAFE_NAME_RE, '_');
    if (!cleaned || !cleaned.endsWith('.gif')) return null;
    return cleaned;
  } catch {
    return null;
  }
}

/** 单次保证缓存目录存在 — 幂等。 */
async function ensureDir(): Promise<void> {
  if (!CACHE_DIR.exists) {
    CACHE_DIR.create({ idempotent: true, intermediates: true });
  }
}

/**
 * 把缓存目录里的 .gif 按 mtime 升序删,直到总字节 < maxBytes。
 *
 * 例外:
 *  - 目录读取失败(目录不存在)→ 静默 no-op
 *  - 删除失败(权限)→ 跳过那个文件,继续删别的
 */
async function maybeEvict(): Promise<void> {
  if (!CACHE_DIR.exists) return;
  const items = CACHE_DIR.list();
  let total = 0;
  const files: { file: File; size: number; mtime: number }[] = [];
  for (const item of items) {
    if (!(item instanceof File)) continue;
    if (!item.name.endsWith('.gif')) continue;
    try {
      const info = item.info();
      const size = info.size ?? item.size ?? 0;
      const mtime = info.modificationTime ?? 0;
      total += size;
      files.push({ file: item, size, mtime });
    } catch {
      // info 失败的文件跳过,不当主目标
    }
  }
  if (total <= MAX_CACHE_BYTES) return;

  // 按 mtime 升序:最旧的先删
  files.sort((a, b) => a.mtime - b.mtime);
  for (const { file, size } of files) {
    if (total <= MAX_CACHE_BYTES) break;
    try {
      file.delete();
      total -= size;
    } catch {
      // 删失败(权限/不存在),继续下一个
    }
  }
}

/**
 * 命中缓存返 file:// URI;未命中下载后返;失败返 null(UI 静默 fallback)。
 *
 * 并发保护:
 *  - 同一 URL 多次并发调用会触发多次下载(File.downloadFileAsync 不去重);
 *    UI 层去重(在 ExerciseGifImage 里 cache promise),这里不另加锁。
 *  - 不同 URL 间互不影响。
 *
 * 网络失败 / 404 等:
 *  - File.downloadFileAsync 对非 2xx 抛 UnableToDownload(不写文件)
 *  - catch 之后返 null;UI 那边静默 Skeleton + 无限 retry 由用户下次进详情触发
 */
export async function getCachedOrDownload(url: string): Promise<string | null> {
  if (!url || !url.startsWith('http')) return null;
  const name = basenameFromUrl(url);
  if (!name) return null;
  await ensureDir();

  const cached = new File(CACHE_DIR, name);
  if (cached.exists) {
    return cached.uri;
  }

  try {
    // idempotent:true — 极端情况下(并发或重试)允许覆盖,避免 DestinationAlreadyExists
    const downloaded = await File.downloadFileAsync(url, CACHE_DIR, {
      idempotent: true,
    });
    await maybeEvict();
    return downloaded.uri;
  } catch (err) {
    if (__DEV__) {
      console.warn('[exerciseGifCache] download failed', url, err);
    }
    return null;
  }
}

/**
 * 暴露给「清除全部数据」流程:删整个缓存目录。
 *
 * 调用点：`@/features/profile/clearAllData.ts`。
 * （2026-09-29 才真正接上 —— 本函数从 G41 起就存在且注释声称属于该流程，
 *  但一直没有被任何地方调用，清数据后 GIF 缓存会残留。）
 */
export async function clearGifCache(): Promise<void> {
  if (!CACHE_DIR.exists) return;
  try {
    CACHE_DIR.delete();
  } catch (err) {
    if (__DEV__) {
      console.warn('[exerciseGifCache] clear failed', err);
    }
  }
}
