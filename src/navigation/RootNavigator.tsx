/**
 * Root navigator.
 *
 * G1 surface: a bottom-tab navigator with three tabs.
 * G4 addition: wraps the tab navigator in a native-stack navigator so that
 * the exercise-library (Stack) screen can be pushed on top. Stack screens
 * registered here automatically pick up the active theme via `useTheme()`.
 * G10 addition: registers the Settings Stack screen, reachable from the
 * "我的" tab. More screens (PlanCreate / TrainingIn / etc.) will follow.
 * G6 addition: registers the ActiveTraining Stack screen with full-screen
 * immersive mode (header hidden, iOS gesture disabled, fade animation)
 * and Android back-handler interception happens inside the screen itself.
 * G8 addition: registers the TrainingComplete summary screen — full-screen
 * with gesture disabled, forcing users to tap "完成" to leave.
 */

import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ActiveTrainingScreen } from '@/screens/ActiveTrainingScreen';
import { BodyMeasurementEditScreen } from '@/screens/BodyMeasurementEditScreen';
import { BodyMeasurementScreen } from '@/screens/BodyMeasurementScreen';
import { DiagnosticsScreen } from '@/screens/DiagnosticsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { TrainingCompleteScreen } from '@/screens/TrainingCompleteScreen';
import { TrainingDetailScreen } from '@/screens/TrainingDetailScreen';
import { DataOverviewScreen } from '@/screens/data/DataOverviewScreen';
import { CalendarHeatmapScreen } from '@/screens/data/CalendarHeatmapScreen';
import { VolumeTrendScreen } from '@/screens/data/VolumeTrendScreen';
import { MuscleGroupDistributionScreen } from '@/screens/data/MuscleGroupDistributionScreen';
import { OneRMRecordsScreen } from '@/screens/data/OneRMRecordsScreen';
import { ExerciseHistoryScreen } from '@/screens/ExerciseHistoryScreen';
import { useTheme } from '@/theme';

import { Showcase } from '@/screens/_dev/Showcase';

import { ExerciseDetailScreen } from '@/screens/ExerciseDetailScreen';
import { ExerciseLibraryScreen } from '@/screens/ExerciseLibraryScreen';
import { PlanEditorScreen } from '@/screens/PlanEditorScreen';
import { PlanRecommendationsScreen } from '@/screens/PlanRecommendationsScreen';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

export type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function buildNavTheme(scheme: 'light' | 'dark', colors: ReturnType<typeof useTheme>['colors']): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surfaceElevated,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };
}

export function RootNavigator() {
  const { scheme, colors } = useTheme();
  return (
    <NavigationContainer theme={buildNavTheme(scheme, colors)}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surfaceElevated },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: 17, fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ExerciseLibrary"
          component={ExerciseLibraryScreen}
          options={{ title: '动作库' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: '设置' }}
        />
        <Stack.Screen
          name="Diagnostics"
          component={DiagnosticsScreen}
          options={{ title: '诊断' }}
        />
        <Stack.Screen
          name="PlanEditor"
          component={PlanEditorScreen}
          options={({ route }) => ({
            title: route.params?.planId ? '编辑计划' : '新建计划',
          })}
        />
        <Stack.Screen
          name="PlanRecommendations"
          component={PlanRecommendationsScreen}
          options={{ title: '推荐训练计划' }}
        />
        <Stack.Screen
          name="ActiveTraining"
          component={ActiveTrainingScreen}
          options={{
            headerShown: false,
            gestureEnabled: false, // iOS: disable swipe-to-go-back
            animation: 'fade', // full-screen immersive
          }}
        />
        <Stack.Screen
          name="TrainingComplete"
          component={TrainingCompleteScreen}
          options={{
            headerShown: false,
            gestureEnabled: false, // G8: 用户必须点"完成"才能离开
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="TrainingDetail"
          component={TrainingDetailScreen}
          options={{ title: '训练详情' }}
        />
        <Stack.Screen
          name="Showcase"
          component={Showcase}
          options={{ title: '组件 Showcase（开发自检）' }}
        />
        {/* G18 — 数据可视化 4 屏 + 总览 */}
        <Stack.Screen
          name="DataOverview"
          component={DataOverviewScreen}
          options={{ title: '数据' }}
        />
        <Stack.Screen
          name="CalendarHeatmap"
          component={CalendarHeatmapScreen}
          options={{ title: '日历热力图' }}
        />
        <Stack.Screen
          name="VolumeTrend"
          component={VolumeTrendScreen}
          options={{ title: '训练量趋势' }}
        />
        <Stack.Screen
          name="MuscleGroupDistribution"
          component={MuscleGroupDistributionScreen}
          options={{ title: '肌群分布' }}
        />
        <Stack.Screen
          name="OneRMRecords"
          component={OneRMRecordsScreen}
          options={{ title: '1RM 记录' }}
        />
        {/* G32 — 单动作历史下钻（1RM 趋势线 + 容量柱状）。 */}
        <Stack.Screen
          name="ExerciseHistory"
          component={ExerciseHistoryScreen}
          options={({ route }) => ({
            title: route.params?.exerciseId ? '动作历史' : '动作历史',
          })}
        />
        {/* G35 §4 — 动作详情正式屏(从 store 查 exercise;GIF/中文步骤/署名)。 */}
        <Stack.Screen
          name="ExerciseDetail"
          component={ExerciseDetailScreen}
          options={{ title: '动作详情' }}
        />
        {/* US-12 — 身体测量(列表 + 趋势 + FAB)。 */}
        <Stack.Screen
          name="BodyMeasurement"
          component={BodyMeasurementScreen}
          options={{ title: '身体测量' }}
        />
        {/* US-12 — 单条录入 / 编辑。 */}
        <Stack.Screen
          name="BodyMeasurementEdit"
          component={BodyMeasurementEditScreen}
          options={({ route }) => ({
            title: route.params?.measurementId ? '编辑记录' : '记录',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
