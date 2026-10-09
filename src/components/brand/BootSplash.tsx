/**
 * 启动屏 —— 冷启动时盖在第一帧上面的品牌画面。
 *
 * ## 它和原生启动页的关系（这是整个组件最重要的一件事）
 *
 * Android 上先显示的是**原生启动页**（由 app.json 的 expo-splash-screen 生成：
 * 橙底 + 居中白标记）。expo-splash-screen 的 SplashScreenManager 会用
 * OnPreDrawListener 一直挡住 RN 内容，直到 React 的 CONTENT_APPEARED 标记触发
 * 才把原生启动页撤掉。也就是说：**原生启动页会一直盖着，直到本组件的首帧真的
 * 存在**。所以两边只要画出同一个东西，交接就是无缝的、连一帧白闪都没有。
 *
 * 由此推出两条硬约束，改本文件时别破坏：
 *   1. 首帧（t=0）必须与原生启动页**逐像素一致**：同一块底色、同一个宽度的
 *      白标记、同一个位置（都居中）。所以这里首帧不画字标、不画进度条，
 *      标记也没有任何入场动画 —— 那些都是 t=0 之后才发生的。
 *   2. 标记必须**单独居中**，字标/进度条挂在它下方的绝对定位层里。
 *      如果把"标记+字标+进度"当一个整体居中，标记会被顶上去，交接瞬间跳一下。
 *
 * 底色/标记宽度与 app.json 的对应关系由 `__tests__/markGeometry.test.ts` 钉住：
 * 改了 app.json 忘了改这里（或反过来）会红。
 *
 * ## 为什么用固定品牌色而不是 theme token
 *
 * 原生启动页没有深色变体（expo-splash-screen 的 `dark` 配置本项目没设），
 * 浅深色下都是 #FF6B35。所以本组件的底色也必须是固定的 #FF6B35 ——
 * 用 theme 的 `colors.primary` 会在深色模式拿到 #FF7A4D，交接瞬间底色跳变。
 * 这是"启动屏是一块固定品牌表面、不是主题化表面"的直接后果。
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { spacing, typography } from '@/theme';
import { BarbellMark } from './BarbellMark';
import { MARK_ASPECT } from './markGeometry';

/**
 * 启动屏底色。**必须**等于 app.json 里 expo-splash-screen 的
 * `backgroundColor`，否则原生→JS 交接时底色会跳。
 */
export const SPLASH_FIELD = '#FF6B35';

/**
 * 标记实心区域宽度（dp）。**必须**等于 app.json 里 expo-splash-screen 的
 * `imageWidth`：原生侧生成 PNG 时把标记缩放成 imageWidth dp 宽，JS 侧要画
 * 一样的宽度，否则交接时标记会跳大小。
 */
export const SPLASH_MARK_WIDTH = 150;

/** 启动屏上的前景色（标记 / 字标 / 进度填充）。 */
export const SPLASH_ON_FIELD = '#FFFFFF';

/**
 * 进度条槽的底色。故意用**变暗**而不是变亮：
 * 白填充 vs 变暗槽 ≈ 4.4:1（可辨识），白填充 vs 变亮的槽只有 ~2:1（糊成一片）。
 */
const SPLASH_TRACK = 'rgba(0, 0, 0, 0.22)';

/**
 * 进度条固定宽度（dp）。固定值免去 onLayout 测量带来的首帧延迟。
 * 取 120 是为了和上方字标的宽度**大致相等**（22sp×5字 + 4sp字距 ≈ 126dp）——
 * 条比字宽会像一条独立的横杠，而不是字标的下划线；实测 132 就是这样，显得散。
 */
const TRACK_WIDTH = 120;
const TRACK_HEIGHT = 3;

/** 外侧配重片"装片"时向外撑开的幅度，单位是 SVG 单位（见 BarbellMark）。 */
const PLATE_RACK_OUT = 5;

const T = {
  /** 先静一小会儿再动 —— 保证交接已经落定，首帧严格等于原生那一帧。 */
  plateDelay: 90,
  plateOut: 130,
  wordmarkDelay: 150,
  wordmarkIn: 260,
  barDelay: 330,
  barIn: 200,
  exit: 220,
} as const;

/** 标记的半高（dp）—— 字标层的起始位置要让它落到标记下沿之外。 */
const MARK_HALF_HEIGHT = (SPLASH_MARK_WIDTH * MARK_ASPECT) / 2;

export type BootSplashProps = {
  /** 真实启动进度，0..1。来自 App 里 bootstrap 的步骤计数，不是假进度。 */
  progress: number;
  /** false 时淡出，结束后回调 onHidden（由调用方据此卸载）。 */
  visible: boolean;
  onHidden?: () => void;
  /** 无障碍朗读用：当前正在执行的启动步骤。 */
  statusLabel?: string;
};

export function BootSplash({ progress, visible, onHidden, statusLabel }: BootSplashProps) {
  const reduceMotion = useReducedMotion();

  const plateOffset = useSharedValue(0);
  const reveal = useSharedValue(0); // 字标与进度条共用的"浮现"进度 0..1
  const shown = useSharedValue(1); // 整屏不透明度
  const fill = useSharedValue(progress);

  // 入场编排。依赖只放 reduceMotion：这几条在组件生命周期内只跑一次。
  useEffect(() => {
    if (reduceMotion) {
      // 减少动态：不做任何位移，只保留透明度渐显；配重片完全不动。
      reveal.value = withDelay(T.wordmarkDelay, withTiming(1, { duration: T.wordmarkIn }));
      return;
    }
    // "装片"：先向外撑开，再弹回归位。首帧 offset=0 = 原生那一帧。
    plateOffset.value = withDelay(
      T.plateDelay,
      withSequence(
        withTiming(PLATE_RACK_OUT, {
          duration: T.plateOut,
          easing: Easing.out(Easing.quad),
        }),
        withSpring(0, { damping: 12, stiffness: 180, mass: 0.9 }),
      ),
    );
    reveal.value = withDelay(
      T.wordmarkDelay,
      withTiming(1, { duration: T.wordmarkIn, easing: Easing.out(Easing.cubic) }),
    );
  }, [plateOffset, reduceMotion, reveal]);

  // 进度变化 → 平滑追上去（不平滑的话每完成一步都会"蹦"一下）。
  useEffect(() => {
    fill.value = withTiming(progress, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [fill, progress]);

  // onHidden 走 ref：调用方通常传内联箭头函数，每次渲染都是新引用。
  // 直接放进依赖数组的话，淡出期间任何一个重渲染都会重启淡出动画
  // （表现为启动屏闪一下、迟迟不消失）。
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;
  /** 稳定引用：给 worklet 里的 runOnJS 用，避免捕获到过期的 onHidden。 */
  const notifyHidden = useCallback(() => {
    onHiddenRef.current?.();
  }, []);

  // 退出：淡出后通知调用方卸载。
  useEffect(() => {
    if (visible) return;
    shown.value = withTiming(
      0,
      { duration: reduceMotion ? 0 : T.exit, easing: Easing.in(Easing.quad) },
      (finished) => {
        // 回调在 UI 线程执行，碰 JS 必须 runOnJS。
        if (finished) runOnJS(notifyHidden)();
      },
    );
  }, [reduceMotion, shown, visible]);

  const fieldStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const wordmarkStyle = useAnimatedStyle(() => {
    // reveal 同时驱动字标和进度条；进度条用后半段，形成轻微错峰。
    const p = reveal.value;
    return {
      opacity: p,
      transform: [{ translateY: reduceMotion ? 0 : (1 - p) * 8 }],
    };
  });
  const barStyle = useAnimatedStyle(() => {
    const p = Math.max(0, (reveal.value - 0.45) / 0.55);
    return { opacity: p };
  });
  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * TRACK_WIDTH }));

  const label = statusLabel ? `正在启动：${statusLabel}` : '正在启动';

  return (
    <Animated.View
      style={[styles.field, fieldStyle]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      {/* 标记层：严格居中。这是"与原生启动页无缝交接"的全部要求。 */}
      <BarbellMark
        width={SPLASH_MARK_WIDTH}
        color={SPLASH_ON_FIELD}
        outerPlateOffset={plateOffset}
      />

      {/* 字标 + 进度：绝对定位挂在中线下方，**不参与**上面的居中计算。 */}
      <View style={[styles.below, { marginTop: MARK_HALF_HEIGHT + spacing.xxl }]}>
        <Animated.View style={wordmarkStyle}>
          <Text style={styles.wordmark} allowFontScaling={false}>
            锻炼2点零
          </Text>
        </Animated.View>

        <Animated.View style={[styles.trackWrap, barStyle]}>
          <View style={styles.track} />
          <Animated.View style={[styles.fill, fillStyle]} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_FIELD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  below: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    alignItems: 'center',
  },
  wordmark: {
    ...typography.h2,
    fontSize: 22,
    fontWeight: '800',
    // 中文字距拉开一点：它在这里是**字标**不是正文，拉开读起来更像品牌。
    letterSpacing: 4,
    // 白字压品牌橙只有 2.85:1 —— 低于 4.5:1。这里保持白色是刻意的：
    // 它是**字标**（WCAG 对 logotype 有对比度豁免），而且换成深色会和
    // 上方的白标记割裂。改动前请先想清楚要动的是哪一边。
    color: SPLASH_ON_FIELD,
  },
  trackWrap: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    marginTop: spacing.xl,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  track: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_TRACK,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: SPLASH_ON_FIELD,
  },
});
