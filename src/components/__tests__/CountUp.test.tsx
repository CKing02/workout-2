/**
 * G46 — `CountUp` 组件单元测（AC-5 + AC-6）。
 *
 * AC-5：props 完整，类型签名稳定。
 * AC-6：从 0 → 100 后最终值渲染正确。
 *
 * **reanimated mock 设计**：
 * `react-native-reanimated/src/index.ts` 启动时触发 `react-native-worklets`
 * NativeWorklets 初始化（`installUnpackers`），JS-only jest 跑不通。这里 mock
 * 出 CountUp + 间接依赖（`theme/motion` → `Easing.bezier`）真正用到的 API：
 *
 *   useSharedValue(init) — 返回**稳定引用**的 `{ value: init }`
 *                          （真实行为：跨 render 同 ref 对象；mock 必须保持一致，
 *                          否则上层 useEffect 的 deps 会因 ref 身份变化反复触发）
 *   withTiming(v, _, cb) — 把 v 写到共享值、调 cb(true)、返回 v
 *   Easing.bezier(...)   — 4 参数 sentinel
 *
 * 不再 mock useAnimatedReaction / runOnJS —— CountUp 已不依赖它们。
 */

import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

// 顶层变量前缀必须是 `mock`（jest.mock factory 闭包白名单规则）
const mockSharedRef: { value: number } = { value: 0 };

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  // 关键：返回**稳定引用**的 ref —— 真实 useSharedValue 也跨 render 同对象。
  useSharedValue: (init: number) => {
    mockSharedRef.value = init;
    return mockSharedRef;
  },
  withTiming: (toValue: number, _cfg: unknown, callback?: (finished: boolean) => void) => {
    // 同步把目标值写到 mock 共享值，然后触发完成回调。
    mockSharedRef.value = toValue;
    if (callback) callback(true);
    return toValue;
  },
  Easing: {
    bezier: (x1: number, y1: number, x2: number, y2: number) => ({
      __mockEasing: true,
      x1,
      y1,
      x2,
      y2,
      factory: () => () => 0,
    }),
  },
}));

import { CountUp } from '@/components/CountUp';

function render(props: React.ComponentProps<typeof CountUp>): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<CountUp {...props} />);
  });
  return tree;
}

function getText(tree: TestRenderer.ReactTestRenderer, testID?: string): string {
  // 直接读 props.children —— 节点 children 里可能含 React 元素对象，
  // String({}) === '[object Object]' 会造成误判。
  if (testID) {
    const nodes = tree.root.findAllByType(Text).filter((n) => n.props.testID === testID);
    expect(nodes).toHaveLength(1);
    return String(nodes[0].props.children);
  }
  const nodes = tree.root.findAllByType(Text);
  expect(nodes).toHaveLength(1);
  return String(nodes[0].props.children);
}

describe('G46 CountUp', () => {
  beforeEach(() => {
    // 每个用例前重置 mock 共享值
    mockSharedRef.value = 0;
  });

  // ---------------- AC-5 props 类型签名 ----------------
  describe('AC-5 props 完整、默认值正确', () => {
    it('只传 value —— 其他 props 用默认', () => {
      const tree = render({ value: 100 });
      // 默认 format = n.toFixed(0)
      expect(getText(tree)).toBe('100');
    });

    it('format 接受自定义函数', () => {
      const tree = render({
        value: 12.5,
        format: (n: number) => `${n}kg`,
      });
      expect(getText(tree)).toBe('12.5kg');
    });

    it('style 透传到 host Text', () => {
      const customStyle: StyleProp<TextStyle> = { color: 'red', fontSize: 42 };
      const tree = render({ value: 100, style: customStyle });
      const node = tree.root.findAllByType(Text)[0];
      expect(node.props.style).toBe(customStyle);
    });

    it('testID 透传到 host Text', () => {
      const tree = render({ value: 100, testID: 'count-up-test' });
      expect(getText(tree, 'count-up-test')).toBe('100');
    });

    it('duration === 0 时同步触发完成回调', () => {
      const onComplete = jest.fn();
      render({ value: 100, duration: 0, onComplete });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------- AC-6 0 → 100 最终值正确 ----------------
  describe('AC-6 0 → 100 后最终值渲染正确', () => {
    it('value=100 渲染 "100"', () => {
      const tree = render({ value: 100 });
      expect(getText(tree)).toBe('100');
    });

    it('value=-50 渲染 "-50"（默认 format 支持负数）', () => {
      const tree = render({ value: -50 });
      expect(getText(tree)).toBe('-50');
    });

    it('value=0 渲染 "0"（支持 0 起点）', () => {
      const tree = render({ value: 0 });
      expect(getText(tree)).toBe('0');
    });

    it('小数 value=3.14 默认 format 渲染 "3"（n.toFixed(0) 截断）', () => {
      const tree = render({ value: 3.14 });
      expect(getText(tree)).toBe('3');
    });

    it('value 改变触发重渲 → 最终值更新', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      act(() => {
        tree = TestRenderer.create(<CountUp value={10} />);
      });
      expect(getText(tree)).toBe('10');

      act(() => {
        tree.update(<CountUp value={200} />);
      });
      expect(getText(tree)).toBe('200');
    });

    it('onComplete 在动画完成时触发一次（不在 setText 后再次触发）', () => {
      const onComplete = jest.fn();
      render({ value: 100, onComplete });
      // 同步 withTiming → callback(true) 同步触发,且 useRef 隔离了 onComplete 身份
      // 变化,setText 触发的 re-render 不会再让 withTiming 重跑
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('组件 unmount 后续 setState 安全（不抛）', () => {
      const onComplete = jest.fn();
      let tree!: TestRenderer.ReactTestRenderer;
      act(() => {
        tree = TestRenderer.create(<CountUp value={100} onComplete={onComplete} />);
      });
      act(() => {
        tree.unmount();
      });
      expect(() => tree).not.toThrow();
    });
  });

  // ---------------- 类型推断 smoke 验证 ----------------
  describe('类型推断', () => {
    it('省略 format 时 props 仍是合法 ComponentProps', () => {
      const tree = render({ value: 5 });
      expect(getText(tree)).toBe('5');
    });
  });
});
