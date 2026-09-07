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
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { SegmentedControl, type SegmentedOption } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/constants';
import { METRIC_TYPES, type MetricType } from '@/constants/metricTypes';
import type { Exercise } from '@/db/schema';
import { toast } from '@/hooks/useToast';
import { useExerciseStore } from '@/store/exerciseStore';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';

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
  /** G15: 自定义动作删除入口（非多选模式 + isCustom 时显示）。 */
  onDelete: (item: Exercise) => void;
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
  /**
   * G26: browse mode. Entered from the Profile "动作库" entry — user wants
   * to look around, not pick. selectMode is locked to false, the header
   * ☑/完成 toggle is hidden, and long-press doesn't enable multi-select.
   * Existing per-row affordances (search / filter / +create / custom-delete)
   * keep working as in the multiple/single modes.
   */
  const browseMode = mode === 'browse';
  const headerTitle = route.params?.title;

  const { colors, spacing, typography } = useTheme();

  const exercises = useExerciseStore((s) => s.exercises);
  const loading = useExerciseStore((s) => s.loading);
  const loadExercises = useExerciseStore((s) => s.load);
  const createCustom = useExerciseStore((s) => s.create);
  const removeCustom = useExerciseStore((s) => s.remove);

  const [filters, setFilters] = useState<FilterState>({
    query: '',
    muscleGroup: ALL,
    equipment: ALL,
  });
  const [selectMode, setSelectMode] = useState<boolean>(mode === 'multiple' && !browseMode);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds));
  // G15: 自定义动作的创建 Sheet + 删除确认 Dialog。
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);

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
    if (browseMode) return; // G26: browse mode = locked browse, no toggle.
    setSelectMode((prev) => {
      if (prev) {
        // Exiting — clear selection.
        setSelected(new Set());
        return false;
      }
      return true;
    });
  }, [browseMode]);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...(headerTitle ? { title: headerTitle } : null),
      headerRight: () => (
        <View style={styles.headerRight}>
          {/* G15: 「+」始终在左边；多选 / 完成模式时不显示（避免误触）。
              G26: browse mode 也保留 `+`，让用户能新建自定义动作。 */}
          {!selectMode ? (
            <Pressable
              onPress={() => {
                haptic.selection();
                setCreateSheetOpen(true);
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="新建自定义动作"
              accessibilityHint="弹出创建表单 Sheet"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: 8 })}
            >
              <Text style={[typography.title, { color: colors.primary, fontSize: 22 }]}>＋</Text>
            </Pressable>
          ) : null}
          {/* G26: browse 模式隐藏 ☑/完成 切换按钮（browse 不进入选择态） */}
          {browseMode ? null : (
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
          )}
        </View>
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
    browseMode,
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
    // G26: browse mode 锁死浏览态，不进入选择模式。
    if (browseMode) return;
    setSelectMode(true);
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }, [browseMode]);

  const onItemToggle = useCallback((item: Exercise) => {
    setSelected((prev) => toggleInSet(prev, item.id));
  }, []);

  // ------------------------------------------------------------------
  // G15: 自定义动作的创建 / 删除。
  // 创建后写 exerciseStore.create → DB 插入 is_custom=1 行，列表立即
  // 出现（listExercises 已按 is_custom ASC 排序，自定在底部）。
  // 删除走 exerciseStore.remove → 仅能删自定义动作（内置动作无入口）。
  // ------------------------------------------------------------------
  const handleCreateCustom = useCallback(
    async (input: {
      name: string;
      muscleGroup: string;
      secondaryMuscles: string[];
      equipment: string;
      metricType: string;
    }) => {
      try {
        await createCustom({ ...input, isCustom: true });
        haptic.success();
        toast.show(`已创建「${input.name}」`, 'success');
        setCreateSheetOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.show('创建失败：' + msg, 'error');
      }
    },
    [createCustom],
  );

  const handleDeleteRequest = useCallback((item: Exercise) => {
    setDeleteDialog({ id: item.id, name: item.name });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDialog) return;
    const { id, name } = deleteDialog;
    setDeleteDialog(null);
    try {
      await removeCustom(id);
      haptic.warning();
      toast.show(`已删除「${name}」`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show('删除失败：' + msg, 'error');
    }
  }, [deleteDialog, removeCustom]);

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
        onDelete={handleDeleteRequest}
      />
    ),
    [
      selectMode,
      selected,
      onItemPress,
      onItemLongPress,
      onItemToggle,
      handleDeleteRequest,
    ],
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

      {/* G11 picker hint — tells the user what to do next and why 完成 is dim.
          G26: browse 模式也不显示（browse 不进入选择）。 */}
      {pickerMode && !browseMode ? (
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

      {/* G15: 自定义动作创建 Sheet */}
      <Sheet
        visible={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        title="新建自定义动作"
        maxHeightRatio={0.85}
      >
        <CreateExerciseForm
          onSubmit={handleCreateCustom}
          onCancel={() => setCreateSheetOpen(false)}
        />
      </Sheet>

      {/* G15: 删除确认 Dialog */}
      <Dialog
        visible={deleteDialog !== null}
        title="删除自定义动作？"
        message={
          deleteDialog
            ? `「${deleteDialog.name}」将被永久删除，不影响已用此动作创建的训练记录。`
            : ''
        }
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog(null)}
      />
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

  // G26a: paddingHorizontal 提到外层 View —— 之前写在 ScrollView
  // contentContainerStyle 时，"全部" chip 在某些设备贴左、右侧 chip 被
  // 屏幕切掉。和下面 EquipmentControl 的包装方式保持一致。
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
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
    </View>
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

function Row({ item, selectMode, checked, onPress, onLongPress, onToggle, onDelete }: RowProps) {
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text
                style={[typography.subtitle, { color: colors.text, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.isCustom ? (
                <Badge label="自定" variant="info" size="sm" />
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 }}>
              <Badge label={item.muscleGroup} variant={muscleGroupVariant(item.muscleGroup)} size="sm" />
              <Badge label={item.equipment} variant="default" size="sm" />
            </View>
          </View>

          {/* G15: 自定义动作的删除入口（非多选模式） */}
          {!selectMode && item.isCustom ? (
            <Pressable
              onPress={() => onDelete(item)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`删除自定义动作 ${item.name}`}
              accessibilityHint="弹出二次确认对话框"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ color: colors.danger, fontSize: 18, fontWeight: '700' }}>×</Text>
            </Pressable>
          ) : null}
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
// G15: 自定义动作创建表单（Sheet 内容）
// ===========================================================================

interface CreateExerciseFormProps {
  onSubmit: (input: {
    name: string;
    muscleGroup: string;
    secondaryMuscles: string[];
    equipment: string;
    metricType: string;
  }) => void;
  onCancel: () => void;
}

const DEFAULT_METRIC_TYPE: MetricType['value'] = METRIC_TYPES[0]?.value ?? 'reps';
const DEFAULT_EQUIPMENT = EQUIPMENT[0] ?? '杠铃';
const DEFAULT_PRIMARY = MUSCLE_GROUPS[0] ?? '胸';

function CreateExerciseForm({ onSubmit, onCancel }: CreateExerciseFormProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState<string>(DEFAULT_PRIMARY);
  const [secondary, setSecondary] = useState<Set<string>>(() => new Set());
  const [equipment, setEquipment] = useState<string>(DEFAULT_EQUIPMENT);
  const [metricType, setMetricType] = useState<MetricType['value']>(DEFAULT_METRIC_TYPE);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0;

  const toggleSecondary = useCallback((group: string) => {
    // G15 自检：主要肌群不应同时出现在次要肌群里。
    if (group === primary) return;
    setSecondary((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, [primary]);

  const handleChangePrimary = useCallback((group: string) => {
    haptic.selection();
    setPrimary(group);
    // G15 自检：换主肌群时把旧的「主」从次要集合里清掉。
    setSecondary((prev) => {
      if (!prev.has(group)) return prev;
      const next = new Set(prev);
      next.delete(group);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSave) {
      // 防御兜底：按钮在 canSave=false 时已 disabled，但用户可能用键盘外的方式触发。
      toast.show('请输入动作名称', 'warning');
      return;
    }
    onSubmit({
      name: trimmedName,
      muscleGroup: primary,
      secondaryMuscles: Array.from(secondary),
      equipment,
      metricType,
    });
  }, [canSave, trimmedName, primary, secondary, equipment, metricType, onSubmit]);

  return (
    <ScrollView
      style={{ width: '100%' }}
      contentContainerStyle={{ paddingBottom: spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {/* 名称 */}
      <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
        <Text style={[typography.label, { color: colors.textSecondary }]}>名称 *</Text>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="例如：蝴蝶机夹胸"
          autoCorrect={false}
          maxLength={32}
        />
      </View>

      {/* 主要肌群（单选 chip） */}
      <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
        <Text style={[typography.label, { color: colors.textSecondary }]}>主要肌群 *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}
        >
          {MUSCLE_GROUPS.map((g) => {
            const active = g === primary;
            return (
              <Pressable
                key={g}
                onPress={() => handleChangePrimary(g)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
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
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 次要肌群（多选 chip） */}
      <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
        <Text style={[typography.label, { color: colors.textSecondary }]}>
          次要肌群（可多选）
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}
        >
          {MUSCLE_GROUPS.map((g) => {
            // G15 自检：主要肌群不可同时作为次要肌群——视觉禁用 + 不响应点击。
            const disabled = g === primary;
            const active = secondary.has(g);
            return (
              <Pressable
                key={g}
                onPress={() => toggleSecondary(g)}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active, disabled }}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                  backgroundColor: active
                    ? colors.primaryMuted
                    : disabled
                    ? colors.surfaceMuted
                    : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: active
                    ? colors.primary
                    : disabled
                    ? colors.border
                    : colors.border,
                  opacity: disabled ? 0.4 : 1,
                })}
              >
                <Text
                  style={[
                    typography.label,
                    {
                      color: disabled
                        ? colors.textTertiary
                        : active
                        ? colors.primaryPressed
                        : colors.text,
                      fontSize: 13,
                    },
                  ]}
                >
                  {disabled ? `${g}（主）` : active ? `✓ ${g}` : g}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 器械 */}
      <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
        <Text style={[typography.label, { color: colors.textSecondary }]}>器械 *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 2 }}
        >
          <SegmentedControl
            value={equipment}
            onChange={setEquipment}
            options={EQUIPMENT.map((eq) => ({ label: eq, value: eq }))}
          />
        </ScrollView>
      </View>

      {/* 运动类型 */}
      <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
        <Text style={[typography.label, { color: colors.textSecondary }]}>运动类型 *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 2 }}
        >
          <SegmentedControl
            value={metricType}
            onChange={(v) => setMetricType(v as MetricType['value'])}
            options={METRIC_TYPES.map((m) => ({ label: m.label, value: m.value }))}
          />
        </ScrollView>
      </View>

      {/* 按钮行 */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          variant="secondary"
          size="md"
          onPress={onCancel}
          style={{ flex: 1 }}
          accessibilityLabel="取消创建"
        >
          取消
        </Button>
        <Button
          variant="primary"
          size="md"
          onPress={handleSubmit}
          disabled={!canSave}
          style={{ flex: 1 }}
          accessibilityLabel="保存自定义动作"
        >
          保存
        </Button>
      </View>
    </ScrollView>
  );
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});