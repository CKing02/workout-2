/**
 * ExerciseLibraryScreen — G4 动作库浏览 + 搜索 + 多选
 *
 * Layout (top → bottom):
 *   1. Live-filter search input (real-time, no enter required).
 *   2. Horizontal-scroll muscle-group tabs (`MUSCLE_GROUPS` + 全部).
 *   3. Equipment `SegmentedControl` (`EQUIPMENT` + 全部).
 *   4. Exercise list (FlatList of `Card`s, first-letter avatar, muscle badge).
 *   5. Multi-select: header-right toggles between `☑` and `完成(N)`.
 *
 * Filters compose (search ∧ muscle ∧ equipment) using in-memory filtering —
 * the catalog is small (~32 rows in G2 seed) so going back to SQL for each
 * keystroke would be wasteful.
 *
 * G11 addition — **picker mode**: when the caller passes `onSelect` in the
 * route params, "完成(N)" invokes it and pops instead of round-tripping
 * through `Tabs -> Training.params.selectedExerciseIds` (the G4 path, kept
 * intact). Picker mode also requires ≥1 selection and shows a hint line.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Badge, type BadgeVariant } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { SegmentedControl, type SegmentedOption } from '@/components/SegmentedControl';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/constants';
import type { Exercise } from '@/db/schema';
import { useExerciseStore } from '@/store/exerciseStore';
import { useTheme } from '@/theme';

import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ExerciseLibrary'>;
type ScreenRoute = RouteProp<RootStackParamList, 'ExerciseLibrary'>;

const ALL = 'all';
const ROW_HEIGHT = 76;
const ROW_GAP = 8;

interface FilterState {
  query: string;
  muscleGroup: string;
  equipment: string;
}

interface RowProps {
  item: Exercise;
  selectMode: boolean;
  checked: boolean;
  onPress: (item: Exercise) => void;
  onLongPress: (item: Exercise) => void;
  onToggle: (item: Exercise) => void;
}

export function ExerciseLibraryScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ScreenRoute>();

  const mode = route.params?.mode ?? 'multiple';
  const initialSelectedIds = route.params?.initialSelectedIds ?? [];
  /**
   * G11: picker mode. When the caller passes `onSelect` we hand the IDs
   * straight back and pop, instead of the G4 round-trip through
   * `Tabs -> Training.params.selectedExerciseIds`.
   */
  const onSelect = route.params?.onSelect;
  const pickerMode = typeof onSelect === 'function';
  const headerTitle = route.params?.title;

  const { colors, spacing, typography } = useTheme();

  const exercises = useExerciseStore((s) => s.exercises);
  const loading = useExerciseStore((s) => s.loading);
  const loadExercises = useExerciseStore((s) => s.load);

  const [filters, setFilters] = useState<FilterState>({
    query: '',
    muscleGroup: ALL,
    equipment: ALL,
  });
  const [selectMode, setSelectMode] = useState<boolean>(mode === 'multiple');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds));

  // ------------------------------------------------------------------
  // Data loading — pull from store, never duplicate.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (exercises.length === 0 && !loading) {
      void loadExercises();
    }
    // We intentionally only react to the length / loading flag, not the
    // array reference, to avoid re-fetching when other parts of the store
    // touch `exercises` (e.g. custom-exercise creation later on).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Header right: `☑` toggle or `完成(N)` confirm.
  // ------------------------------------------------------------------
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const onConfirm = useCallback(() => {
    const ids = Array.from(selected);

    // G11 picker: hand the selection to the caller and pop. Requires ≥1
    // exercise (AC-11.1) — the header button is disabled at 0, this is the
    // defensive twin of that guard.
    if (onSelect) {
      if (ids.length === 0) return;
      onSelect(ids);
      navigation.goBack();
      return;
    }

    // G4 legacy path — pass the IDs back to the Training tab. React
    // Navigation merges the params into the existing route, so TrainingScreen
    // re-renders and picks them up via its `route.params` effect.
    navigation.navigate('Tabs', {
      screen: 'Training',
      params: { selectedExerciseIds: ids },
    });
  }, [selected, onSelect, navigation]);

  const onToggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) {
        // Exiting — clear selection.
        setSelected(new Set());
        return false;
      }
      return true;
    });
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...(headerTitle ? { title: headerTitle } : null),
      headerRight: () => (
        <HeaderRight
          selectMode={selectMode}
          count={selected.size}
          accent={colors.primary}
          typography={typography}
          // Picker mode must not return an empty selection (G11 AC-11.1).
          disabled={pickerMode && selected.size === 0}
          onToggle={onToggleSelectMode}
          onConfirm={onConfirm}
        />
      ),
    });
  }, [
    navigation,
    selectMode,
    selected.size,
    colors.primary,
    typography,
    headerTitle,
    pickerMode,
    onToggleSelectMode,
    onConfirm,
  ]);

  // ------------------------------------------------------------------
  // Filtering — composes all three filters in-memory.
  // ------------------------------------------------------------------
  const filtered = useMemo<Exercise[]>(() => {
    const q = filters.query.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (filters.muscleGroup !== ALL && ex.muscleGroup !== filters.muscleGroup) {
        return false;
      }
      if (filters.equipment !== ALL && ex.equipment !== filters.equipment) {
        return false;
      }
      if (q && !ex.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [exercises, filters]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const onChangeQuery = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, query: next }));
  }, []);

  const onChangeMuscle = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, muscleGroup: next }));
  }, []);

  const onChangeEquipment = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, equipment: next }));
  }, []);

  const onClearFilters = useCallback(() => {
    setFilters({ query: '', muscleGroup: ALL, equipment: ALL });
  }, []);

  const onItemPress = useCallback(
    (item: Exercise) => {
      if (selectMode) {
        setSelected((prev) => toggleInSet(prev, item.id));
      }
    },
    [selectMode],
  );

  const onItemLongPress = useCallback((item: Exercise) => {
    setSelectMode(true);
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }, []);

  const onItemToggle = useCallback((item: Exercise) => {
    setSelected((prev) => toggleInSet(prev, item.id));
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const renderItem: ListRenderItem<Exercise> = useCallback(
    ({ item }) => (
      <Row
        item={item}
        selectMode={selectMode}
        checked={selected.has(item.id)}
        onPress={onItemPress}
        onLongPress={onItemLongPress}
        onToggle={onItemToggle}
      />
    ),
    [selectMode, selected, onItemPress, onItemLongPress, onItemToggle],
  );

  const isLoading = loading && exercises.length === 0;
  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Input
          value={filters.query}
          onChangeText={onChangeQuery}
          placeholder="搜索动作名称"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Muscle-group tabs */}
      <MuscleTabs value={filters.muscleGroup} onChange={onChangeMuscle} />

      {/* Equipment segmented control */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <EquipmentControl value={filters.equipment} onChange={onChangeEquipment} />
      </View>

      {/* G11 picker hint — tells the user what to do next and why 完成 is dim */}
      {pickerMode ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={[
              typography.caption,
              {
                color: selected.size === 0 ? colors.textTertiary : colors.primaryPressed,
              },
            ]}
          >
            {selected.size === 0
              ? '至少选择 1 个动作，然后点右上角「完成」开始'
              : `已选 ${selected.size} 个动作 · 点右上角「完成」开始训练`}
          </Text>
        </View>
      ) : null}

      {/* List / loading / empty */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isEmpty ? (
        <EmptyState
          icon="🔍"
          title="没有匹配的动作"
          description="试试其他筛选"
          actionLabel="清除筛选"
          onAction={onClearFilters}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          getItemLayout={getItemLayout}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxxl,
          }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={12}
          windowSize={9}
        />
      )}
    </View>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

interface HeaderRightProps {
  selectMode: boolean;
  count: number;
  accent: string;
  typography: ReturnType<typeof useTheme>['typography'];
  /** Picker mode with 0 selected — dim + non-interactive (error prevention). */
  disabled?: boolean;
  onToggle: () => void;
  onConfirm: () => void;
}

function HeaderRight({
  selectMode,
  count,
  accent,
  typography,
  disabled = false,
  onToggle,
  onConfirm,
}: HeaderRightProps) {
  if (!selectMode) {
    return (
      <Pressable
        onPress={onToggle}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="进入多选模式"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: 8 })}
      >
        <Text style={[typography.title, { color: accent, fontSize: 22 }]}>☑</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={disabled ? undefined : onConfirm}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`完成选择，共 ${count} 项`}
      accessibilityHint={disabled ? '至少选择 1 个动作' : undefined}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        paddingHorizontal: 8,
      })}
    >
      <Text style={[typography.title, { color: accent }]}>完成{count > 0 ? `(${count})` : ''}</Text>
    </Pressable>
  );
}

interface MuscleTabsProps {
  value: string;
  onChange: (next: string) => void;
}

function MuscleTabs({ value, onChange }: MuscleTabsProps) {
  const { colors, spacing, typography, radius } = useTheme();

  const tabs: Array<{ key: string; label: string }> = useMemo(() => {
    return [{ key: ALL, label: '全部' }, ...MUSCLE_GROUPS.map((m) => ({ key: m, label: m }))];
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
      }}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + 2,
              borderRadius: radius.full,
              backgroundColor: active
                ? colors.primary
                : pressed
                ? colors.surfaceMuted
                : colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: active ? colors.primary : colors.border,
            })}
          >
            <Text
              style={[
                typography.label,
                { color: active ? colors.onPrimary : colors.text, fontSize: 13 },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

interface EquipmentControlProps {
  value: string;
  onChange: (next: string) => void;
}

function EquipmentControl({ value, onChange }: EquipmentControlProps) {
  const options: SegmentedOption<string>[] = useMemo(() => {
    return [
      { label: '全部', value: ALL },
      ...EQUIPMENT.map((eq) => ({ label: eq, value: eq })),
    ];
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 2 }}
    >
      <SegmentedControl
        value={value}
        onChange={onChange}
        options={options}
      />
    </ScrollView>
  );
}

function Row({ item, selectMode, checked, onPress, onLongPress, onToggle }: RowProps) {
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={350}
      accessibilityRole={selectMode ? 'checkbox' : 'button'}
      accessibilityState={{ checked: selectMode ? checked : undefined }}
      accessibilityLabel={item.name}
    >
      <Card padding="sm" style={{ minHeight: ROW_HEIGHT - 8 }}>
        <View style={[styles.rowInner, { gap: spacing.md }]}>
          {/* Checkbox (multi-select only) */}
          {selectMode ? (
            <Pressable
              onPress={() => onToggle(item)}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              style={({ pressed }) => ({
                width: 24,
                height: 24,
                borderRadius: radius.xs,
                borderWidth: 2,
                borderColor: checked ? colors.primary : colors.border,
                backgroundColor: checked ? colors.primary : colors.transparent,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
                marginLeft: spacing.xs,
              })}
            >
              {checked ? (
                <Text style={{ color: colors.onPrimary, fontWeight: '900', fontSize: 14 }}>✓</Text>
              ) : null}
            </Pressable>
          ) : (
            <Avatar name={item.name} />
          )}

          {/* Name + badges */}
          <View style={{ flex: 1 }}>
            <Text
              style={[typography.subtitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 }}>
              <Badge label={item.muscleGroup} variant={muscleGroupVariant(item.muscleGroup)} size="sm" />
              <Badge label={item.equipment} variant="default" size="sm" />
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function Avatar({ name }: { name: string }) {
  const { colors, radius } = useTheme();
  // First grapheme; for CJK strings the first "character" is the whole ideograph.
  const initial = name.trim().charAt(0) || '·';
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.full,
        backgroundColor: colors.primaryMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.primaryPressed, fontWeight: '700', fontSize: 16 }}>
        {initial}
      </Text>
    </View>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <View style={{ height: ROW_GAP - spacing.xs }} />;
}

// ===========================================================================
// Helpers
// ===========================================================================

function toggleInSet(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function keyExtractor(item: Exercise): string {
  return item.id;
}

function getItemLayout(_data: ArrayLike<Exercise> | null | undefined, index: number) {
  return {
    length: ROW_HEIGHT,
    offset: (ROW_HEIGHT + ROW_GAP) * index,
    index,
  };
}

function muscleGroupVariant(group: string): BadgeVariant {
  switch (group) {
    case '胸':
      return 'danger';
    case '背':
      return 'info';
    case '肩':
      return 'warning';
    case '二头':
    case '三头':
    case '前臂':
      return 'primary';
    case '腹':
    case '股四头':
    case '腘绳':
    case '臀':
    case '小腿':
      return 'success';
    default:
      return 'default';
  }
}

// ===========================================================================
// Styles (only structural — colors come from theme)
// ===========================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});