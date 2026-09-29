/**
 * Avatar 单元测。
 *
 * 覆盖四个分支：
 *  1. 无 uri → 只画首字符，不渲染图片
 *  2. 有 uri → 图片盖在首字符之上（首字符仍在底层，这是「加载失败不留白洞」的前提）
 *  3. onError → 撤掉图片，首字符露出来；换 uri 后重新尝试
 *  4. text 为空 → 显示 ·；传了 onPress → 包 Pressable 且带无障碍语义
 *
 * 不验证（在组件层）：
 *  - 颜色/圆角/字号像素值 —— 由 useTheme 单测覆盖
 *  - expo-image 的缓存行为 —— 那是 image-picker 换图验收的活（真机第 4 条）
 *
 * 实现注：RN 0.86 + React 19 下 `TestRenderer.create` 会触发 "not wrapped in act"
 * 警告，所以所有 create / update 都包在 `act()` 里（同 exerciseThumbnail.test.tsx:14-16）。
 */

import React from 'react';
import { Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { Avatar } from '@/components/Avatar';

// 固定 token —— 只断言结构，不断言颜色。
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: { primary: '#111111', primaryMuted: '#DDDDDD' },
  }),
}));

// expo-image 简化成带 testID 的 View，把 source 序列化进 data-source 供断言。
// （照 exerciseGifImage.test.tsx:26-38 的写法。）
jest.mock('expo-image', () => ({
  __esModule: true,
  Image: (props: { source: unknown; onError?: () => void }) => {
    const RNView = require('react-native').View;
    return (
      <RNView
        testID="avatar-image"
        data-source={JSON.stringify(props.source ?? null)}
        onError={props.onError}
      />
    );
  },
}));

/** 只取 host View 上的 testID，避开 mock 函数组件实例的重复计数。 */
function images(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(View).filter((n) => n.props.testID === 'avatar-image');
}

/**
 * 找 Pressable 节点。
 *
 * ⚠️ **不能用 `findAllByType(Pressable)`** —— RN 0.86 里 `react-native` 导出的
 * `Pressable` 与树里那个同名组件不是同一个对象引用，按类型查永远返回 0 个。
 * 那样写的「不传 onPress 就没有 Pressable」会**假通过**（两边都是 0）。
 * 按 `type.name` 查，或按 host View 的 accessibilityRole 查。
 */
function pressables(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((n) => (n.type as { name?: string })?.name === 'Pressable');
}

/** 承载无障碍语义的 host View —— 判断「可不可点」用这个，不受上面的引用问题影响。 */
function interactiveHosts(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(View).filter((n) => n.props.accessibilityRole === 'button');
}

/** 首字符节点 —— 组件里唯一的 host Text。 */
function initialText(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(Text)[0];
}

function render(props: React.ComponentProps<typeof Avatar>): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Avatar {...props} />);
  });
  return tree;
}

describe('Avatar', () => {
  it('无 uri → 画首字符，不渲染图片', () => {
    const tree = render({ text: 'ring' });

    expect(initialText(tree).props.children).toBe('R'); // 首字母大写
    expect(images(tree)).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('uri 为 null → 同无 uri', () => {
    const tree = render({ text: 'ring', uri: null });

    expect(initialText(tree).props.children).toBe('R');
    expect(images(tree)).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('有 uri → 图片渲染且首字符仍在底层（失败时能露出来）', () => {
    const tree = render({ text: 'ring', uri: 'file:///doc/avatars/avatar-1.jpg' });

    const imgs = images(tree);
    expect(imgs).toHaveLength(1);
    expect(JSON.parse(imgs[0].props['data-source'])).toEqual({
      uri: 'file:///doc/avatars/avatar-1.jpg',
    });
    // 底层兜底必须一直在 —— 图片是绝对定位盖上去的。
    expect(tree.root.findAllByType(Text)).toHaveLength(1);

    act(() => tree.unmount());
  });

  it('onError → 撤掉图片，首字符露出来', () => {
    const tree = render({ text: 'ring', uri: 'file:///doc/avatars/gone.jpg' });
    expect(images(tree)).toHaveLength(1);

    act(() => {
      images(tree)[0].props.onError();
    });

    expect(images(tree)).toHaveLength(0);
    expect(initialText(tree).props.children).toBe('R');

    act(() => tree.unmount());
  });

  it('换 uri 后清掉 failed —— 否则换新头像会一直停在首字符', () => {
    const tree = render({ text: 'ring', uri: 'file:///doc/avatars/bad.jpg' });
    act(() => {
      images(tree)[0].props.onError();
    });
    expect(images(tree)).toHaveLength(0);

    act(() => {
      tree.update(<Avatar text="ring" uri="file:///doc/avatars/good.jpg" />);
    });

    expect(images(tree)).toHaveLength(1);

    act(() => tree.unmount());
  });

  it('text 为空 / 全空白 → 显示 ·', () => {
    const t1 = render({ text: '' });
    expect(initialText(t1).props.children).toBe('·');
    act(() => t1.unmount());

    const t2 = render({ text: '   ' });
    expect(initialText(t2).props.children).toBe('·');
    act(() => t2.unmount());

    const t3 = render({});
    expect(initialText(t3).props.children).toBe('·');
    act(() => t3.unmount());
  });

  describe('可交互态', () => {
    it('不传 onPress → 完全不可点（没有 button 语义的节点）', () => {
      const tree = render({ text: 'ring' });

      expect(pressables(tree)).toHaveLength(0);
      expect(interactiveHosts(tree)).toHaveLength(0);

      act(() => tree.unmount());
    });

    it('传 onPress → 包 Pressable，点击回调触发', () => {
      const onPress = jest.fn();
      const tree = render({ text: 'ring', onPress, accessibilityLabel: '更换头像' });

      expect(pressables(tree)).toHaveLength(1);
      expect(interactiveHosts(tree)[0].props.accessibilityLabel).toBe('更换头像');
      expect(interactiveHosts(tree)[0].props.accessibilityRole).toBe('button');

      act(() => {
        pressables(tree)[0].props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);

      act(() => tree.unmount());
    });

    it('未给 accessibilityLabel 时有个默认值（不会让读屏念空）', () => {
      const tree = render({ text: 'ring', onPress: jest.fn() });
      expect(interactiveHosts(tree)[0].props.accessibilityLabel).toBeTruthy();
      act(() => tree.unmount());
    });
  });

  it('size 决定直径与圆角（size/2）', () => {
    const tree = render({ text: 'ring', size: 72, testID: 'avatar-frame' });
    const frame = tree.root.findAllByType(View).filter((n) => n.props.testID === 'avatar-frame');

    expect(frame).toHaveLength(1);
    expect(frame[0].props.style).toMatchObject({ width: 72, height: 72, borderRadius: 36 });

    act(() => tree.unmount());
  });
});
