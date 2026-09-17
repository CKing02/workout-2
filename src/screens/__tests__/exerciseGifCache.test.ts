/**
 * G39 — exerciseGifCache 单测。
 *
 * 覆盖 getCachedOrDownload 主路径(缓存命中 / 未命中 / 失败)+ clearGifCache
 * + URL basename 清洗防御。expo-file-system 用 jest.mock 自实现 fake fs,
 * 不引外部 mock lib。
 *
 * 不测:
 *  - File.downloadFileAsync 真实网络行为(集成测试 / E2E 层)
 *  - 真机文件系统 race condition(只能用真实 fs 跑)
 */

type FakeFileOpts = {
  name: string;
  uri: string;
  size: number;
  mtime: number;
};

const fsEntries: FakeFileOpts[] = [];

function resetFs(): void {
  fsEntries.length = 0;
}

function addFile(opts: FakeFileOpts): void {
  fsEntries.push(opts);
}

// ----- mock 控制 -----
let nextDownload: { kind: 'ok'; uri: string; size?: number; mtime?: number } | { kind: 'throw'; err: Error } = {
  kind: 'ok',
  uri: 'file:///mock/Cache/gifs/0308-yz9nUhF.gif',
  size: 80000,
  mtime: 9999,
};

function setDownloadOk(uri: string, size = 80000, mtime = 9999): void {
  nextDownload = { kind: 'ok', uri, size, mtime };
}

function setDownloadThrow(err: Error): void {
  nextDownload = { kind: 'throw', err };
}

class MockFile {
  name: string;
  parent: { uri: string } | null;
  uri: string;
  size: number;

  constructor(parentOrUri: { uri: string } | string, maybeName?: string) {
    if (typeof parentOrUri === 'string') {
      this.uri = parentOrUri;
      this.parent = null;
      this.name = parentOrUri.split('/').filter(Boolean).pop() ?? '';
    } else {
      this.parent = parentOrUri;
      this.uri = `${parentOrUri.uri}${maybeName ?? ''}`;
      this.name = maybeName ?? '';
    }
    const entry = fsEntries.find((e) => e.name === this.name);
    this.size = entry?.size ?? 0;
  }

  get exists(): boolean {
    return fsEntries.some((e) => e.name === this.name);
  }

  info() {
    const entry = fsEntries.find((e) => e.name === this.name);
    return {
      size: entry?.size ?? this.size ?? 0,
      modificationTime: entry?.mtime ?? 0,
    };
  }

  delete(): void {
    const idx = fsEntries.findIndex((e) => e.name === this.name);
    if (idx >= 0) fsEntries.splice(idx, 1);
  }

  static async downloadFileAsync(_url: string, _dest: unknown): Promise<MockFile> {
    if (nextDownload.kind === 'throw') throw nextDownload.err;
    // 模拟下载成功:写入 fs
    const file = new MockFile(nextDownload.uri);
    // 用 file.name 写(已经是 basename);但 .uri 才是下载后的目标
    fsEntries.push({
      name: file.name,
      uri: nextDownload.uri,
      size: nextDownload.size ?? 80000,
      mtime: nextDownload.mtime ?? 9999,
    });
    return file;
  }
}

class MockDirectory {
  uri: string;
  name: string;
  constructor(parentOrUri: { uri: string } | string, maybeName?: string) {
    if (typeof parentOrUri === 'string') {
      this.uri = parentOrUri;
      this.name = parentOrUri.split('/').filter(Boolean).pop() ?? '';
    } else {
      this.uri = `${parentOrUri.uri}${maybeName ? `${maybeName}/` : ''}`;
      this.name = maybeName ?? '';
    }
  }

  get exists(): boolean {
    // 简化:fsEntries 非空就算目录存在
    return fsEntries.length > 0;
  }

  create(_opts: { idempotent?: boolean; intermediates?: boolean }): void {
    // no-op
  }

  list(): unknown[] {
    // G41:maybeEvict 要 instanceof File + name.endsWith('.gif') 才能算入
    // 把 fsEntries 包成 MockFile 实例,让真实 maybeEvict 逻辑能跑通
    return fsEntries
      .filter((e) => !!e.name)
      .map((e) => {
        const f = new MockFile(this, e.name);
        return f;
      });
  }

  delete(): void {
    fsEntries.length = 0;
  }
}

jest.mock('expo-file-system', () => ({
  __esModule: true,
  Paths: { cache: { uri: 'file:///mock/Cache/' } },
  File: MockFile,
  Directory: MockDirectory,
}));

// mock 完才能 import 被测模块 —— 用 require 延迟到测试运行时
// (ES import 会被 babel 提前 hoisting,可能在 mock factory 还没解析时
// 就触发 module 加载,导致 CACHE_DIR 构造时拿到的是未替换的 expo-file-system)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clearGifCache, getCachedOrDownload } = require('@/screens/exerciseGifCache') as typeof import('@/screens/exerciseGifCache');

beforeEach(() => {
  resetFs();
  setDownloadOk('file:///mock/Cache/gifs/0308-yz9nUhF.gif');
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
});

describe('G39 exerciseGifCache', () => {
  describe('getCachedOrDownload', () => {
    it('null / 空 URL → null,不走任何文件系统调用', async () => {
      expect(await getCachedOrDownload('')).toBeNull();
      expect(await getCachedOrDownload('not-a-url')).toBeNull();
      expect(fsEntries).toHaveLength(0);
    });

    it('URL basename 解析失败(无 .gif 后缀)→ null', async () => {
      const result = await getCachedOrDownload('https://cdn.example.com/api/list');
      expect(result).toBeNull();
    });

    it('缓存命中 → 直接返 file:// URI,不调 downloadFileAsync', async () => {
      addFile({
        name: '0025-EIeI8Vf.gif',
        uri: 'file:///mock/Cache/gifs/0025-EIeI8Vf.gif',
        size: 90000,
        mtime: 1000,
      });
      const fsSizeBefore = fsEntries.length;

      const result = await getCachedOrDownload(
        'https://cdn.example.com/exercises/0025-EIeI8Vf.gif',
      );

      expect(result).toBe('file:///mock/Cache/gifs/0025-EIeI8Vf.gif');
      expect(fsEntries.length).toBe(fsSizeBefore);
    });

    it('缓存未命中 → downloadFileAsync 成功,返新 URI', async () => {
      resetFs();
      const downloadUri = 'file:///mock/Cache/gifs/0308-yz9nUhF.gif';
      setDownloadOk(downloadUri);

      const result = await getCachedOrDownload(
        'https://cdn.example.com/exercises/0308-yz9nUhF.gif',
      );

      expect(result).toBe(downloadUri);
      expect(fsEntries.some((e) => e.uri === downloadUri)).toBe(true);
    });

    it('download 失败(throw)→ 返 null,不污染 fs', async () => {
      resetFs();
      setDownloadThrow(new Error('Network unreachable'));

      const result = await getCachedOrDownload(
        'https://cdn.example.com/exercises/1325-CmEr4pM.gif',
      );

      expect(result).toBeNull();
      expect(fsEntries).toHaveLength(0);
    });

    it('并发多次同一 URL → 各自返一致结果', async () => {
      addFile({
        name: '0025-EIeI8Vf.gif',
        uri: 'file:///mock/Cache/gifs/0025-EIeI8Vf.gif',
        size: 90000,
        mtime: 1000,
      });

      const url = 'https://cdn.example.com/exercises/0025-EIeI8Vf.gif';
      const results = await Promise.all([
        getCachedOrDownload(url),
        getCachedOrDownload(url),
        getCachedOrDownload(url),
      ]);

      expect(
        results.every((r) => r === 'file:///mock/Cache/gifs/0025-EIeI8Vf.gif'),
      ).toBe(true);
    });

    it('URL query string 被丢,basename 只看 pathname', async () => {
      addFile({
        name: '0289-SpYC0Kp.gif',
        uri: 'file:///mock/Cache/gifs/0289-SpYC0Kp.gif',
        size: 90000,
        mtime: 1000,
      });

      const result = await getCachedOrDownload(
        'https://cdn.example.com/exercises/0289-SpYC0Kp.gif?token=abc&v=2',
      );

      expect(result).toBe('file:///mock/Cache/gifs/0289-SpYC0Kp.gif');
    });
  });

  describe('G41 R2 CDN 路径(250 个 bundled:false 走 https)', () => {
    it('R2 pub 域名 deep path → basename 清洗正确(无 query)', async () => {
      const r2Url = 'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/0151-7xI5MXA.gif';
      const result = await getCachedOrDownload(r2Url);
      // 缓存未命中 → 走 download,默认 ok 落到 0308 mock uri
      expect(result).toBe('file:///mock/Cache/gifs/0308-yz9nUhF.gif');
      expect(fsEntries.some((e) => e.name === '0308-yz9nUhF.gif')).toBe(true);
    });

    it('R2 URL 命中缓存(已下载过)→ 直接返 file:// URI,不调 download', async () => {
      addFile({
        name: '0151-7xI5MXA.gif',
        uri: 'file:///mock/Cache/gifs/0151-7xI5MXA.gif',
        size: 95000,
        mtime: 5000,
      });
      const fsSizeBefore = fsEntries.length;
      const result = await getCachedOrDownload(
        'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/0151-7xI5MXA.gif',
      );
      expect(result).toBe('file:///mock/Cache/gifs/0151-7xI5MXA.gif');
      expect(fsEntries.length).toBe(fsSizeBefore);
    });

    it('R2 URL 文件名含特殊字符(防御性清洗)→ 走安全白名单', async () => {
      // hasaneyldrm 文件名形如 0662-I4hDWkc.gif,只含 [a-zA-Z0-9.-],无特殊字符
      // 测试一个含 query 但不带 .gif 的 URL → 应该返 null(不命中下载)
      const result = await getCachedOrDownload(
        'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/foo',
      );
      expect(result).toBeNull();
    });

    it('R2 URL download 失败 → 返 null,UI Skeleton fallback', async () => {
      resetFs();
      setDownloadThrow(new Error('R2 503 Service Unavailable'));
      const result = await getCachedOrDownload(
        'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/1311-Ccm5kAE.gif',
      );
      expect(result).toBeNull();
      expect(fsEntries).toHaveLength(0);
    });

    it('250 个 R2 URL 各自独立,basename 互不冲突', async () => {
      // 模拟批量:5 个不同 R2 URL 各自有自己的 basename
      const urls = [
        'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/0151-7xI5MXA.gif',
        'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/0171-tBWXbIT.gif',
        'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/0251-9WTm7dq.gif',
        'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/0662-I4hDWkc.gif',
        'https://pub-PLACEHOLDER.r2.dev/workout2-gifs/exercises/1326-cP6M2x9.gif',
      ];
      // 全部缓存命中(预先填)
      urls.forEach((u) => {
        const name = u.split('/').pop()!;
        addFile({ name, uri: `file:///mock/Cache/gifs/${name}`, size: 80000, mtime: 1000 });
      });
      const results = await Promise.all(urls.map((u) => getCachedOrDownload(u)));
      expect(results.every((r) => r?.startsWith('file:///mock/Cache/gifs/'))).toBe(true);
      expect(new Set(results).size).toBe(5);
    });

    it('LRU 阈值 200MB:缓存超阈值 → 删最旧(mtime 升序)直至 ≤ 200MB', async () => {
      // 模拟 5 个文件,总大小 250MB,触发 LRU
      // MAX_CACHE_BYTES = 200 * 1024 * 1024 = 209715200
      // 总: 5 × 50MB = 250MB,超 200MB
      // 最旧的 2 个 (50MB × 2 = 100MB) 被删 → 剩 3 × 50MB = 150MB ≤ 200MB,break
      const t = 1000;
      for (let i = 0; i < 5; i++) {
        addFile({
          name: `big-${i}.gif`,
          uri: `file:///mock/Cache/gifs/big-${i}.gif`,
          size: 50 * 1024 * 1024,
          mtime: t + i, // 0..4,mtime 升序 → big-0 最旧
        });
      }
      expect(fsEntries.length).toBe(5);
      // 触发 LRU:再调一次 getCachedOrDownload(任意 URL)
      setDownloadOk('file:///mock/Cache/gifs/trigger.gif', 1000);
      await getCachedOrDownload('https://x/y/trigger.gif');
      // maybeEvict → 删 big-0(50MB) → total = 200MB+1KB > 200MB → 继续
      // 删 big-1(50MB) → total = 150MB+1KB ≤ 200MB → break
      // 剩 big-2, big-3, big-4 + trigger
      const remainingNames = fsEntries.map((e) => e.name).sort();
      expect(remainingNames).toEqual(['big-2.gif', 'big-3.gif', 'big-4.gif', 'trigger.gif']);
    });

    it('LRU 阈值 200MB:刚好 < 阈值 → 不删任何文件', async () => {
      // 1 个 50MB 文件,远低于 200MB
      addFile({
        name: 'small.gif',
        uri: 'file:///mock/Cache/gifs/small.gif',
        size: 50 * 1024 * 1024,
        mtime: 9999,
      });
      setDownloadOk('file:///mock/Cache/gifs/new.gif', 1000);
      await getCachedOrDownload('https://x/y/new.gif');
      // 不触发 LRU → small.gif 还在
      expect(fsEntries.some((e) => e.name === 'small.gif')).toBe(true);
      // 新下载的 new.gif 也在
      expect(fsEntries.some((e) => e.name === 'new.gif')).toBe(true);
    });
  });

  describe('clearGifCache', () => {
    it('fs 空 → 静默 no-op', async () => {
      fsEntries.length = 0;
      await expect(clearGifCache()).resolves.toBeUndefined();
    });

    it('fs 有文件 → 清空全部 entry', async () => {
      addFile({ name: 'a.gif', uri: 'file://a.gif', size: 1, mtime: 1 });
      addFile({ name: 'b.gif', uri: 'file://b.gif', size: 1, mtime: 1 });
      expect(fsEntries).toHaveLength(2);

      await clearGifCache();

      expect(fsEntries).toHaveLength(0);
    });
  });
});
