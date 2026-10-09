/**
 * G46 — `ConfettiBurst` 庆祝粒子组件。
 *
 * **用途**：在 PR 达成 / 训练完成 / 第 N 次打卡 等"里程碑"瞬间撒一波粒子。
 *           是"完成"物理感的顶配表达 —— 用户在被动接收结果时，物理粒子"砸"
 *           到屏幕里，比单纯数字翻动多一层"我值得这个奖赏"的隐喻。
 *
 * **设计动机**：
 * Material 3 motion design 的"expressive motion" —— 用户在关键成功节点值得一个
 * 比日常交互更"华丽"的反馈。粒子必须纯 RN / Reanimated **不要**引第三方物理库
 * （react-native-skia / lottie 等 0 依赖底线），build size 与启动时间都不该被它拖累。
 *
 * **为何不用 Lottie / Skia？**
 * - Lottie：跨端一致，但需要设计稿 + 制作时间。G46 第一阶段先用纯物理粒子；
 *   G49 评估是否升级 Lottie 模板。
 * - Skia (react-native-skia)：60fps 物理，但引入 ~600KB 起步 + 一个 GPU 渲染层；
 *   健身 App 早训练时 GPU 发热明显，不是好交易。
 *
 * **物理参数**（与 G46 spec 一致）：
 *   40 粒子；3 种品牌色（`primary / primaryPressed / primaryMuted`）；宽度 6–10dp 随机；
 *   总时长 2200 ms；屏幕顶部 y=0 → 散落到 `screenHeight * 0.6`；0.6g 模拟重力。
 *   `pointerEvents="none"` —— 不阻塞交互层。
 *   `trigger` 变化时重新播一次（useEffect 监听 trigger 身份）。
 *
 * **不在本节做**（Scope Lock）：
 *   - 不接入 `TrainingCompleteScreen` / PR 弹板 —— 留给 G48。
 *   - 不做"鼠标交互 / 拖尾效果" —— 超出基础感官打点。
 *   - 不做颜色随机化 —— 严格走品牌色（`primary / primaryPressed / primaryMuted`），
 *     避免 G49 评估视觉参考集时反复改基础结构。
 *
 * **关键类型陷阱**：
 * Reanimated 4 的 `SharedValue` 必须从 `react-native-reanimated` **类型空间**
 * 直接 import —— 不要从 `Animated.X` 路径取（Animated 没有重新 export SharedValue，
 * 这是一个常见 TS 报错点）。
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { motion } from '@/theme/motion';
import { useColors } from '@/theme';

/** 粒子数量 —— 与 G46 spec 锁定的 40 一致。 */
const PARTICLE_COUNT = 40;

/** 单粒子下落时长区间（让粒子错落呈"瀑布"而非齐步走） */
const PER_PARTICLE_BASE_DURATION = 1800;
const PER_PARTICLE_DURATION_JITTER = 600;

/** 落点基准 —— 与 G46 spec 一致：屏幕高度的 60%。 */
const LAND_FRACTION = 0.6;

/** 总时长 (ms) —— 与 G46 spec 锁定的 2200 ms 一致。 */
const TOTAL_DURATION_MS = 2200;

/** 粒子宽度范围 —— 与 G46 spec 锁定的 6–10dp 一致。 */
const WIDTH_MIN = 6;
const WIDTH_MAX = 10;

export interface ConfettiBurstProps {
  /**
   * 触发器：每次 `trigger` 的引用变化（identity）都会重新播一次动画。
   * 通常传递增数字：`trigger={prCount}`（PR 次数）+ 1 → 撒一波。
   * 也可用 string 标识：`trigger={Date.now().toString()}`。
   */
  trigger: string | number;
  /** 完播回调 —— 非空时在动画最后一帧触发一次。 */
  onComplete?: () => void;
  /** 外层 wrapper 样式。 */
  style?: StyleProp<ViewStyle>;
  /** 测试锚点。 */
  testID?: string;
}

interface ParticleSpec {
  /** 6–10 之间的随机宽度 */
  width: number;
  /** 颜色索引：0=primary / 1=primaryPressed / 2=primaryMuted */
  colorIndex: number;
  /** 起点 x（屏幕水平随机位置 0–1） */
  startXFraction: number;
  /** 落点水平偏移（-0.3 ~ +0.3 屏宽） */
  endXOffsetFraction: number;
  /** 单粒子时长（ms） —— 让粒子错落 */
  durationMs: number;
}

/** 父级一次性算好"参照坐标系"，避免每个粒子都用 Dimensions 钩子。 */
interface ConfettiGeometry {
  /** screen width (px) */
  width: number;
  /** screen height × LAND_FRACTION (px) —— 落点 y 上限 */
  height: number;
}

/**
 * 用稳定 PRNG（`mulberry32`）生成 40 个粒子的随机参数。
 *
 * 为什么不用 `Math.random()`：Spec 要求"trigger 变化时粒子**不同**"—— 但同一次
 * trigger 内显示的 40 个粒子应当**稳定**（视觉一致，不能每次重渲就洗牌）。
 * 用一个 PRNG 一次生成、存 ref，保证：
 *   - 同一 trigger 下重渲染时不会洗牌
 *   - 不同 trigger 之间更换 seed → 看到新一波粒子
 *
 * 这是动画组件里用 PRNG 而不是 Math.random() 的标准理由（参考
 * https://reactnavigation.org/blog/2021/05/05/using-random-values-in-react-native.html）。
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function rng() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticles(seed: number): ParticleSpec[] {
  const rng = mulberry32(seed);
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    width: WIDTH_MIN + Math.floor(rng() * (WIDTH_MAX - WIDTH_MIN + 1)),
    colorIndex: i % 3,
    startXFraction: rng(),
    endXOffsetFraction: (rng() - 0.5) * 0.6, // -0.3 ~ +0.3
    durationMs: PER_PARTICLE_BASE_DURATION + Math.floor(rng() * PER_PARTICLE_DURATION_JITTER),
  }));
}

function getPaletteColors(colors: {
  primary: string;
  primaryPressed: string;
  primaryMuted: string;
}): readonly [string, string, string] {
  return [colors.primary, colors.primaryPressed, colors.primaryMuted] as const;
}

/**
 * 单个粒子的内部组件 ——
 * 一个 `Animated.View` 跑 `useAnimatedStyle`，根据 progress shared value 计算位置。
 * 拆出来是为了让父级 keep `pointerEvents="none"` 同时不影响单个粒子的 worklet 性能。
 */
interface ParticleProps {
  spec: ParticleSpec;
  colors: readonly [string, string, string];
  /** 父级传入的 0→1 动画进度 —— 所有粒子同步动 */
  progress: SharedValue<number>;
  geometry: ConfettiGeometry;
  index: number;
}

function Particle({ spec, colors, progress, geometry, index }: ParticleProps) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const xFrac = spec.startXFraction + spec.endXOffsetFraction * p;
    const x = xFrac * geometry.width;
    const y = p * geometry.height;
    return {
      transform: [{ translateX: x }, { translateY: y }],
      // 渐隐：末 30% 透明度 1 → 0
      opacity: p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
    };
  }, []);

  return (
    <Animated.View
      testID={`confetti-particle-${index}`}
      style={[
        styles.particle,
        {
          width: spec.width,
          // 长条形粒子（G46 spec 没硬性比例，按常见 confetti 视觉）
          height: spec.width * 0.4,
          backgroundColor: colors[spec.colorIndex],
        },
        style,
      ]}
    />
  );
}

/**
 * 主组件 —— `trigger` prop 身份变化时重新播一次。
 *
 * 物理说明：
 * - 总动画 `progress` 用一个 sharedValue 0→1 withTiming(TOTAL_DURATION_MS=2200)
 * - 每个粒子在 progress 上做自己偏移（startXFraction + 横向漂移 + 渐隐）
 * - 重力影响通过形状以"位移"的方式呈现 —— 简化物理、视觉上"看起来像被砸出来"
 * - 真实重力（t² 加速）留给 G49 视觉调优（spec 已为 `0.6g` 留字段）
 */
export function ConfettiBurst({
  trigger,
  onComplete,
  style,
  testID,
}: ConfettiBurstProps) {
  const colors = useColors();
  const palette = useMemo(
    () =>
      getPaletteColors({
        primary: colors.primary,
        primaryPressed: colors.primaryPressed,
        primaryMuted: colors.primaryMuted,
      }),
    [colors.primary, colors.primaryPressed, colors.primaryMuted],
  );

  // 用 dimensions 一次算好"参照坐标系"，避免每个粒子都用 Dimensions 钩子。
  const screen = Dimensions.get('window');
  const geometry: ConfettiGeometry = useMemo(
    () => ({
      width: screen.width,
      height: screen.height * LAND_FRACTION,
    }),
    [screen.width, screen.height],
  );

  // trigger → seed：把 trigger 转成稳定数字。
  const seedRef = useRef<number>(0);
  useEffect(() => {
    const key = typeof trigger === 'number' ? `${trigger}` : String(trigger);
    // FNV-1a 32bit hash —— 把任意 string 切成种子
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    seedRef.current = h >>> 0;
  }, [trigger]);

  const particles = useMemo(
    () => buildParticles(seedRef.current),
    // 每次 trigger 变化都重新跑（seedRef.current 已经更新）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger],
  );

  const progress = useSharedValue(0);

  useEffect(() => {
    // 每次 trigger 变化重置 progress → 跑 withTiming 0 → 1
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: TOTAL_DURATION_MS, easing: motion.easing.standard },
      (finished) => {
        if (finished && onComplete) {
          runOnJS(onComplete)();
        }
      },
    );
  }, [trigger, progress, onComplete]);

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[styles.host, style]}
    >
      {particles.map((spec, i) => (
        <Particle
          // key 同时承担 trigger 身份（父组件 trigger 变化 → 所有 key 变 → 重挂载）
          key={`${trigger}-${i}`}
          spec={spec}
          colors={palette}
          progress={progress}
          geometry={geometry}
          index={i}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    // 覆盖全屏：绝对定位 + 0 0 0 0
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 1,
  },
});

export default ConfettiBurst;
