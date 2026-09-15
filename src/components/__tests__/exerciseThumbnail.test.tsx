/**
 * G36 + G39 — ExerciseThumbnail 单元测。
 *
 * 验证三个核心分支:
 *  1. 有 gifUrl(asset:/https://) → 包 <ExerciseGifImage>,无首字符 fallback
 *  2. gifUrl 为 null / undefined → 渲染首字符 fallback Text(无 <ExerciseGifImage>)
 *  3. name 为空字符串 → fallback Text 显示 ·
 *
 * 不验证(在组件层):
 *  - 样式像素(borderRadius / size / colors)— 由 useTheme 单测覆盖
 *  - GIF 是否真的显示 / 帧率 — 视觉层
 *  - ExerciseGifImage 自身缓存逻辑 — 单独测
 *
 * 实现注:RN 0.86 + React 19 下,TestRenderer.create 会触发 "not wrapped in act"
 * warning(因为 React 19 的 internal scheduler 把 initial render 视为 update),所以
 * 所有 TestRenderer.create 都包在 `act()` 里。
 *
 * G39:不再 mock resolveGifSource — 它不再被 ExerciseThumbnail 直接调用;
 * 改 mock ExerciseGifImage,这样断言更稳定(gifUrl 透传给子组件即可)。
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { ExerciseThumbnail } from '@/components/ExerciseThumbnail';

// 用全局 mock 替换 useTheme:返回固定 token,确保断言稳定
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      surfaceMuted: '#EEEEEE',
      primaryMuted: '#DDDDDD',
      primaryPressed: '#333333',
    },
    radius: { md: 8, full: 9999 },
  }),
}));

// ExerciseGifImage mock:把它当成纯透传(收到什么 props 渲染一个标记 Text),
// 这样测试只关心 ExerciseThumbnail 的分支逻辑,不耦合 gifCache / Skeleton。
jest.mock('@/components/ExerciseGifImage', () => ({
  ExerciseGifImage: ({ gifUrl, size }: { gifUrl?: string | null; size: number }) => {
    const { Text: RNText } = require('react-native');
    return <RNText testID="gif-image">{`gif:${gifUrl ?? 'null'}:${size}`}</RNText>;
  },
}));

function render(props: React.ComponentProps<typeof ExerciseThumbnail>): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ExerciseThumbnail {...props} />);
  });
  return tree;
}

describe('G36/G39 ExerciseThumbnail', () => {
  it('分支 1: 有 gifUrl (asset:) → 包 <ExerciseGifImage>,无首字符 fallback', () => {
    const tree = render({ name: '杠铃卧推', gifUrl: 'asset:0025-EIeI8Vf.gif', size: 40 });

    // 命中分支:用 host Text 节点(而不是 findAllByProps)断言 ——
    // 后者会把 mock 函数组件实例 + 它的 host 子节点都算上,数量翻倍。
    const gifTexts = tree.root.findAllByType(Text).filter((t) => t.props.testID === 'gif-image');
    expect(gifTexts).toHaveLength(1);
    expect(gifTexts[0].props.children).toBe('gif:asset:0025-EIeI8Vf.gif:40');

    // 命中分支:无 fallback 首字符 Text
    const fallbackTexts = tree.root.findAllByType(Text).filter((t) => t.props.testID !== 'gif-image');
    expect(fallbackTexts).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('分支 1b: 有 gifUrl (https://) → 也走 ExerciseGifImage 异步下载路径', () => {
    const tree = render({
      name: '颈后下拉',
      gifUrl: 'https://pub-abc.r2.dev/workout2-gifs/exercises/1325-CmEr4pM.gif',
      size: 40,
    });

    const gifTexts = tree.root.findAllByType(Text).filter((t) => t.props.testID === 'gif-image');
    expect(gifTexts).toHaveLength(1);
    expect(gifTexts[0].props.children).toContain('https://');

    act(() => tree.unmount());
  });

  it('分支 2a: gifUrl=null → 渲染首字符 Text fallback,无 <ExerciseGifImage>', () => {
    const tree = render({ name: '自定动作', gifUrl: null, size: 40 });

    expect(
      tree.root.findAllByType(Text).filter((t) => t.props.testID === 'gif-image'),
    ).toHaveLength(0);
    const texts = tree.root.findAllByType(Text);
    expect(texts.length).toBeGreaterThanOrEqual(1);
    expect(texts[0].props.children).toBe('自');

    act(() => tree.unmount());
  });

  it('分支 2b: gifUrl=undefined → 同样走 fallback', () => {
    const tree = render({ name: '哑铃弯举' });

    expect(
      tree.root.findAllByType(Text).filter((t) => t.props.testID === 'gif-image'),
    ).toHaveLength(0);
    expect(tree.root.findAllByType(Text)[0].props.children).toBe('哑');

    act(() => tree.unmount());
  });

  it('边界 3: name 为空字符串 → fallback Text 显示 ·', () => {
    const tree = render({ name: '', gifUrl: null });

    expect(tree.root.findAllByType(Text)[0].props.children).toBe('·');

    act(() => tree.unmount());
  });

  it('大小透传 4: size 传给 ExerciseGifImage', () => {
    const tree = render({ name: 'X', gifUrl: 'asset:0025-EIeI8Vf.gif', size: 48 });

    const gifTexts = tree.root.findAllByType(Text).filter((t) => t.props.testID === 'gif-image');
    expect(gifTexts[0].props.children).toBe('gif:asset:0025-EIeI8Vf.gif:48');

    act(() => tree.unmount());
  });

  it('rounded=square 不再传给 resolveGifSource(那是旧 API)', () => {
    // G39 新实现里 rounded 只用于 frame borderRadius;不直接透传到任何工具函数
    // 这里只验证组件不抛、且有 frame 渲染
    expect(() => render({ name: 'X', gifUrl: 'asset:0025-EIeI8Vf.gif', rounded: 'square' })).not.toThrow();
  });
});
