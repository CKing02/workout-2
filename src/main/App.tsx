/**
 * App root — composes providers in the right order:
 *
 *   GestureHandlerRootView   ← required by react-native-gesture-handler
 *     └─ SafeAreaProvider     ← required by react-native-safe-area-context
 *          └─ ThemeProvider    ← provides design tokens (light/dark aware)
 *               ├─ ThemedStatusBar
 *               ├─ ErrorBoundary    ← also catches SQLiteProvider startup errors
 *               │    └─ SQLiteProvider   ← onInit runs migrations + seeds
 *               │         └─ DatabaseBootstrap    ← waits for persisted stores
 *               │              └─ RootNavigator
 *               └─ Toast           ← G12: global lightweight feedback
 *
 * The order matters:
 * - safe-area must be above the navigator so screens can read insets
 * - ThemeProvider reads settingsStore; DatabaseBootstrap hydrates it before
 *   navigation mounts. Keeping theme outside SQLite lets startup errors use
 *   the existing themed fallback.
 * - theme must be above the navigator so the navigator can theme its surface
 * - Toast sits *outside* ErrorBoundary's children but inside ThemeProvider so
 *   it keeps rendering when a sibling subtree throws — the boundary then shows
 *   the fallback UI AND a toast via `componentDidCatch`.
 *
 * 冷启动的可见顺序：原生启动页（橙底白标记）→ `BootSplash`（同一画面）→ App。
 * 前两者之间由 `nativeSplash` + `BootSplash.onLayout` 显式交接，
 * 见 `@/components/brand/BootSplash`。
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';

import { RootNavigator } from '@/navigation/RootNavigator';
import { DATABASE_NAME, initDatabase, setDatabaseInstance } from '@/db';
import { ThemeProvider, useTheme } from '@/theme';
import { DefaultFallback, ErrorBoundary } from '@/components/ErrorBoundary';
import { BootSplash } from '@/components/brand/BootSplash';
import { hideNativeSplash } from '@/components/brand/nativeSplash';
import { Toast } from '@/components/Toast';
import { toast } from '@/hooks/useToast';
import { useSettingsStore } from '@/store/settingsStore';
import { useExerciseStore } from '@/store/exerciseStore';
import { useBodyMeasurementStore } from '@/store/bodyMeasurementStore';
import { useAvatarStore } from '@/store/avatarStore';

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Bridge from SQLiteProvider's onInit to `@/db`'s singleton. We receive
 * the freshly-opened DB and hand it to `setDatabaseInstance` so all
 * subsequent `getDatabase()` calls share this connection.
 *
 * SQLiteProvider awaits onInit before mounting its children. The native
 * splash covers that interval; DatabaseBootstrap then renders the JS splash.
 */
async function handleDbInit(db: SQLiteDatabase): Promise<void> {
  await setDatabaseInstance(db);
  await initDatabase();
}

/**
 * 启动步骤 —— 顺序即执行顺序。启动屏的进度条按「已完成步数 / 总步数」算，
 * 所以那是**真实进度**，不是定时器假装出来的。
 *
 * 各步耗时并不均匀：首次冷启动时 initDatabase 要跑迁移+种子，占大头；
 * 之后各步都很快。所以进度条会走得忽快忽慢 —— 这是诚实的代价，
 * 好过一条匀速滑动、但对"还要等多久"撒谎的条。
 */
const BOOT_STEPS = ['数据库', '设置', '头像', '动作库', '身体数据'] as const;

/**
 * Wait for SQLiteProvider to finish its async onInit before rendering
 * the rest of the tree. Without this, screens might race against the
 * migrations and seed writes.
 */
function DatabaseBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(0);
  /**
   * 启动屏比 `ready` 多活一小段：淡出动画跑完才卸载。
   * 淡出期间 children 已经挂好、启动屏盖在上面 —— 真正的交叉淡化，
   * 而不是"先卸载再挂载"那种会闪一帧的硬切。
   */
  const [splashMounted, setSplashMounted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const done = (n: number) => {
      if (!cancelled) setCompletedSteps(n);
    };
    (async () => {
      try {
        await initDatabase();
        done(1);
        // Boot loader for persisted settings — runs once before first paint
        // so ThemeProvider (which subscribes to `settingsStore.themeMode`)
        // renders with the user's saved choice instead of flashing the OS
        // scheme. Five parallel `getSetting` reads on the same DB connection
        // — adds <10ms vs. init.
        await useSettingsStore.getState().load();
        done(2);
        // 自定义头像（本地文件，不进 DB）。放在 settings 之后、首帧之前，
        // 免得「我的」页先画一帧首字符再跳成头像。
        // 可以放心的 await：load() 内部吞掉所有异常，不会走到下面的 catch
        // 去误报「数据库初始化失败」。开销只是一次目录 list()。
        await useAvatarStore.getState().load();
        done(3);
        // G35 §3 老装兼容:backfillExerciseI18n 刚 UPDATE 了老行 5 字段,
        // 但 exerciseStore cache 还是老 9 列 —— 重拉一次让 store 拿到新数据。
        await useExerciseStore.getState().reload();
        done(4);
        // US-12 — 身体测量(体重 + 体脂)。可与上面并行,放这里只是因为
        // load 是异步且 DB 已经 ready,并行收益 < 代码可读性。
        await useBodyMeasurementStore.getState().load();
        done(5);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (cancelled) return;
        // G12: don't throw — surface as a user-visible toast + flip into a
        // degraded "ready" state so the UI can still render. The screens
        // themselves short-circuit on missing DB rows, so the app remains
        // usable for read-only browsing.
        // eslint-disable-next-line no-console
        console.error('[G2] initDatabase / settings.load failed', err);
        toast.show('数据库初始化失败，部分功能不可用', 'error');
        setFailed(true);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // We render children either way — `failed` is informational only.
  void failed;

  return (
    <>
      {/* 门禁：DB 没就绪前不挂载 children，避免各屏和迁移/种子写竞争。 */}
      {ready ? children : null}
      {splashMounted ? (
        <BootSplash
          progress={completedSteps / BOOT_STEPS.length}
          visible={!ready}
          onHidden={() => setSplashMounted(false)}
          statusLabel={BOOT_STEPS[Math.min(completedSteps, BOOT_STEPS.length - 1)]}
        />
      ) : null}
    </>
  );
}

/**
 * G12: Toast mount lives outside ErrorBoundary's children so it can
 * still render and dispatch messages when a subtree crashes.
 */
function ToastHost() {
  return <Toast />;
}

export function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStatusBar />
          <ErrorBoundary fallback={(error, reset) => (
            <View style={styles.root} onLayout={hideNativeSplash}>
              <DefaultFallback error={error} onReset={reset} />
            </View>
          )}>
            <SQLiteProvider
              databaseName={DATABASE_NAME}
              options={{ enableChangeListener: true }}
              onInit={handleDbInit}
            >
              <DatabaseBootstrap>
                <RootNavigator />
              </DatabaseBootstrap>
            </SQLiteProvider>
          </ErrorBoundary>
          <ToastHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
