/**
 * clearAllData — 「清除全部数据」的唯一收尾入口。
 *
 * 为什么要有这个文件：`wipeAllData()`（`src/db/index.ts:145`）**只碰数据库**，
 * 它的 doc 注释明确把副作用（store reload、取消训练）推给调用方。于是两个入口
 * （`ProfileScreen` / `SettingsScreen`）各自抄了一遍同样的收尾清单。
 *
 * 抄两遍的代价已经出现过一次：`clearGifCache()`（`@/screens/exerciseGifCache.ts:146`）
 * 的注释白纸黑字写着「暴露给『清除全部数据』流程」，但从 G41 起**从来没有任何
 * 地方调用过它** —— 清单写在两个地方，加项时就漏了。头像又要往这份清单里
 * 加一项，所以先把它收成一个地方。
 *
 * 顺序：先 DB，后文件。文件清理即使失败也不该把一次成功的清库报成失败
 * （`clearAvatar` / `clearGifCache` 内部都已吞掉异常，这里只是把顺序摆明确）。
 */

import { wipeAllData } from '@/db';
import { clearGifCache } from '@/screens/exerciseGifCache';
import { useAvatarStore } from '@/store/avatarStore';
import { useExerciseStore } from '@/store/exerciseStore';
import { usePlanStore } from '@/store/planStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrainingStore } from '@/store/trainingStore';
import { toast } from '@/hooks/useToast';

/**
 * 清除全部数据（DB 全表 + 头像文件 + GIF 缓存），并同步所有内存 store。
 *
 * 自带 toast，不抛异常 —— 调用方只需要在二次确认后 `await` 一次。
 */
export async function clearAllData(): Promise<void> {
  try {
    await wipeAllData();

    // store 是内存缓存、DB 是唯一真相，没有自动失效机制，必须手动 reload。
    await Promise.all([
      useExerciseStore.getState().reload(),
      usePlanStore.getState().reload(),
      useTrainingStore.getState().loadHistory(),
      useSettingsStore.getState().load(),
    ]);
    // 保险：清数据时内存里若有 active training，DB 已经没了，内存必须跟上。
    useTrainingStore.getState().cancelTraining();

    // 以下两项都是**文件系统**里的东西，不在 DB 里 —— wipeAllData 不会碰它们，
    // 必须在这里显式清。头像尤其重要：用户点「清除全部数据」的合理预期是
    // 头像也没了，而它此前只是个文件。
    await useAvatarStore.getState().clear();
    await clearGifCache();

    toast.show('已清除全部数据', 'success');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.show('清除失败：' + msg, 'error');
  }
}
