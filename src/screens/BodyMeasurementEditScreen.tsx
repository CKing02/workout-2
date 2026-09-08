/**
 * US-12 — 身体测量录入 / 编辑屏。
 *
 * 复用同一屏：
 *  - params 缺 `measurementId` → 新建模式
 *  - params 带 `measurementId` → 编辑模式（从 store 取记录）
 *
 * 字段：
 *  - 体重 (kg)：可空；NumberInput 直接显示当前单位（kg/lb），
 *               提交时 lb 走 lbToKg 反向换算回 kg 存储
 *  - 体脂 (%)：可空；精度 1 位小数；与单位无关
 *  - 备注 (text)：可空
 *
 * 校验：
 *  - 体重和体脂至少一个必填（可以只记一项）
 *  - 数值范围：体重 20–250 kg（lb 等效 44–551），体脂 3–60 %
 *
 * 日期：本期不做 picker，默认今天。备注里可写"早/晚"区分。
 * 后续迭代：加日期 picker / 多日补录（独立 G）。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { NumberInput } from '@/components/NumberInput';
import { toast } from '@/hooks/useToast';
import type { RootStackParamList } from '@/navigation/types';
import { useBodyMeasurementStore } from '@/store/bodyMeasurementStore';
import { useSettingsStore, type Unit } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { haptic } from '@/utils/haptics';
import {
  kgToLb,
  lbToKg,
} from '@/utils/units';

type Nav = NativeStackNavigationProp<RootStackParamList, 'BodyMeasurementEdit'>;
type Route = RouteProp<RootStackParamList, 'BodyMeasurementEdit'>;

const WEIGHT_KG_MIN = 20;
const WEIGHT_KG_MAX = 250;
const FAT_MIN = 3;
const FAT_MAX = 60;

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** NumberInput 内部用 NaN-ish 表达"空"：用最小值边界 + display 空 placeholder。
 *  我们用 `0` 作为 prefill sentinel，但用户可能输入 0.0 表示"真·0kg"——所以
 *  实际空判断走本地 string 状态。简化：每个字段用 `value` 表示"已存的
 *  数值"，`useState<number>(NaN)` 表示"未填"。NumberInput 不接受 NaN，
 *  这里改用一个 min sentinel：weight 0 = "未填"，存盘时把 0 转 null。 */
const UNSET_SENTINEL = 0;

function displayLocalDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function BodyMeasurementEditScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const measurementId = route.params?.measurementId;

  const unit = useSettingsStore((s) => s.unit);
  const measurements = useBodyMeasurementStore((s) => s.measurements);
  const create = useBodyMeasurementStore((s) => s.create);
  const update = useBodyMeasurementStore((s) => s.update);

  // 编辑模式才需要查找初始值；新建模式默认空
  const initial = useMemo(
    () => (measurementId ? measurements.find((m) => m.id === measurementId) ?? null : null),
    [measurementId, measurements],
  );

  // form 状态：体重 / 体脂 用 NumberInput 的 value（数字），0 表示 sentinel "未填"
  const [weight, setWeight] = useState<number>(UNSET_SENTINEL);
  const [fat, setFat] = useState<number>(UNSET_SENTINEL);
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 进入编辑模式时初始化表单（仅一次）
  useEffect(() => {
    if (!initial) {
      setWeight(UNSET_SENTINEL);
      setFat(UNSET_SENTINEL);
      setNote('');
      return;
    }
    // 把存储的 kg 转成当前单位的"显示值"。NumberInput 只能接数字，
    // 空值用 sentinel 0。
    if (initial.weightKg == null) {
      setWeight(UNSET_SENTINEL);
    } else {
      setWeight(unit === 'kg' ? initial.weightKg : kgToLb(initial.weightKg));
    }
    setFat(initial.bodyFatPct ?? UNSET_SENTINEL);
    setNote(initial.note ?? '');
    // 故意只在 initial / unit 变化时跑一次（创建模式下 initial 始终 null，跑空）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  /** 校验：体重 / 体脂至少一项必填。 */
  const validate = useCallback((): string | null => {
    const w = weight > UNSET_SENTINEL ? weight : 0;
    const f = fat > UNSET_SENTINEL ? fat : 0;
    if (w === 0 && f === 0) {
      return '请至少填写一项（体重或体脂）';
    }
    if (w > 0) {
      const kg = unit === 'kg' ? w : lbToKg(w);
      if (kg < WEIGHT_KG_MIN || kg > WEIGHT_KG_MAX) {
        return `体重超出范围（${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX} kg）`;
      }
    }
    if (f > 0 && (f < FAT_MIN || f > FAT_MAX)) {
      return `体脂超出范围（${FAT_MIN}–${FAT_MAX} %）`;
    }
    return null;
  }, [weight, fat, unit]);

  const handleSave = useCallback(async () => {
    const err = validate();
    if (err) {
      haptic.error();
      setError(err);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // 把当前单位的输入值换算成 kg 存储
      const weightKg =
        weight > UNSET_SENTINEL
          ? unit === 'kg'
            ? weight
            : lbToKg(weight)
          : null;
      const bodyFatPct = fat > UNSET_SENTINEL ? fat : null;
      const trimmedNote = note.trim() || null;

      if (initial) {
        await update(initial.id, {
          weightKg,
          bodyFatPct,
          note: trimmedNote,
        });
        haptic.success();
        toast.show('已更新', 'success');
      } else {
        await create({
          measuredDate: todayIso(),
          weightKg,
          bodyFatPct,
          note: trimmedNote,
        });
        haptic.success();
        toast.show('已保存', 'success');
      }
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      haptic.error();
      toast.show(`保存失败：${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [validate, weight, fat, unit, note, initial, create, update, navigation]);

  // 体重 NumberInput 的 min / max 跟单位联动（lb 范围 = kg 范围 × 2.2046）
  const weightMin = unit === 'kg' ? WEIGHT_KG_MIN : WEIGHT_KG_MIN * 2.2046;
  const weightMax = unit === 'kg' ? WEIGHT_KG_MAX : WEIGHT_KG_MAX * 2.2046;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 日期（本期只读，默认今天） */}
          <Card padding="md">
            <Text
              style={[
                typography.label,
                { color: colors.textTertiary, marginBottom: spacing.xs },
              ]}
            >
              日期
            </Text>
            <Text style={[typography.h3, { color: colors.text }]}>
              {displayLocalDate(todayIso())}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textTertiary, marginTop: spacing.xs },
              ]}
            >
              自定义日期将在后续迭代支持
            </Text>
          </Card>

          {/* 体重 / 体脂 */}
          <Card padding="md" style={{ gap: spacing.md }}>
            <NumberInput
              testID="weight-input"
              label="体重"
              unitLabel={unit}
              value={weight}
              onChangeValue={setWeight}
              min={weightMin}
              max={weightMax}
              precision={1}
              placeholder="选填"
            />
            <NumberInput
              testID="fat-input"
              label="体脂"
              unitLabel="%"
              value={fat}
              onChangeValue={setFat}
              min={FAT_MIN}
              max={FAT_MAX}
              precision={1}
              placeholder="选填"
            />
          </Card>

          {/* 备注 */}
          <Card padding="md">
            <Input
              testID="note-input"
              label="备注"
              value={note}
              onChangeText={setNote}
              placeholder="例如：早起空腹 / 运动后"
              maxLength={100}
            />
          </Card>

          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[typography.caption, { color: colors.danger, textAlign: 'center' }]}
            >
              {error}
            </Text>
          ) : null}

          <Button
            variant="primary"
            onPress={handleSave}
            disabled={saving}
            style={{ marginTop: spacing.sm }}
          >
            {saving ? '保存中…' : initial ? '更新' : '保存'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
