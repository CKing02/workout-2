/**
 * G38 §3 — RestTimer 通知栏同步 Bridge(无 UI 副作用组件)
 *
 * 挂载位置:`ActiveTrainingScreen` 内,`<RestTimerOverlay />` 同级。
 * 职责:订阅 restTimerStore + AppState,把当前倒计时秒数推到通知栏。
 *
 * 关键设计:
 *   - **复用 store 状态,不重复维护 timer**:startedAt/durationMs/completedAt 都来自 store
 *     (`getRemainingMs` 公式:`durationMs - (Date.now() - startedAt)`),前台 1s tick + 后台 freeze
 *     都自动正确
 *   - **runId 依赖**:store 的 `runId` 单调递增,start/extend 都会变。extend 不变更 runId
 *     (G7 设计),让 TimerRing 视觉连续;start + 重置时依赖变 useEffect 重挂 interval
 *   - **AppState 'active' 触发**:用户在 background 时通知栏秒数会"冻结"在最后值
 *     (managed workflow 无法绕过),切回前台时立刻 push 一次当前真值,通知秒数跳到正确位置
 *   - **前台不弹横幅**:setNotificationHandler 返回 shouldShowBanner:false,避免遮训练 UI
 *     训练中浮窗由 in-app RestTimerOverlay 承担
 *
 * 不做的事:
 *   - 不维护独立 interval/setTimeout 来计算秒数 — 全交给 store + Date.now()
 *   - 不订阅 completedAt 的 `!= null` 翻转来 dismiss — useEffect 依赖完备,自然处理
 */

import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useRestTimerStore } from './restTimerStore';
import {
  ensureChannelAndPermissions,
  showOrUpdateRestTimerNotification,
  dismissRestTimerNotification,
} from './restTimerNotification';

export function RestTimerNotificationBridge(): null {
  // 只订阅需要的 5 个字段,避免 store 任何变动都重渲(虽然返回 null 无所谓)
  const startedAt = useRestTimerStore((s) => s.startedAt);
  const durationMs = useRestTimerStore((s) => s.durationMs);
  const completedAt = useRestTimerStore((s) => s.completedAt);
  const runId = useRestTimerStore((s) => s.runId);
  // 设计优化 #1: 通知栏 title 要展示"刚做完的动作名"
  const exerciseName = useRestTimerStore((s) => s.exerciseName);

  /* ---------------------- 1. mount:channel + 前台 handler -------------------- */
  useEffect(() => {
    // iOS 路径:ensureChannelAndPermissions 内部 Platform.OS check 跳过;
    // 但 setNotificationHandler 跨平台通用,顺手设一下(后续 iOS 任务会用到)
    ensureChannelAndPermissions();

    // 前台时不弹横幅 — 训练中已经有 in-app RestTimerOverlay,通知只在抽屉挂进度
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

  /* -------------------- 2. 跟随 store:每秒推一次到通知栏 ------------------- */
  useEffect(() => {
    // 空闲或已完成:确保通知被划掉
    if (startedAt === null || durationMs === null || completedAt !== null) {
      // 只在 Android 真正调一次(Platform check 在 dismiss 内部)
      dismissRestTimerNotification();
      return;
    }

    const totalSec = Math.ceil(durationMs / 1000);

    const tick = () => {
      const ms = durationMs - (Date.now() - startedAt);
      const remaining = Math.max(0, Math.ceil(ms / 1000));
      // 设计优化 #1: 动作名也带进通知栏,用户在系统抽屉能看清"刚做完什么动作"
      showOrUpdateRestTimerNotification(remaining, totalSec, exerciseName);
      if (remaining <= 0) {
        // 自然到 0:切到 completedAt 分支后下一次 render 会 dismiss;
        // 这里主动 dismiss 兜底,避免最后一秒通知在抽屉多停 1s
        dismissRestTimerNotification();
      }
    };

    // 立即推一次(进入"休息中"瞬间通知栏立刻有内容,不卡 1s)
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationMs, completedAt, runId, exerciseName]);

  /* --------------- 3. AppState 监听:active 时立刻校准秒数 ----------------- */
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      // 切回前台:用当前 store 真值立刻推一次,补偿 background 冻结
      const sStartedAt = useRestTimerStore.getState().startedAt;
      const sDurationMs = useRestTimerStore.getState().durationMs;
      const sCompletedAt = useRestTimerStore.getState().completedAt;
      const sExerciseName = useRestTimerStore.getState().exerciseName;
      if (sStartedAt === null || sDurationMs === null || sCompletedAt !== null) return;

      const ms = sDurationMs - (Date.now() - sStartedAt);
      const remaining = Math.max(0, Math.ceil(ms / 1000));
      const totalSec = Math.ceil(sDurationMs / 1000);
      showOrUpdateRestTimerNotification(remaining, totalSec, sExerciseName);
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  // 平台分流 — iOS 路径整体 noop,但保留 hook 框架给未来 G 任务挂 Live Activity
  if (Platform.OS !== 'android') return null;

  return null;
}