/**
 * Avatar — 圆形头像，有图显示图、没图显示首字符。
 *
 * 纯展示组件，不连任何 store（符合 `@/components` barrel 声明的
 * 「design system 单一入口」契约）。头像数据由调用方从 `useAvatarStore` 取。
 *
 * ## 为什么不用 ExerciseGifImage / ExerciseThumbnail
 *
 * 那两个走 `classifyGifSource()`（`src/screens/exerciseGifAssets.ts:106-113`）
 * 做三态解析，而该函数会把裸 `file://` 判成 `'none'`；给头像扩展第 4 态意味着
 * 改动三个模块 + 一个穷举断言测试，只为了一个毫不相干的消费者。头像直接
 * 用 `expo-image` 渲染本地 URI，两边互不牵连。
 *
 * ## 渲染结构
 *
 * 首字符**始终**画在底层，图片用绝对定位盖上去：
 *  - 本地文件毫秒级就绪 → 不需要 Skeleton，也就没有「骨架闪烁」
 *  - 图片加载失败（文件被删 / 路径失效）时把 `failed` 置 true 撤掉图片，
 *    底下那层首字符自然露出来，不会留一个空白洞
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/theme';

export interface AvatarProps {
  /** 头像文件 URI；null / undefined 时显示首字符。 */
  uri?: string | null;
  /** 无头像时的兜底文字，取首字符。空串 → '·'。 */
  text?: string;
  /** 直径，默认 56（与 G10「我的」页原尺寸一致）。 */
  size?: number;
  /** 传了才可点 —— 组件内部包一层 Pressable 并带上无障碍语义。 */
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function Avatar({
  uri,
  text,
  size = 56,
  onPress,
  accessibilityLabel,
  testID,
}: AvatarProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  // 换了图（或从有图变没图）就把失败标记清掉，否则换新头像后会一直
  // 停在首字符上。
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const initial = (text ?? '').trim().charAt(0).toUpperCase() || '·';
  const showImage = !!uri && !failed;

  const frame = (
    <View
      testID={testID}
      // 帧本身是装饰性的：可交互时语义由外层 Pressable 承担；
      // 不可交互时也就没必要让读屏念出一个孤零零的首字母
      // （原来的 ProfileScreen 私有 Avatar 没设这个，会漏一个 "A" 出来）。
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryMuted,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: Math.round(size * 0.43),
          fontWeight: '700',
        }}
      >
        {initial}
      </Text>
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : null}
    </View>
  );

  if (!onPress) return frame;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? '更换头像'}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {frame}
    </Pressable>
  );
}
