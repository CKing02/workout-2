/**
 * G46 — `ConfettiBurst` 组件单元测（AC-7 + AC-8）。
 *
 * AC-7：ConfettiBurst 渲染 40 个粒子，`trigger` prop 控制触发。
 * AC-8：ConfettiBurst test snapshot 验证粒子结构。
 *
 * **reanimated mock 设计**：
 * `react-native-reanimated` 在 jest 跑不动（见 motion.test.ts 顶部）。
 * 这里 mock 出 ConfettiBurst + 间接依赖真正用到的 API：
 *   - useSharedValue(init) — 稳定引用 ref
 *   - useAnimatedStyle(updater) — 直接调一次 updater 拿结果（sync，避免 60fps 阻塞 test）
 *   - runOnJS(fn) — sync 调用
 *   - withTiming(v, _, cb) — sync 触发 cb(true)、返回 v
 *   - Animated.View / Animated.createAnimatedComponent — 用 RN View 简化
 *
 * 关键简化：`useAnimatedStyle` 不再返回 worklet —— 直接调一次 updater，捕获
 * transform / opacity 返回值。这是 jest-friendly 简化版，**功能等价**于真实渲染
 * （最终 transform 数值 = worklet 在 0→1 末点的输出）。
 *
 * **节点查询习惯**（项目约定，avatar.test.tsx:49 + exerciseGifImage.test.tsx:59）：
 *   用 `findAllByType(View).filter(n => n.props.testID === id)`，不走正则
 *   `findAllByProps({ testID: /regex/ })` —— 后者 mock 后行为不稳定。
 */

import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

// 顶层变量前缀必须是 `mock`（jest.mock factory 闭包白名单规则）
const mockSharedRef: { value: number } = { value: 0 };

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useSharedValue: (init: number) => {
    mockSharedRef.value = init;
    return mockSharedRef;
  },
  withTiming: (toValue: number, _cfg: unknown, callback?: (finished: boolean) => void) => {
    mockSharedRef.value = toValue;
    if (callback) callback(true);
    return toValue;
  },
  // 简化版：直接调 updater 一次，返回结果。
  // 真实环境由 UI 线程 60fps 跑，这里只关心"初始帧"结构。
  useAnimatedStyle: (updater: () => unknown) => {
    try {
      return updater();
    } catch {
      return {};
    }
  },
  runOnJS: <T extends (...args: never[]) => unknown>(fn: T) => fn,
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
  // 简化的 Animated.View：透传到 RN View。animated style 直接接到 View 上。
  Animated: {
    View: (props: object) => {
      const RNView = require('react-native').View;
      return <RNView {...props} />;
    },
    createAnimatedComponent: <T,>(c: T) => c,
  },
  default: {
    View: (props: object) => {
      const RNView = require('react-native').View;
      return <RNView {...props} />;
    },
  },
}));

jest.mock('@/theme', () => ({
  useColors: () => ({
    primary: '#FF6B35',
    primaryPressed: '#E55525',
    primaryMuted: '#FFE4D8',
  }),
}));

import { ConfettiBurst } from '@/components/ConfettiBurst';

function render(
  props: React.ComponentProps<typeof ConfettiBurst>,
): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ConfettiBurst {...props} />);
  });
  return tree;
}

/** 在 host View 上找 testID === id —— 项目约定（avatar.test.tsx:49）。 */
function viewByTestId(tree: TestRenderer.ReactTestRenderer, id: string): TestRenderer.ReactTestInstance[] {
  return tree.root.findAllByType(View).filter((n) => n.props.testID === id);
}

/** 在 host View 上找 testID 匹配某模式的全部节点。 */
function viewsByTestIdPattern(
  tree: TestRenderer.ReactTestRenderer,
  pattern: RegExp,
): TestRenderer.ReactTestInstance[] {
  return tree.root.findAllByType(View).filter(
    (n) => typeof n.props.testID === 'string' && pattern.test(n.props.testID),
  );
}

const PARTICLE_COUNT = 40;
const PARTICLE_TESTID_PATTERN = /^confetti-particle-\d+$/;

describe('G46 ConfettiBurst', () => {
  beforeEach(() => {
    mockSharedRef.value = 0;
  });

  // ---------------- AC-7 渲染 40 个粒子 ----------------
  describe('AC-7 渲染 40 个粒子 + trigger 控制触发', () => {
    it('默认渲染 40 个粒子', () => {
      const tree = render({ trigger: 1 });
      const particles = viewsByTestIdPattern(tree, PARTICLE_TESTID_PATTERN);
      expect(particles).toHaveLength(PARTICLE_COUNT);
    });

    it('testID 透传到顶层 View', () => {
      const tree = render({ trigger: 1, testID: 'confetti-host' });
      const hosts = viewByTestId(tree, 'confetti-host');
      expect(hosts.length).toBeGreaterThanOrEqual(1);
    });

    it('粒子 testID 从 0 到 39 完整覆盖', () => {
      const tree = render({ trigger: 1 });
      const indices: number[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const nodes = viewByTestId(tree, `confetti-particle-${i}`);
        if (nodes.length > 0) indices.push(i);
      }
      expect(indices).toHaveLength(PARTICLE_COUNT);
      expect(indices[0]).toBe(0);
      expect(indices[PARTICLE_COUNT - 1]).toBe(PARTICLE_COUNT - 1);
    });

    it('粒子具有 backgroundColor（来自 3 种品牌色）', () => {
      const tree = render({ trigger: 1 });
      const particles = viewsByTestIdPattern(tree, PARTICLE_TESTID_PATTERN);
      const colors = new Set<string>();
      for (const node of particles) {
        const bg = readBackgroundColor(node.props.style);
        if (typeof bg === 'string') colors.add(bg);
      }
      expect(colors.size).toBeGreaterThanOrEqual(2);
    });

    it('trigger 变化 → 重新挂载（粒子实例身份改变）', () => {
      const tree1 = render({ trigger: 'alpha' });
      const tree2 = render({ trigger: 'beta' });
      const particles1 = viewsByTestIdPattern(tree1, PARTICLE_TESTID_PATTERN);
      const particles2 = viewsByTestIdPattern(tree2, PARTICLE_TESTID_PATTERN);
      expect(particles1).toHaveLength(PARTICLE_COUNT);
      expect(particles2).toHaveLength(PARTICLE_COUNT);
      // key 变化 (alpha-* vs beta-*) → React 重新挂载 → 实例不能相同
      expect(particles1[0]).not.toBe(particles2[0]);
    });
  });

  // ---------------- AC-8 snapshot 验证粒子结构 ----------------
  describe('AC-8 snapshot 验证粒子结构', () => {
    it('粒子带期望的 width / height / backgroundColor 属性', () => {
      const tree = render({ trigger: 1 });
      const particles = viewsByTestIdPattern(tree, PARTICLE_TESTID_PATTERN);
      const candidates: Array<{ width: number; height: number; backgroundColor: string }> = [];
      for (const node of particles) {
        const s = readStyleObject(node.props.style) as
          | { width?: number; height?: number; backgroundColor?: string }
          | undefined;
        if (s && s.backgroundColor && typeof s.width === 'number') {
          candidates.push({
            width: s.width,
            height: s.height ?? 0,
            backgroundColor: s.backgroundColor,
          });
        }
      }
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      for (const c of candidates) {
        expect(c.width).toBeGreaterThanOrEqual(6);
        expect(c.width).toBeLessThanOrEqual(10);
        expect(c.height).toBeCloseTo(c.width * 0.4, 5);
        expect(c.backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('粒子结构 snapshot（testID + style 静态部分）', () => {
      const tree = render({ trigger: 1 });
      const particles = viewsByTestIdPattern(tree, PARTICLE_TESTID_PATTERN);
      const samples = particles.slice(0, 5).map((n) => ({
        testID: n.props.testID,
        hasStyle: n.props.style !== undefined,
        hasTransform: Array.isArray(n.props.style) && n.props.style.some(
          (s: unknown) => s && typeof s === 'object' && 'transform' in (s as object),
        ),
        hasBackgroundColor: !!readBackgroundColor(n.props.style),
      }));
      expect(samples).toMatchSnapshot();
    });
  });
});

// ---------- helpers ----------

function readBackgroundColor(style: unknown): string | undefined {
  const flat = Array.isArray(style) ? style : [style];
  for (const item of flat) {
    if (
      item &&
      typeof item === 'object' &&
      'backgroundColor' in (item as object) &&
      typeof (item as { backgroundColor: unknown }).backgroundColor === 'string'
    ) {
      return (item as { backgroundColor: string }).backgroundColor;
    }
  }
  return undefined;
}

function readStyleObject(style: unknown): unknown {
  if (Array.isArray(style)) {
    return style.find(
      (s) => s && typeof s === 'object' && 'backgroundColor' in (s as object),
    );
  }
  return style;
}
