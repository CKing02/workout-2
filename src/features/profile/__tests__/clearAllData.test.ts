/**
 * clearAllData 单元测。
 *
 * 这个文件存在的理由就是「收尾清单只写一遍」。测试因此要钉的是**清单的完整性
 * 与顺序**，而不是其中任何单项的行为（那些各自有测）：
 *
 *  - 清库 → 4 个 store reload → 取消训练 → 清头像文件 → 清 GIF 缓存 → toast
 *  - 尤其：`clearGifCache()` 曾经**整整一个版本没被任何地方调用**过（注释写着
 *    它属于这个流程），这正是把清单抄成两份的代价。这里把它钉死。
 *  - 头像文件清理是新增项，且必须是**文件系统**动过（`wipeAllData` 不碰文件）。
 *  - 文件清理失败不能把一次成功的清库报成失败。
 *
 * 顺带记一笔：头像**不进 DB** 是设计决定（`avatarStore.ts` 顶部有完整论证），
 * 所以这里的断言是「调了 avatarStore.clear」，而不是「DB 里某行没了」。
 *
 * ⚠️ 不要整体 mock `expo-modules-core`（原因见 avatarFile.test.ts 顶部）。
 */

import { useToastStore } from '@/hooks/useToast';

/** 按调用顺序记录 —— 顺序本身是契约的一部分（先 DB 后文件）。 */
let mockOrder: string[] = [];

const mockWipeAllData = jest.fn(async () => {
  mockOrder.push('wipeAllData');
});

jest.mock('@/db', () => ({
  __esModule: true,
  wipeAllData: (...a: unknown[]) => mockWipeAllData(...a),
}));

jest.mock('@/screens/exerciseGifCache', () => ({
  __esModule: true,
  clearGifCache: jest.fn(async () => {
    mockOrder.push('clearGifCache');
  }),
}));

// 四个 store 用最小替身：这里不关心它们内部，只关心「有没有被 reload」。
jest.mock('@/store/exerciseStore', () => ({
  __esModule: true,
  useExerciseStore: {
    getState: () => ({
      reload: async () => {
        mockOrder.push('exercise.reload');
      },
    }),
  },
}));
jest.mock('@/store/planStore', () => ({
  __esModule: true,
  usePlanStore: {
    getState: () => ({
      reload: async () => {
        mockOrder.push('plan.reload');
      },
    }),
  },
}));
jest.mock('@/store/trainingStore', () => ({
  __esModule: true,
  useTrainingStore: {
    getState: () => ({
      loadHistory: async () => {
        mockOrder.push('training.loadHistory');
      },
      cancelTraining: () => {
        mockOrder.push('training.cancelTraining');
      },
    }),
  },
}));
jest.mock('@/store/settingsStore', () => ({
  __esModule: true,
  useSettingsStore: {
    getState: () => ({
      load: async () => {
        mockOrder.push('settings.load');
      },
    }),
  },
}));

const mockAvatarClear = jest.fn(async () => {
  mockOrder.push('avatar.clear');
});
jest.mock('@/store/avatarStore', () => ({
  __esModule: true,
  useAvatarStore: {
    getState: () => ({ clear: () => mockAvatarClear() }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clearAllData } =
  require('@/features/profile/clearAllData') as typeof import('@/features/profile/clearAllData');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clearGifCache } = require('@/screens/exerciseGifCache') as {
  clearGifCache: jest.Mock;
};

let showSpy: jest.SpyInstance;

beforeEach(() => {
  mockOrder = [];
  jest.clearAllMocks();
  showSpy = jest.spyOn(useToastStore.getState(), 'show').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('clearAllData', () => {
  it('happy path：清库 + 4 个 store reload + 取消训练 + 清头像文件 + 清 GIF 缓存 + success toast', async () => {
    await clearAllData();

    expect(mockWipeAllData).toHaveBeenCalledTimes(1);
    expect(mockAvatarClear).toHaveBeenCalledTimes(1);
    expect(clearGifCache).toHaveBeenCalledTimes(1);
    expect(showSpy).toHaveBeenCalledWith('已清除全部数据', { variant: 'success' });
  });

  it('收尾清单一项不漏（清单被抄成两份时正是这样漏的）', async () => {
    await clearAllData();

    expect(mockOrder).toContain('exercise.reload');
    expect(mockOrder).toContain('plan.reload');
    expect(mockOrder).toContain('training.loadHistory');
    expect(mockOrder).toContain('settings.load');
    expect(mockOrder).toContain('training.cancelTraining');
  });

  it('先清库、再 reload store —— 反了的话 reload 会读回旧数据', async () => {
    await clearAllData();

    expect(mockOrder.indexOf('wipeAllData')).toBe(0);
    for (const step of ['exercise.reload', 'plan.reload', 'training.loadHistory', 'settings.load']) {
      expect(mockOrder.indexOf(step)).toBeGreaterThan(mockOrder.indexOf('wipeAllData'));
    }
  });

  it('取消训练在 store reload 之后（DB 都空了，内存不能还留着 active training）', async () => {
    await clearAllData();

    const reloads = [
      mockOrder.indexOf('exercise.reload'),
      mockOrder.indexOf('plan.reload'),
      mockOrder.indexOf('training.loadHistory'),
      mockOrder.indexOf('settings.load'),
    ];
    expect(mockOrder.indexOf('training.cancelTraining')).toBeGreaterThan(Math.min(...reloads));
  });

  it('两个文件系统清理都在最后一次 toast 之前跑完', async () => {
    await clearAllData();

    expect(mockOrder).toContain('avatar.clear');
    expect(mockOrder).toContain('clearGifCache');
    expect(showSpy).toHaveBeenCalled();
  });

  it('wipeAllData 失败 → 不继续走收尾、报 error toast', async () => {
    mockWipeAllData.mockRejectedValueOnce(new Error('disk full'));

    await expect(clearAllData()).resolves.toBeUndefined();

    expect(mockAvatarClear).not.toHaveBeenCalled();
    expect(clearGifCache).not.toHaveBeenCalled();
    expect(showSpy).toHaveBeenCalledWith('清除失败：disk full', { variant: 'error' });
  });

  it('头像文件删不掉 → 只把这次清数据报成失败，不会被当成成功（也不向上抛）', async () => {
    mockAvatarClear.mockRejectedValueOnce(new Error('EBUSY'));

    await expect(clearAllData()).resolves.toBeUndefined();

    // 关键：不能报「已清除全部数据」—— 文件还在，用户预期没被满足。
    expect(showSpy).not.toHaveBeenCalledWith('已清除全部数据', { variant: 'success' });
    expect(showSpy).toHaveBeenCalledWith('清除失败：EBUSY', { variant: 'error' });
  });

  it('GIF 缓存删除失败同样不吞掉错误', async () => {
    // clearGifCache 内部理论上吞异常，这里模拟它真的抛出来的情况。
    clearGifCache.mockRejectedValueOnce(new Error('cache boom'));

    await expect(clearAllData()).resolves.toBeUndefined();

    expect(showSpy).toHaveBeenCalledWith('清除失败：cache boom', { variant: 'error' });
  });
});
