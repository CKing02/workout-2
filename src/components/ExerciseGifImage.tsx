/**
 * G39 — 异步 GIF 渲染器(吃 asset: / https:// / 老 assets/ 路径)。
 *
 * 渲染策略(由 classifyGifSource 决定):
 *  - 'asset'   → 同步 resolveGifSource 拿 RN ImageSource,直接渲染
 *  - 'remote'  → 立刻显示 Skeleton 占位 + useEffect 触发 getCachedOrDownload,
 *                下载完拿到 file:// URI → setSource → 渲染
 *  - 'none'    → 渲染 Skeleton(由外层 ExerciseThumbnail 套上首字符 fallback)
 *
 * props:
 *  - gifUrl: DB 里 exercises.gif_url 字段(asset:/ https:// / 老路径 / null)
 *  - size: 渲染像素(必须;外层 frame 也会用)
 *  - rounded: 'circle' | 'square'(默认 circle,跟 thumbnail 风格一致)
 *  - resizeMode: expo-image contentFit,默认 'cover'
 *  - accessibilityLabel: 屏幕阅读器标签;没传则用通用文案
 *
 * 设计取舍:
 *  - 用 expo-image 而不是 RN Image:expo-image 内置 transition 淡入 + placeholder
 *    + 内存/磁盘 cache policy(G39 还要靠它的 memory-disk cache 兜住热点 GIF)
 *  - expo-image 的 placeholder 只吃 ImageSource,不能传 ReactNode;
 *    所以 Skeleton 用 sibling 方式在外层渲染(source null 时只渲染 Skeleton)
 *  - Promise 不在 hook 里 memo:同一 URL 并发请求会被 React 18+ 自动 dedup
 *    (同一个组件实例 mount 期间 useEffect 不会并发触发),跨实例由 UI 层
 *    控制(gifUrl 变化会 cancel 旧 effect)
 */
import React, { useEffect, useState } from 'react';
import type { ImageSourcePropType, ImageStyle } from 'react-native';
import { Image } from 'expo-image';

import { Skeleton } from '@/components/Skeleton';
import {
  classifyGifSource,
  resolveGifSource,
} from '@/screens/exerciseGifAssets';
import { getCachedOrDownload } from '@/screens/exerciseGifCache';

export type ExerciseGifImageProps = {
  gifUrl?: string | null;
  size: number;
  rounded?: 'circle' | 'square';
  resizeMode?: 'cover' | 'contain';
  accessibilityLabel?: string;
  /**
   * 透传给底层 expo-image <Image> 的样式。
   * 类型限 ImageStyle(width/height/borderRadius 等),不接受 overflow: 'scroll' 这类 View only 属性。
   */
  style?: ImageStyle;
};

export function ExerciseGifImage({
  gifUrl,
  size,
  rounded = 'circle',
  resizeMode = 'cover',
  accessibilityLabel,
  style,
}: ExerciseGifImageProps) {
  const kind = classifyGifSource(gifUrl);

  // bundled → 同步解析;remote → null 等异步;none → null(Skeleton 兜底)
  const [source, setSource] = useState<ImageSourcePropType | null>(() =>
    kind === 'asset' ? resolveGifSource(gifUrl) ?? null : null,
  );

  // remote 路径:异步下载 → setSource
  useEffect(() => {
    if (kind !== 'remote' || !gifUrl) return;
    let cancelled = false;
    setSource(null);
    getCachedOrDownload(gifUrl)
      .then((uri) => {
        if (cancelled || !uri) return;
        setSource({ uri });
      })
      .catch(() => {
        // exerciseGifCache 内部已 console.warn,这里静默
      });
    return () => {
      cancelled = true;
    };
  }, [gifUrl, kind]);

  // 没 source → Skeleton
  if (!source) {
    return (
      <Skeleton
        width={size}
        height={size}
        rounded={rounded === 'circle' ? 'circle' : 'sm'}
        style={style}
      />
    );
  }

  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      contentFit={resizeMode}
      // transition 仅对 ImageSource 变化时生效;这里每次 useEffect 触发 setSource({uri})
      // 也会触发 fade-in。Skeletion → Image 的瞬切被 transition=200 抹平。
      transition={200}
      cachePolicy="memory-disk"
      accessible
      accessibilityLabel={accessibilityLabel ?? '动作演示'}
    />
  );
}
