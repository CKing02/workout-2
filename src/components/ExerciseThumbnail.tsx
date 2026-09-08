/**
 * G36 — 动作头像缩略图
 *
 * 用法:代替之前所有"圆 View + 首字符"的占位。
 *
 * 渲染策略:
 *  - 有 gifUrl 且 resolveGifSource 命中 → 显示 GIF 静态首帧
 *    (RN Image 无"播一次停"API,源 GIF 在 32-40px + cover 模式下视觉上
 *     看不出循环 — demo 验收结论。G36 用户接受"看起来像静态")
 *  - gifUrl 为 null(自定义动作)→ fallback 首字符,与旧风格一致
 *
 * Props:
 *  - size: 渲染像素(默认 40)。外层容器 width=height=size
 *  - name: 动作名(fallback 用)
 *  - rounded: 'circle'(默认,做头像)| 'square'(8px 圆角,列表行可考虑)
 *  - resizeMode: 默认 'cover'。需要看完整图(罕见)传 'contain'
 *
 * 已知限制:
 *  - GIF 仍在循环播。如果未来用户报"动画太花眼",考虑
 *    react-native-fast-image 的 priority 或 Lottie 替代。
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { resolveGifSource } from '@/screens/exerciseGifAssets';
import { useTheme } from '@/theme';

export type ExerciseThumbnailProps = {
  gifUrl?: string | null;
  name: string;
  size?: number;
  rounded?: 'circle' | 'square';
  resizeMode?: 'cover' | 'contain';
};

export function ExerciseThumbnail({
  gifUrl,
  name,
  size = 40,
  rounded = 'circle',
  resizeMode = 'cover',
}: ExerciseThumbnailProps) {
  const { colors, radius } = useTheme();
  const borderRadius = rounded === 'circle' ? size / 2 : radius.md;

  const source = resolveGifSource(gifUrl);

  if (source) {
    return (
      <View
        style={[
          styles.frame,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: colors.surfaceMuted,
            overflow: 'hidden',
          },
        ]}
        accessible
        accessibilityLabel={`${name} 动作演示缩略图`}
      >
        <Image
          source={source}
          style={{ width: size, height: size }}
          resizeMode={resizeMode}
        />
      </View>
    );
  }

  // Fallback — user-created 动作 (gifUrl=null)
  const initial = name.trim().charAt(0) || '·';
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
      accessible
      accessibilityLabel={`${name} 缩略图(无演示)`}
    >
      <Text style={{ color: colors.primaryPressed, fontSize: Math.round(size * 0.4), fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
