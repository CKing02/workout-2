/**
 * ExerciseFormSheet — 自定义动作的创建 / 编辑表单（Sheet 内容）。
 *
 * 抽离自 G15 ExerciseLibraryScreen.CreateExerciseForm,在 ⋯ 「动作详情」
 * 屏添加的「编辑」入口也复用本组件。两种场景:
 * - `mode: 'create'` —— 写入一条新自定义动作,需要 `onSubmit` 接 createCustom。
 * - `mode: 'edit'`   —— 编辑已有自定义动作,`initial` 提供字段初值,
 *                     `onSubmit` 接 update;提交按钮文案变 "保存"。
 *
 * 设计要点:
 * - title 在 Sheet 容器层定,本组件只关心 mode/initial。
 * - 不在本组件内做 create/update 区分 —— 父级决定怎么用 input。
 */

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/constants';
import {
  METRIC_TYPES,
  findMetricType,
  type MetricType,
} from '@/constants/metricTypes';
import type { Exercise } from '@/db/schema';
import { toast } from '@/hooks/useToast';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';

export interface ExerciseFormInput {
  name: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  metricType: string;
}

export interface ExerciseFormSheetProps {
  mode: 'create' | 'edit';
  /** edit mode 必填,作为字段初值。 */
  initial?: Exercise;
  onSubmit: (input: ExerciseFormInput) => void | Promise<void>;
  onCancel: () => void;
}

const DEFAULT_METRIC_TYPE: MetricType['value'] =
  METRIC_TYPES[0]?.value ?? 'reps';
const DEFAULT_EQUIPMENT = EQUIPMENT[0] ?? '杠铃';
const DEFAULT_PRIMARY = MUSCLE_GROUPS[0] ?? '胸';

export function ExerciseFormSheet({
  mode,
  initial,
  onSubmit,
  onCancel,
}: ExerciseFormSheetProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const [name, setName] = useState<string>(initial?.name ?? '');
  const [primary, setPrimary] = useState<string>(
    initial?.muscleGroup ?? DEFAULT_PRIMARY,
  );
  const [secondary, setSecondary] = useState<Set<string>>(
    () => new Set(initial?.secondaryMuscles ?? []),
  );
  const [equipment, setEquipment] = useState<string>(
    initial?.equipment ?? DEFAULT_EQUIPMENT,
  );
  const [metricType, setMetricType] = useState<MetricType['value']>(
    (findMetricType(initial?.metricType ?? '')?.value as MetricType['value']) ??
      DEFAULT_METRIC_TYPE,
  );

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0;
  const submitLabel = mode === 'edit' ? '保存' : '保存';
  const submitA11yLabel =
    mode === 'edit' ? '保存编辑后的动作' : '保存自定义动作';

  const toggleSecondary = useCallback(
    (group: string) => {
      // G15 自检：主要肌群不应同时出现在次要肌群里。
      if (group === primary) return;
      setSecondary((prev) => {
        const next = new Set(prev);
        if (next.has(group)) next.delete(group);
        else next.add(group);
        return next;
      });
    },
    [primary],
  );

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

  const handleSubmit = useCallback(async () => {
    if (!canSave) {
      // 防御兜底：按钮在 canSave=false 时已 disabled，但用户可能用键盘外的方式触发。
      toast.show('请输入动作名称', 'warning');
      return;
    }
    await onSubmit({
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
        <Text style={[typography.label, { color: colors.textSecondary }]}>
          名称 *
        </Text>
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
        <Text style={[typography.label, { color: colors.textSecondary }]}>
          主要肌群 *
        </Text>
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
                    {
                      color: active ? colors.onPrimary : colors.text,
                      fontSize: 13,
                    },
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
        <Text style={[typography.label, { color: colors.textSecondary }]}>
          器械 *
        </Text>
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
        <Text style={[typography.label, { color: colors.textSecondary }]}>
          运动类型 *
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 2 }}
        >
          <SegmentedControl
            value={metricType}
            onChange={(v) => setMetricType(v as MetricType['value'])}
            options={METRIC_TYPES.map((m) => ({
              label: m.label,
              value: m.value,
            }))}
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
          accessibilityLabel="取消"
        >
          取消
        </Button>
        <Button
          variant="primary"
          size="md"
          onPress={handleSubmit}
          disabled={!canSave}
          style={{ flex: 1 }}
          accessibilityLabel={submitA11yLabel}
        >
          {submitLabel}
        </Button>
      </View>
    </ScrollView>
  );
}
