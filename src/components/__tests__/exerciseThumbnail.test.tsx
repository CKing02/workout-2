/**
 * G36 — ExerciseThumbnail 单元测。
 *
 * 验证两个核心分支:
 *  1. 有 gifUrl 且 resolveGifSource 命中 → 渲染 <Image>(无 fallback Text)
 *  2. gifUrl 为 null / resolveGifSource 返回 undefined → 渲染首字符 fallback Text(无 <Image>)
 *
 * 边界:
 *  3. name 为空字符串 → fallback Text 显示 ·
 *  4. gifUrl 透传给 resolveGifSource(不在组件内被改写)
 *
 * 不验证(在组件层):
 *  - 样式像素(borderRadius / size / colors) — 由 useTheme 单测覆盖
 *  - GIF 是否真的显示 / 帧率 — 视觉层
 *  - resolveGifSource 自身逻辑 — 已有 exerciseGifAssets.test.ts 覆盖
 *
 * 实现注:RN 0.86 + React 19 下,TestRenderer.create 会触发 "not wrapped in act"
 * warning(因为 React 19 的 internal scheduler 把 initial render 视为 update),所以
 * 所有 TestRenderer.create 都包在 `act()` 里。
 */
import React from 'react';
import { Image, Text } from 'react-native';
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

// resolveGifSource mock:factory 里直接 jest.fn(),不在外层 const 闭包
// (jest 会 hoist jest.mock 到 import 之前,外层 const 此时未初始化)
jest.mock('@/screens/exerciseGifAssets', () => ({
  resolveGifSource: jest.fn(),
  G35_GIF_ASSETS: {},
}));

import { resolveGifSource } from '@/screens/exerciseGifAssets';

const mockedResolve = resolveGifSource as jest.MockedFunction<typeof resolveGifSource>;

beforeEach(() => {
  mockedResolve.mockReset();
});

function render(props: React.ComponentProps<typeof ExerciseThumbnail>): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ExerciseThumbnail {...props} />);
  });
  return tree;
}

describe('G36 ExerciseThumbnail', () => {
  it('分支 1: 有 gifUrl 且 resolveGifSource 命中 → 渲染 <Image>,无首字符 fallback', () => {
    mockedResolve.mockReturnValue({ uri: 'mock-asset' });

    const tree = render({ name: '杠铃卧推', gifUrl: 'assets/exercises/0025-EIeI8Vf.gif', size: 40 });

    const images = tree.root.findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: 'mock-asset' });

    // 命中分支:无 fallback 首字符 Text
    expect(tree.root.findAllByType(Text)).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('分支 2a: gifUrl=null → 渲染首字符 Text fallback,无 <Image>', () => {
    mockedResolve.mockReturnValue(undefined);

    const tree = render({ name: '自定动作', gifUrl: null, size: 40 });

    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    const texts = tree.root.findAllByType(Text);
    expect(texts.length).toBeGreaterThanOrEqual(1);
    expect(texts[0].props.children).toBe('自');

    act(() => tree.unmount());
  });

  it('分支 2b: gifUrl=undefined → 同样走 fallback', () => {
    mockedResolve.mockReturnValue(undefined);

    const tree = render({ name: '哑铃弯举' });

    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(tree.root.findAllByType(Text)[0].props.children).toBe('哑');

    act(() => tree.unmount());
  });

  it('边界 3: name 为空字符串 → fallback Text 显示 ·', () => {
    mockedResolve.mockReturnValue(undefined);

    const tree = render({ name: '', gifUrl: null });

    // 组件代码:name.trim().charAt(0) || '·'
    expect(tree.root.findAllByType(Text)[0].props.children).toBe('·');

    act(() => tree.unmount());
  });

  it('prop 透传 4: gifUrl 原样传给 resolveGifSource(不截断 / 不转大写)', () => {
    mockedResolve.mockReturnValue(undefined);

    render({ name: 'X', gifUrl: 'assets/exercises/0025-EIeI8Vf.gif' });

    expect(mockedResolve).toHaveBeenCalledTimes(1);
    expect(mockedResolve).toHaveBeenCalledWith('assets/exercises/0025-EIeI8Vf.gif');
  });

  it('大小透传 5: size 决定 Image 的 width/height(命中分支)', () => {
    mockedResolve.mockReturnValue({ uri: 'mock' });

    const tree = render({ name: 'X', gifUrl: 'x.gif', size: 48 });

    const image = tree.root.findAllByType(Image)[0];
    expect(image.props.style).toMatchObject({ width: 48, height: 48 });

    act(() => tree.unmount());
  });
});
