import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockInit = jest.fn();
const mockSettings = jest.fn();
const mockAvatar = jest.fn();
const mockExercises = jest.fn();
const mockMeasurements = jest.fn();
const mockHide = jest.fn();
const mockToast = jest.fn();

jest.mock('@/db', () => ({
  DATABASE_NAME: 'test.db', setDatabaseInstance: jest.fn(), initDatabase: () => mockInit(),
}));
jest.mock('@/components/brand/nativeSplash', () => ({ hideNativeSplash: () => mockHide() }));
jest.mock('@/components/brand/BootSplash', () => {
  const MockView = require('react-native').View;
  return { BootSplash: (props: object) => <MockView testID="boot" {...props} /> };
});
jest.mock('@/navigation/RootNavigator', () => {
  const MockView = require('react-native').View;
  return { RootNavigator: () => <MockView testID="app" /> };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View, SafeAreaView: require('react-native').View,
}));
jest.mock('@/components/Toast', () => ({ Toast: () => null }));
jest.mock('@/hooks/useToast', () => ({ toast: { show: (...args: unknown[]) => mockToast(...args) } }));
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: { getState: () => ({ load: () => mockSettings() }) } }));
jest.mock('@/store/avatarStore', () => ({ useAvatarStore: { getState: () => ({ load: () => mockAvatar() }) } }));
jest.mock('@/store/exerciseStore', () => ({ useExerciseStore: { getState: () => ({ reload: () => mockExercises() }) } }));
jest.mock('@/store/bodyMeasurementStore', () => ({ useBodyMeasurementStore: { getState: () => ({ load: () => mockMeasurements() }) } }));
jest.mock('@/theme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ scheme: 'light', colors: {}, spacing: {}, typography: {}, radius: {} }),
}));
jest.mock('expo-sqlite', () => {
  const MockReact = require('react') as typeof React;
  return {
  SQLiteProvider: ({ onInit, children }: { onInit: (db: object) => Promise<void>; children: React.ReactNode }) => {
    const [ready, setReady] = MockReact.useState(false);
    const [error, setError] = MockReact.useState<Error>();
    MockReact.useEffect(() => {
      void onInit({}).then(() => setReady(true)).catch(setError);
    }, [onInit]);
    if (error) throw error;
    return ready ? children : null;
  },
  };
});

import { App } from '../App';

function node(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAllByType(View).filter(item => item.props.testID === id);
}

describe('品牌启动与数据库门禁', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const fn of [mockInit, mockSettings, mockAvatar, mockExercises, mockMeasurements]) fn.mockResolvedValue(undefined);
  });

  it('真实加载完成前不挂导航，完成后保留启动层直到淡出回调', async () => {
    let finishSettings!: () => void;
    mockSettings.mockReturnValue(new Promise<void>(resolve => { finishSettings = resolve; }));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<App />); });
    expect(node(tree, 'app')).toHaveLength(0);
    expect(node(tree, 'boot')[0].props.progress).toBe(1 / 5);
    expect(node(tree, 'boot')[0].props.statusLabel).toBe('设置');
    await act(async () => { finishSettings(); });
    expect(node(tree, 'app')).toHaveLength(1);
    expect(node(tree, 'boot')[0].props.progress).toBe(1);
    expect(node(tree, 'boot')[0].props.visible).toBe(false);
    act(() => node(tree, 'boot')[0].props.onHidden());
    expect(node(tree, 'boot')).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('SQLite onInit 失败时显示已有重试界面，布局后释放原生页', async () => {
    const logging = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockInit.mockRejectedValue(new Error('cannot open DB'));
    let tree!: TestRenderer.ReactTestRenderer;
    try {
      await act(async () => { tree = TestRenderer.create(<App />); });
      expect(node(tree, 'app')).toHaveLength(0);
      expect(node(tree, 'boot')).toHaveLength(0);
      const fallback = tree.root.findAllByType(View).find(item => item.props.onLayout)!;
      expect(fallback).toBeDefined();
      expect(mockHide).not.toHaveBeenCalled();
      act(() => fallback.props.onLayout());
      expect(mockHide).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith('出了点小问题，已切到安全界面', 'error');
      act(() => tree.unmount());
    } finally { logging.mockRestore(); }
  });

  it('设置加载失败不把启动屏留在界面上', async () => {
    const logging = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSettings.mockRejectedValue(new Error('settings unavailable'));
    let tree!: TestRenderer.ReactTestRenderer;
    try {
      await act(async () => { tree = TestRenderer.create(<App />); });
      expect(node(tree, 'app')).toHaveLength(1);
      expect(node(tree, 'boot')[0].props.visible).toBe(false);
      act(() => node(tree, 'boot')[0].props.onHidden());
      expect(node(tree, 'boot')).toHaveLength(0);
      expect(mockToast).toHaveBeenCalledWith('数据库初始化失败，部分功能不可用', 'error');
      act(() => tree.unmount());
    } finally { logging.mockRestore(); }
  });
});
