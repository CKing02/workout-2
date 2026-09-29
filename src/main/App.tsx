/**
 * App root — composes providers in the right order:
 *
 *   GestureHandlerRootView   ← required by react-native-gesture-handler
 *     └─ SafeAreaProvider     ← required by react-native-safe-area-context
 *          └─ SQLiteProvider   ← opens the DB; onInit runs migrations + seeds
 *               └─ ThemeProvider    ← provides design tokens (light/dark aware)
 *                    └─ ThemedStatusBar
 *                    └─ ErrorBoundary    ← G12: catches render errors, prevents white screen
 *                         └─ DatabaseBootstrap    ← waits for migrations + seeds
 *                              └─ RootNavigator
 *                    └─ Toast           ← G12: global lightweight non-modal feedback
 *
 * The order matters:
 * - safe-area must be above the navigator so screens can read insets
 * - SQLiteProvider must be above ThemeProvider so theme can later react to DB
 *   settings (G10)
 * - theme must be above the navigator so the navigator can theme its surface
 * - Toast sits *outside* ErrorBoundary's children but inside ThemeProvider so
 *   it keeps rendering when a sibling subtree throws — the boundary then shows
 *   the fallback UI AND a toast via `componentDidCatch`.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';

import { RootNavigator } from '@/navigation/RootNavigator';
import { DATABASE_NAME, initDatabase, setDatabaseInstance } from '@/db';
import { ThemeProvider, useTheme } from '@/theme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
 * Returns void so the provider doesn't suspend — the splash is rendered
 * by `DatabaseBootstrap` based on a `ready` flag flipped in useEffect.
 */
async function handleDbInit(db: SQLiteDatabase): Promise<void> {
  await setDatabaseInstance(db);
  await initDatabase();
}

/**
 * Wait for SQLiteProvider to finish its async onInit before rendering
 * the rest of the tree. Without this, screens might race against the
 * migrations and seed writes.
 */
function DatabaseBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
        // Boot loader for persisted settings — runs once before first paint
        // so ThemeProvider (which subscribes to `settingsStore.themeMode`)
        // renders with the user's saved choice instead of flashing the OS
        // scheme. Five parallel `getSetting` reads on the same DB connection
        // — adds <10ms vs. init.
        await useSettingsStore.getState().load();
        // 自定义头像（本地文件，不进 DB）。放在 settings 之后、首帧之前，
        // 免得「我的」页先画一帧首字符再跳成头像。
        // 可以放心的 await：load() 内部吞掉所有异常，不会走到下面的 catch
        // 去误报「数据库初始化失败」。开销只是一次目录 list()。
        await useAvatarStore.getState().load();
        // G35 §3 老装兼容:backfillExerciseI18n 刚 UPDATE 了老行 5 字段,
        // 但 exerciseStore cache 还是老 9 列 —— 重拉一次让 store 拿到新数据。
        await useExerciseStore.getState().reload();
        // US-12 — 身体测量(体重 + 体脂)。可与上面并行,放这里只是因为
        // load 是异步且 DB 已经 ready,并行收益 < 代码可读性。
        await useBodyMeasurementStore.getState().load();
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

  const { colors } = useTheme();

  if (!ready) {
    return (
      <View style={[styles.bootstrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  // We render children either way — `failed` is informational only.
  void failed;
  return <>{children}</>;
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
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          options={{ enableChangeListener: true }}
          onInit={handleDbInit}
        >
          <ThemeProvider>
            <ThemedStatusBar />
            <ErrorBoundary>
              <DatabaseBootstrap>
                <RootNavigator />
              </DatabaseBootstrap>
            </ErrorBoundary>
            <ToastHost />
          </ThemeProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bootstrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
