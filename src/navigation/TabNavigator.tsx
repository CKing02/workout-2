/**
 * Tab navigator — root surface for the app.
 *
 * Three tabs: 首页 / 锻炼 / 我的, each wired to its real screen
 * (HomeScreen / TrainingScreen / ProfileScreen — G5 / G9 / G10 long landed).
 *
 * Navigation icons share the same rounded-outline SVG language used across
 * the rest of the app, so they stay crisp and consistent on every device.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

import { HomeScreen } from '@/screens/HomeScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { TrainingScreen } from '@/screens/TrainingScreen';
import { AppIcon, type AppIconName } from '@/components';
import { useTheme } from '@/theme';

import type { RootStackParamList, TabParamList } from './types';

export type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * RootStack screen names whose focused state means the bottom Tab bar
 * should be hidden. Both immersive training surfaces live on RootStack
 * (siblings of Tabs), so when they cover the screen we hide the bar to
 * match the spec ("无 Tab 栏").
 */
const IMMERSIVE_ROUTES: ReadonlyArray<keyof RootStackParamList> = [
  'ActiveTraining',
  'TrainingComplete',
];

interface TabIconProps {
  name: AppIconName;
  focused: boolean;
  color: string;
}

function TabIcon({ name, focused, color }: TabIconProps) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.iconWrap,
        {
          backgroundColor: focused ? colors.primaryMuted : colors.transparent,
          borderRadius: radius.full,
        },
      ]}
    >
      <AppIcon
        name={name}
        size={22}
        color={focused ? colors.primaryPressed : color}
        strokeWidth={focused ? 2.2 : 1.8}
      />
    </View>
  );
}

export function TabNavigator() {
  const { colors, typography } = useTheme();
  // Loose typing here: `useNavigation()` is typed against the parent
  // navigator (RootStack), but this component IS the BottomTab navigator
  // — `setOptions({ tabBarStyle })` only exists on the Tab options type.
  // Cast to a permissive NavigationProp so `setOptions` accepts the full
  // union of Stack + Tab options without runtime impact.
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  /**
   * React Navigation v7's `navigation.getParent(id)` only walks ancestors.
   * Tabs is a SIBLING of ActiveTraining/TrainingComplete under RootStack,
   * so the immersive screens can't reach Tabs from themselves — but Tabs
   * CAN listen to its parent (RootStack) and react. This effect keeps
   * `tabBarStyle` in sync with the focused route, applying `display: 'none'`
   * when an immersive route covers the screen.
   */
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;

    const syncTabBar = () => {
      const state = parent.getState();
      const focusedRoute = state.routes[state.index];
      const immersive =
        focusedRoute != null &&
        (IMMERSIVE_ROUTES as ReadonlyArray<string>).includes(focusedRoute.name);

      if (immersive) {
        navigation.setOptions({ tabBarStyle: { display: 'none' } });
      } else {
        navigation.setOptions({
          tabBarStyle: {
            backgroundColor: colors.surfaceElevated,
            borderTopColor: colors.divider,
            height: 60,
            paddingTop: 6,
            paddingBottom: 8,
          },
        });
      }
    };

    syncTabBar();
    const unsubscribe = parent.addListener('state', syncTabBar);
    return unsubscribe;
  }, [navigation, colors.surfaceElevated, colors.divider]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: typography.title,
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surfaceElevated,
          borderTopColor: colors.divider,
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '首页',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Training"
        component={TrainingScreen}
        options={{
          title: '锻炼',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="dumbbell" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: '我的',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="profile" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
