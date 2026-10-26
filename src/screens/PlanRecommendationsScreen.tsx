import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import {
  makeUniquePlanName,
  resolveTrainingPlanTemplate,
  TRAINING_PLAN_TEMPLATES,
  type TrainingPlanTemplate,
} from '@/features/plans/trainingPlanTemplates';
import { toast } from '@/hooks/useToast';
import { useExerciseStore } from '@/store/exerciseStore';
import { usePlanStore } from '@/store/planStore';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';

export function PlanRecommendationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography, radius } = useTheme();
  const exercises = useExerciseStore((state) => state.exercises);
  const exercisesLoading = useExerciseStore((state) => state.loading);
  const loadExercises = useExerciseStore((state) => state.load);
  const loadPlans = usePlanStore((state) => state.load);
  const createFromTemplate = usePlanStore((state) => state.createFromTemplate);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const exerciseState = useExerciseStore.getState();
    const planState = usePlanStore.getState();
    if (exerciseState.exercises.length === 0 && !exerciseState.loading) {
      void loadExercises();
    }
    if (planState.plans.length === 0 && !planState.loading) {
      void loadPlans();
    }
  }, [loadExercises, loadPlans]);

  const handleAdd = useCallback(
    async (template: TrainingPlanTemplate) => {
      if (importingId) return;
      setImportingId(template.id);
      try {
        if (useExerciseStore.getState().exercises.length === 0) {
          await useExerciseStore.getState().load();
        }
        const catalog = useExerciseStore.getState().exercises;
        const resolved = resolveTrainingPlanTemplate(template, catalog);
        if (resolved.missingExerciseNames.length > 0) {
          throw new Error(
            `缺少动作：${resolved.missingExerciseNames.join('、')}。请重启应用完成动作库升级后重试`,
          );
        }

        const currentPlans = usePlanStore.getState().plans;
        const name = makeUniquePlanName(
          template.name,
          currentPlans.map((plan) => plan.name),
        );
        await createFromTemplate({
          name,
          exercises: resolved.exercises.map((item) => ({
            exerciseId: item.exerciseId,
            restSeconds: item.restSeconds,
            sets: item.sets,
          })),
        });
        setAddedIds((current) => new Set([...current, template.id]));
        haptic.success();
        toast.show(`已添加“${name}”，可在私人计划中继续编辑`, 'success');
      } catch (error) {
        haptic.error();
        const message = error instanceof Error ? error.message : String(error);
        toast.show(`添加失败：${message}`, 'error');
      } finally {
        setImportingId(null);
      }
    },
    [createFromTemplate, importingId],
  );

  if (exercisesLoading && exercises.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
          正在准备推荐计划…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: insets.bottom + spacing.xxl,
        gap: spacing.md,
      }}
    >
      <View
        accessibilityRole="summary"
        style={{
          borderRadius: radius.lg,
          backgroundColor: colors.primaryMuted,
          padding: spacing.lg,
        }}
      >
        <Text style={[typography.h3, { color: colors.text }]}>选一个起点，再练成自己的版本</Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          添加后会生成独立的私人计划。动作、顺序、组数、目标次数和休息时长都可以继续修改。
        </Text>
      </View>

      {TRAINING_PLAN_TEMPLATES.map((template) => {
        const added = addedIds.has(template.id);
        const loading = importingId === template.id;
        const disabled = !!importingId || added;
        return (
          <Card key={template.id} elevated padding="lg">
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>
                  {template.name}
                </Text>
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, marginTop: spacing.xs },
                  ]}
                >
                  {template.description}
                </Text>
              </View>
              {added ? <Badge label="已添加" variant="success" size="sm" /> : null}
            </View>

            <View style={[styles.badgeRow, { marginTop: spacing.md, gap: spacing.xs }]}>
              <Badge
                label={template.difficulty}
                variant={template.difficulty === '入门' ? 'success' : 'warning'}
                size="sm"
              />
              <Badge label={`约 ${template.durationMinutes} 分钟`} variant="info" size="sm" />
              <Badge label={`${template.exercises.length} 个动作`} size="sm" />
              {template.focus.map((focus) => (
                <Badge key={focus} label={focus} variant="primary" size="sm" />
              ))}
            </View>

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {template.exercises.map((item, index) => (
                <View key={item.exerciseName} style={styles.exerciseRow}>
                  <View
                    accessible={false}
                    style={[
                      styles.index,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typography.label, { color: colors.textSecondary }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                    {item.exerciseName}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {item.sets.length} 组
                  </Text>
                </View>
              ))}
            </View>

            <Button
              variant={added ? 'secondary' : 'primary'}
              size="lg"
              loading={loading}
              disabled={disabled}
              onPress={() => void handleAdd(template)}
              style={{ alignSelf: 'stretch', marginTop: spacing.lg }}
              accessibilityLabel={added ? `已添加 ${template.name}` : `添加 ${template.name} 到私人计划`}
              accessibilityHint={added ? undefined : '添加后可在锻炼页继续编辑'}
            >
              {added ? '已添加到私人计划' : '添加到私人计划'}
            </Button>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exerciseRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  index: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
