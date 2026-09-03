/**
 * TrainingDetailScreen — G9 历史训练详情（只读）
 *
 * 布局（自上而下）：
 *  1. 顶部 Header 行（默认导航栏 + 右上"删除" IconButton → Dialog 二次确认）
 *  2. 总结面板 Card：日期 / 时长 / 训练量 / 动作数 / 组数
 *  3. 动作列表：每个动作一个 Card
 *     - 标题：动作名 + "n 组" 计数
 *     - 每组数据：横排 `[类型] 重量 × 次数`（只读，类型用 Badge）
 *  4. 底部留出安全区
 *
 * 数据流：
 *  - route.params.trainingId  → getTraining + listSetsByTraining
 *  - 单位：useSettingsStore.unit 通过 formatWeight() 渲染
 *  - 删除：trainingStore.deleteHistory → goBack
 *
 * 不允许编辑：刻意不暴露任何编辑入口，避免对历史数据的回写 / 一致性问题。
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { IconButton } from '@/components/IconButton';
import { SET_TYPES, findSetType, type SetTypeValue } from '@/constants/setTypes';
import { getDatabase } from '@/db';
import {
  getTraining,
} from '@/db/repositories/trainingRepo';
import {
  listSetsByTraining,
} from '@/db/repositories/trainingSetRepo';
import type { Training, TrainingSet } from '@/db/schema';
import { isFreeTraining, resolveTrainingTitle } from '@/features/training/freeTraining';
import { toast } from '@/hooks/useToast';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useTheme } from '@/theme';
import { formatWeight } from '@/utils/units';

import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'TrainingDetail'
>;
type Route = RouteProp<RootStackParamList, 'TrainingDetail'>;

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  position: number;
  sets: TrainingSet[];
}

export function TrainingDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography } = useTheme();

  // route.params is `TrainingDetailParams | undefined` (the param is declared
  // optional in RootStackParamList). We treat missing trainingId as a render
  // error rather than crashing.
  const trainingId = route.params?.trainingId;

  const deleteHistory = useTrainingStore((s) => s.deleteHistory);
  const unit = useSettingsStore((s) => s.unit);

  const [training, setTraining] = useState<Training | null>(null);
  const [sets, setSets] = useState<TrainingSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ----------------------------------------------------------------
  // Load training + sets on mount / when trainingId changes
  // ----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    if (!trainingId) {
      setLoading(false);
      setLoadError('未提供训练 ID');
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const db = await getDatabase();
        const [t, s] = await Promise.all([
          getTraining(db, trainingId),
          listSetsByTraining(db, trainingId),
        ]);
        if (cancelled) return;
        if (!t) {
          setLoadError('训练记录不存在或已被删除');
        } else {
          setTraining(t);
          setSets(s);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setLoadError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trainingId]);

  // ----------------------------------------------------------------
  // Group sets by exercise (preserves position ASC, set_index ASC)
  // ----------------------------------------------------------------
  const groups: ExerciseGroup[] = useMemo(() => {
    const map = new Map<string, ExerciseGroup>();
    for (const s of sets) {
      const key = s.exerciseId;
      const existing = map.get(key);
      if (existing) {
        existing.sets.push(s);
      } else {
        map.set(key, {
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseNameSnapshot,
          position: s.position,
          sets: [s],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.position - b.position);
  }, [sets]);

  // ----------------------------------------------------------------
  // Header right: Delete IconButton
  // ----------------------------------------------------------------
  const onPressDelete = useCallback(() => {
    setConfirmDelete(true);
  }, []);

  const onCancelDelete = useCallback(() => {
    if (deleting) return;
    setConfirmDelete(false);
  }, [deleting]);

  const onConfirmDelete = useCallback(async () => {
    if (!trainingId) return;
    setDeleting(true);
    try {
      await deleteHistory(trainingId);
      setConfirmDelete(false);
      // G12: 非阻断反馈，告知用户删除成功。
      toast.show('已删除', 'success');
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface inline (no Alert to avoid double-modal); caller can retry.
      // eslint-disable-next-line no-console
      console.error('[G9] deleteHistory failed', err);
      setLoadError(msg);
      toast.show(`删除失败：${msg}`, 'error');
    } finally {
      setDeleting(false);
    }
  }, [deleteHistory, trainingId, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '训练详情',
      headerRight: () =>
        training ? (
          <IconButton
            icon="🗑"
            variant="ghost"
            size="sm"
            accessibilityLabel="删除训练"
            accessibilityHint="删除后无法恢复"
            onPress={onPressDelete}
            style={{ marginRight: -8 }}
          />
        ) : null,
    });
  }, [navigation, onPressDelete, training]);

  // ----------------------------------------------------------------
  // Loading / error
  // ----------------------------------------------------------------
  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, flex: 1 },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError || !training) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.background,
            flex: 1,
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
          加载失败
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center' },
          ]}
        >
          {loadError ?? '未找到该训练记录'}
        </Text>
      </View>
    );
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <Card elevated padding="lg">
          <Text style={[typography.h2, { color: colors.text }]}>
            {formatHeaderDate(training.startedAt)}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginTop: spacing.xxs },
            ]}
          >
            {formatStartTime(training.startedAt)}
          </Text>

          <View style={[styles.statRow, { marginTop: spacing.md }]}>
            <SummaryStat
              label="时长"
              value={formatDuration(training.durationSeconds)}
            />
            <SummaryStat
              label="训练量"
              value={
                training.totalVolume != null
                  ? formatWeight(training.totalVolume, unit)
                  : '—'
              }
            />
          </View>

          <View style={[styles.statRow, { marginTop: spacing.md }]}>
            <SummaryStat
              label="动作"
              value={
                training.exerciseCount != null
                  ? `${training.exerciseCount}`
                  : `${groups.length}`
              }
            />
            <SummaryStat
              label="组数"
              value={
                training.setCount != null
                  ? `${training.setCount}`
                  : `${sets.length}`
              }
            />
          </View>

          {/* G12 — G11 #3: 自由训练与计划训练的语义分叉
              自由训练（plan_id = NULL）不应显示"训练计划: 自由训练"，
              改为"训练类型: 自由训练"，文案更直观；计划训练保持原样。 */}
          <TrainingTypeRow
            training={training}
            colors={colors}
            typography={typography}
            spacing={spacing}
          />
        </Card>

        {/* Exercise groups */}
        {groups.length === 0 ? (
          <Card padding="lg">
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              本次训练没有记录任何组数据
            </Text>
          </Card>
        ) : (
          groups.map((g) => <ExerciseGroupCard key={g.exerciseId} group={g} unit={unit} />)
        )}
      </ScrollView>

      {/* Delete confirmation */}
      <Dialog
        visible={confirmDelete}
        variant="danger"
        title="删除这条训练记录？"
        message="删除后无法恢复。"
        confirmText={deleting ? '删除中…' : '删除'}
        cancelText="取消"
        onCancel={onCancelDelete}
        onConfirm={deleting ? onCancelDelete : onConfirmDelete}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

/**
 * G12 — G11 #3 fix.
 *
 * 自由训练 vs 计划训练在同一行用不同字段语义展示：
 *   - 计划训练 → "训练计划 · <planNameSnapshot>"
 *   - 自由训练 → "训练类型 · 自由训练"
 *
 * 兼容历史数据：planNameSnapshot 为 null / 空白 / "自由训练" 都视为自由训练。
 */
function TrainingTypeRow({
  training,
  colors,
  typography,
  spacing,
}: {
  training: Training;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  const free = isFreeTraining(training.planId);
  const label = free ? '训练类型' : '训练计划';
  const value = free
    ? resolveTrainingTitle(training.planNameSnapshot)
    : training.planNameSnapshot ?? '—';

  return (
    <View
      style={{
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.divider,
      }}
    >
      <Text style={[typography.caption, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <Text
        style={[
          typography.subtitle,
          { color: colors.text, marginTop: spacing.xxs },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flex: 1, gap: spacing.xxs }}>
      <Text style={[typography.caption, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <Text style={[typography.title, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ExerciseGroupCard({
  group,
  unit,
}: {
  group: ExerciseGroup;
  unit: ReturnType<typeof useSettingsStore.getState>['unit'];
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card padding="md">
      <View style={[styles.exerciseHeader, { marginBottom: spacing.sm }]}>
        <Text
          style={[typography.h3, { color: colors.text, flex: 1 }]}
          numberOfLines={1}
        >
          {group.exerciseName}
        </Text>
        <Badge
          label={`${group.sets.length} 组`}
          variant="primary"
          size="sm"
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        {group.sets.map((s) => (
          <SetRow key={s.id} set={s} unit={unit} />
        ))}
      </View>
    </Card>
  );
}

function SetRow({
  set,
  unit,
}: {
  set: TrainingSet;
  unit: ReturnType<typeof useSettingsStore.getState>['unit'];
}) {
  const { colors, spacing, typography } = useTheme();
  const isTime = set.durationSeconds != null && (set.weight == null);
  const isDistance = set.distanceKm != null && (set.weight == null);
  const main = formatSetMain(set, unit, isTime, isDistance);
  const setType = findSetType(set.setType as SetTypeValue) ?? SET_TYPES[0];

  return (
    <View style={[styles.setRow, { paddingVertical: spacing.xs }]}>
      <Text
        style={[
          typography.label,
          { color: colors.textTertiary, width: 28 },
        ]}
      >
        {set.setIndex}
      </Text>
      <View style={[styles.setTypeWrap, { marginRight: spacing.sm }]}>
        <SetTypeBadge setType={setType} />
      </View>
      <Text
        style={[
          typography.body,
          { color: colors.text, flex: 1 },
        ]}
        numberOfLines={1}
      >
        {main}
      </Text>
    </View>
  );
}

function SetTypeBadge({
  setType,
}: {
  setType: ReturnType<typeof findSetType> extends infer R
    ? R extends undefined
      ? (typeof SET_TYPES)[number]
      : NonNullable<R>
    : never;
}) {
  // 正式组保持轻量外观；W/D/F 用语义色。
  if (setType.value === 'normal') {
    return <Badge label="正式" variant="default" size="sm" />;
  }
  switch (setType.value) {
    case 'warmup':
      return <Badge label="热身" variant="warning" size="sm" />;
    case 'dropout':
      return <Badge label="递减" variant="info" size="sm" />;
    case 'failure':
      return <Badge label="力竭" variant="danger" size="sm" />;
    default:
      return <Badge label={setType.label} variant="default" size="sm" />;
  }
}

/* -------------------------------------------------------------------------- */
/* Formatters                                                                  */
/* -------------------------------------------------------------------------- */

function formatSetMain(
  set: TrainingSet,
  unit: ReturnType<typeof useSettingsStore.getState>['unit'],
  isTime: boolean,
  isDistance: boolean,
): string {
  if (isTime) {
    return formatDuration(set.durationSeconds ?? 0);
  }
  if (isDistance) {
    return `${(set.distanceKm ?? 0).toFixed(2)} km`;
  }
  // 默认 reps/kg 显示：`重量 × 次数`，任意字段为空就省略
  const w = set.weight;
  const r = set.reps;
  if (w != null && r != null) {
    return `${formatWeight(w, unit)} × ${r}`;
  }
  if (w != null) return formatWeight(w, unit);
  if (r != null) return `${r} 次`;
  return '—';
}

function formatHeaderDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatStartTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  return `${hh}:${mm} · ${weekday}`;
}

function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                       */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setTypeWrap: {
    minWidth: 56,
    alignItems: 'flex-start',
  },
});
