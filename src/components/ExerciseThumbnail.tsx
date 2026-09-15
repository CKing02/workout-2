/**
 * G36 + G39 — 动作头像缩略图
 *
 * 用法:代替之前所有"圆 View + 首字符"的占位。
 *
 * 渲染策略(G39 升级):
 *  - gifUrl 非空(无论 asset:/https://)→ 包 <ExerciseGifImage> 在圆形/square frame 里
 *    - bundled(30 张)→ 秒开,无 Skeleton
 *    - remote(22 张 + 未来扩展)→ Skeleton → Image
 *  - gifUrl 为 null(自定义动作 / 数据缺失)→ fallback 首字符,与旧风格一致
 *
 * Props:
 *  - size: 渲染像素(默认 40)。外层容器 width=height=size
 *  - name: 动作名(fallback 用)
 *  - rounded: 'circle'(默认,做头像)| 'square'(8px 圆角,列表行可考虑)
 *  - resizeMode: 默认 'cover'。需要看完整图(罕见)传 'contain'
 *
 * 已知限制:
 *  - GIF 仍在循环播。如果未来用户报"动画太花眼",考虑
 *    Lottie 替代或 react-native-fast-image 的 priority。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ExerciseGifImage } from '@/components/ExerciseGifImage';
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

  const hasGif = !!gifUrl;
  const accessibilityLabel = hasGif
    ? `${name} 动作演示缩略图`
    : `${name} 缩略图(无演示)`;

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: hasGif ? colors.surfaceMuted : colors.primaryMuted,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {hasGif ? (
        <ExerciseGifImage
          gifUrl={gifUrl}
          size={size}
          rounded={rounded}
          resizeMode={resizeMode}
          accessibilityLabel={accessibilityLabel}
        />
      ) : (
        // Fallback — user-created 动作 (gifUrl=null)
        <Text
          style={{
            color: colors.primaryPressed,
            fontSize: Math.round(size * 0.4),
            fontWeight: '700',
          }}
        >
          {(name.trim().charAt(0) || '·').toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
