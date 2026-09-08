/**
 * G35 §4 — 动作详情屏(正式版)
 *
 * 入口:
  - 我的 → 「动作详情」(顶替 G34 Pilot 入口,见 ProfileScreen)
  - 动作库(browse mode)→ 点任意一行
 *
 * 数据策略:
  - route.params.exerciseId → useExerciseStore.getById 查完整 Exercise
  - gifUrl 字段 → resolveGifSource() 拿 RN ImageSourcePropType
  - stepsZh 字段(JSON 数组解出)→ 列表渲染
  - attribution 字段 → 版权声明(固定 '© Gym visual — https://gymvisual.com/')
  - user-created 动作这 5 字段全 null,UI 走 fallback 路径
 *
 * Layout(沿用 G34 定版,锁死):
  - 头部(动作名 + 2 Badge:主肌群 + 器械)
  - GIF 演示(240×240,居中循环)
  - attribution 小字
  - 分步演示(中文步骤)
 *
 * 明确不做:
  - 2D 前后肌肉图(数据源语义混乱)
  - 动作要领描述段(和分步重复)
  - 次要肌群 Badge
  - 底部 CTA(看完回动作库)
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import type { Exercise } from '@/db/schema';
import { resolveGifSource } from '@/screens/exerciseGifAssets';
import { useExerciseStore } from '@/store/exerciseStore';
import { useTheme } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type DetailRoute = RouteProp<RootStackParamList, 'ExerciseDetail'>;

// G35: hasaneyldrm 源 GIF 是 180×180,贴合原尺寸渲染(不拉伸 = 不糊)。
// §3 handoff 已确认 GIF 视觉质量低,用户接受当前路线 — 不重做,只对齐尺寸。
const GIF_SIZE = 180;

export function ExerciseDetailScreen() {
  const route = useRoute<DetailRoute>();
  const exerciseId = route.params?.exerciseId;
  const { colors, spacing, typography } = useTheme();

  const [exercise, setExercise] = useState<Exercise | null | undefined>(undefined);
  const getById = useExerciseStore((s) => s.getById);

  useEffect(() => {
    if (!exerciseId) {
      setExercise(null);
      return;
    }
    let cancelled = false;
    void getById(exerciseId).then((e) => {
      if (!cancelled) setExercise(e);
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId, getById]);

  // ----- loading -----
  if (exercise === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ----- not found -----
  if (exercise === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: spacing.lg }]}>
        <EmptyState
          icon="🤷"
          title="没找到这个动作"
          description="可能已被删除,回动作库刷新一下试试。"
          actionLabel="回上一页"
          onAction={() => {
            // react-navigation 自动有 header back;这里只提示
          }}
        />
      </View>
    );
  }

  const gifSource = resolveGifSource(exercise.gifUrl);
  const steps = exercise.stepsZh ?? [];
  const attribution = exercise.attribution ?? '© Gym visual — https://gymvisual.com/';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: spacing.xxxxl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ===== 1. 头部 ===== */}
      <View style={{ marginBottom: spacing.md }}>
        <Text
          style={[typography.h2, { color: colors.text }]}
        >
          {exercise.name}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            marginTop: spacing.xs,
          }}
        >
          <Badge label={exercise.muscleGroup} variant="info" size="sm" />
          <Badge label={exercise.equipment} variant="default" size="sm" />
        </View>
      </View>

      {/* ===== 2. GIF 演示 ===== */}
      {gifSource ? (
        <Card padding="md" elevated>
          <View style={styles.gifFrame}>
            <Image
              source={gifSource}
              style={styles.gif}
              resizeMode="contain"
              accessible
              accessibilityLabel={`${exercise.name} 动作演示`}
            />
          </View>
          <Text
            style={[
              typography.caption,
              {
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: spacing.xs,
              },
            ]}
          >
            动作演示 · 180×180 循环播放
          </Text>
        </Card>
      ) : (
        <Card padding="md" elevated>
          <View style={styles.gifFrame}>
            <Text style={[typography.body, { color: colors.textTertiary }]}>
              🏋
            </Text>
          </View>
          <Text
            style={[
              typography.caption,
              {
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: spacing.xs,
              },
            ]}
          >
            自定义动作暂无演示
          </Text>
        </Card>
      )}

      {/* ===== 3. Attribution ===== */}
      <Text
        style={[
          typography.caption,
          {
            color: colors.textTertiary,
            textAlign: 'center',
            marginTop: spacing.xs,
          },
        ]}
        accessibilityLabel={`媒体来源：${attribution}`}
      >
        {attribution}
      </Text>

      {/* ===== 4. 步骤列表 ===== */}
      {steps.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <Text
            style={[
              typography.subtitle,
              { color: colors.text, marginBottom: spacing.xs },
            ]}
          >
            分步演示
          </Text>
          <Card padding="md">
            <View style={{ gap: spacing.sm }}>
              {steps.map((step, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing.sm,
                  }}
                >
                  <View
                    style={[
                      styles.stepNumber,
                      {
                        backgroundColor: colors.primaryMuted,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.primaryPressed, fontWeight: '700' },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  <Text
                    style={[
                      typography.body,
                      {
                        color: colors.text,
                        flex: 1,
                        lineHeight: 22,
                      },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gif: {
    width: GIF_SIZE,
    height: GIF_SIZE,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});