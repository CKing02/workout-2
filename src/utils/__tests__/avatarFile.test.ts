/**
 * avatarFile 测试 —— 手写 MockFile / MockDirectory，不引第三方 mock 库
 * （同 `exerciseGifCache.test.ts:46-141` 的做法）。
 *
 * 注意这里**没有**用 `require()` 延迟加载被测模块。`exerciseGifCache.test.ts:143-147`
 * 之所以要 require，是因为那个模块顶层有 `const CACHE_DIR = new Directory(...)`
 * 这种立即执行的副作用；`avatarFile.ts` 特意把 `new Directory()` 放进了函数里
 * （见其 `avatarDir()` 注释），所以静态 import 是安全的。
 * **下次有人"顺手统一风格"把这里改成 require 之前，请先确认那个副作用还在不在。**
 *
 * ⚠️ 另一个必须守住的约定：**永远不要整体 mock `expo-modules-core`** ——
 * 会让所有 native module 名拿到同一个假对象，expo winter runtime 的
 * `FetchResponse` 基类变 undefined，整个 suite 以
 * `TypeError: Super expression must either be null or a function` 挂掉，
 * 0 个用例执行且看起来像环境问题。这里只 mock `expo-file-system`。
 */

interface FsEntry {
  name: string;
  uri: string;
  lastModified: number;
  content: Uint8Array | null;
}

let fsEntries: FsEntry[] = [];
let dirExists = false;
let nextBytes: Uint8Array | null = null;
let bytesError: Error | null = null;
let writeError: Error | null = null;

// 调用记录 —— 用来钉「走 bytes/write 而不是 copy」这条回归。
let bytesCalls = 0;
let writeCalls = 0;
let copyCalls = 0;

function resetFs(): void {
  fsEntries = [];
  dirExists = false;
  nextBytes = new Uint8Array([1, 2, 3]);
  bytesError = null;
  writeError = null;
  bytesCalls = 0;
  writeCalls = 0;
  copyCalls = 0;
}

/** 直接往「文件系统」里塞一个条目，模拟已存在的头像。 */
function seedFile(name: string, lastModified: number, content?: Uint8Array): void {
  fsEntries.push({
    name,
    uri: `file:///mock/Document/avatars/${name}`,
    lastModified,
    content: content ?? new Uint8Array([9]),
  });
}

class MockFile {
  name: string;
  uri: string;
  private parent: { uri: string } | null;

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
  }

  get exists(): boolean {
    if (this.parent === null) return false; // 裸 URI 引用:当作不存在
    return fsEntries.some((e) => e.name === this.name);
  }

  get lastModified(): number | null {
    const entry = fsEntries.find((e) => e.name === this.name);
    return entry ? entry.lastModified : null;
  }

  async bytes(): Promise<Uint8Array> {
    bytesCalls += 1;
    if (bytesError) throw bytesError;
    return nextBytes ?? new Uint8Array([1, 2, 3]);
  }

  write(content: string | Uint8Array): void {
    writeCalls += 1;
    if (writeError) throw writeError;
    const existing = fsEntries.find((e) => e.name === this.name);
    const payload = typeof content === 'string' ? new Uint8Array([0]) : content;
    if (existing) {
      existing.content = payload;
      return;
    }
    fsEntries.push({
      name: this.name,
      uri: this.uri,
      lastModified: 1_700_000_000_000,
      content: payload,
    });
  }

  /** 故意存在：如果实现退化成 copy()，这个计数器会露馅。 */
  async copy(): Promise<void> {
    copyCalls += 1;
  }

  delete(): void {
    const idx = fsEntries.findIndex((e) => e.name === this.name);
    if (idx >= 0) fsEntries.splice(idx, 1);
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
    return dirExists;
  }

  create(): void {
    dirExists = true;
  }

  list(): unknown[] {
    return fsEntries.map((e) => new MockFile(this, e.name));
  }

  delete(): void {
    fsEntries = [];
    dirExists = false;
  }
}

jest.mock('expo-file-system', () => ({
  __esModule: true,
  Paths: { document: { uri: 'file:///mock/Document/' } },
  File: MockFile,
  Directory: MockDirectory,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { saveAvatar, getStoredAvatar, clearAvatar, avatarExists } =
  require('@/utils/avatarFile') as typeof import('@/utils/avatarFile');

beforeEach(() => {
  resetFs();
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('G-avatar avatarFile', () => {
  describe('getStoredAvatar', () => {
    it('没有文件 → null，且不抛', async () => {
      expect(await getStoredAvatar()).toBeNull();
    });

    it('目录不存在 → null，且不抛', async () => {
      dirExists = false;
      expect(await getStoredAvatar()).toBeNull();
    });

    it('有文件 → 返回该文件的 uri', async () => {
      dirExists = true;
      seedFile('avatar-1700000000000.jpg', 1000);
      const stored = await getStoredAvatar();
      expect(stored?.uri).toBe('file:///mock/Document/avatars/avatar-1700000000000.jpg');
    });

    it('多个文件 → 取 lastModified 最大的', async () => {
      dirExists = true;
      seedFile('avatar-1.jpg', 100);
      seedFile('avatar-3.jpg', 300);
      seedFile('avatar-2.jpg', 200);
      const stored = await getStoredAvatar();
      expect(stored?.uri).toBe('file:///mock/Document/avatars/avatar-3.jpg');
    });

    it('多个文件 → 顺手清掉非最新的（崩在中途后自愈）', async () => {
      dirExists = true;
      seedFile('avatar-1.jpg', 100);
      seedFile('avatar-3.jpg', 300);
      await getStoredAvatar();
      expect(fsEntries.map((e) => e.name)).toEqual(['avatar-3.jpg']);
    });

    it('lastModified 为 null（文件不可读）→ 当没有头像', async () => {
      dirExists = true;
      fsEntries.push({
        name: 'avatar-bad.jpg',
        uri: 'file:///mock/Document/avatars/avatar-bad.jpg',
        lastModified: null as unknown as number,
        content: null,
      });
      expect(await getStoredAvatar()).toBeNull();
    });

    it('目录里有非头像文件 → 不认、也不删', async () => {
      dirExists = true;
      seedFile('unrelated.jpg', 999);
      seedFile('avatar-real.jpg', 100);
      const stored = await getStoredAvatar();
      expect(stored?.uri).toBe('file:///mock/Document/avatars/avatar-real.jpg');
      expect(fsEntries.map((e) => e.name).sort()).toEqual([
        'avatar-real.jpg',
        'unrelated.jpg',
      ]);
    });
  });

  describe('saveAvatar', () => {
    it('走 bytes + write，不走 copy（content:// 的唯一可行路径）', async () => {
      const saved = await saveAvatar('file:///mock/Cache/pick.jpg');
      expect(bytesCalls).toBe(1);
      expect(writeCalls).toBe(1);
      expect(copyCalls).toBe(0);
      expect(saved?.uri).toMatch(/^file:\/\/\/mock\/Document\/avatars\/avatar-\d+\.jpg$/);
    });

    it('content:// 源同样能存（走 ContentResolver 那条路）', async () => {
      const saved = await saveAvatar('content://media/external/images/media/42');
      expect(bytesCalls).toBe(1);
      expect(saved?.uri).toMatch(/^file:\/\/\/mock\/Document\/avatars\//);
    });

    it('目录不存在时会先建目录', async () => {
      dirExists = false;
      await saveAvatar('file:///mock/Cache/pick.jpg');
      expect(dirExists).toBe(true);
    });

    it('存第二次会清掉上一张（不留孤儿文件）', async () => {
      seedFile('avatar-1600000000000.jpg', 1);
      dirExists = true;
      await saveAvatar('file:///mock/Cache/pick.jpg');
      expect(fsEntries).toHaveLength(1);
      expect(fsEntries[0].name).toBe('avatar-1700000000000.jpg');
    });

    it('保留源 URI 的扩展名', async () => {
      const saved = await saveAvatar('file:///mock/Cache/pick.png');
      expect(saved?.uri).toMatch(/\.png$/);
    });

    it('没有扩展名时回落 .jpg', async () => {
      const saved = await saveAvatar('content://media/external/images/media/42');
      expect(saved?.uri).toMatch(/\.jpg$/);
    });

    it('读源文件失败 → 返回 null，不抛，且旧头像还在', async () => {
      seedFile('avatar-old.jpg', 5);
      dirExists = true;
      bytesError = new Error('read boom');
      expect(await saveAvatar('file:///mock/Cache/pick.jpg')).toBeNull();
      expect(fsEntries.map((e) => e.name)).toEqual(['avatar-old.jpg']);
    });

    it('写失败 → 返回 null，不抛', async () => {
      writeError = new Error('write boom');
      expect(await saveAvatar('file:///mock/Cache/pick.jpg')).toBeNull();
    });
  });

  describe('clearAvatar', () => {
    it('本来就没有文件 → 静默 no-op，不抛', async () => {
      await expect(clearAvatar()).resolves.toBeUndefined();
    });

    it('删掉所有头像文件', async () => {
      dirExists = true;
      seedFile('avatar-1.jpg', 1);
      seedFile('avatar-2.jpg', 2);
      await clearAvatar();
      expect(fsEntries).toHaveLength(0);
    });

    it('不碰非头像文件', async () => {
      dirExists = true;
      seedFile('avatar-1.jpg', 1);
      seedFile('unrelated.jpg', 1);
      await clearAvatar();
      expect(fsEntries.map((e) => e.name)).toEqual(['unrelated.jpg']);
    });
  });

  describe('avatarExists', () => {
    it('无 → false', () => {
      expect(avatarExists()).toBe(false);
    });

    it('有 → true', () => {
      dirExists = true;
      seedFile('avatar-1.jpg', 1);
      expect(avatarExists()).toBe(true);
    });
  });
});
