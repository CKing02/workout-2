/**
 * G46 — `motion` 设计 token 单元测。
 *
 * AC-1：导出 `duration / easing / springs` 三个 namespace（顶层 `motion` 也存在）。
 * AC-2：自测 `duration.base === 260`、`springs.gentle.damping === 20`、
 *      `springs.gentle.stiffness === 180`、`springs.snappy.damping === 15`、
 *      `springs.snappy.stiffness === 300`。
 *
 * 关键设计：token 必须是**字面量**（`as const`），数字不能被任何中间计算污染
 * —— 这样 G47 直接传 `motion.duration.base` 给 `withTiming` 才不会出现
 * "明明我以为它是 260 但其实是 250"这类难定位 bug。
 *
 * 注意：生产代码会从 `react-native-reanimated` 引入 `Easing.bezier`。但 jest 环境里
 * `react-native-reanimated/src/index.ts` 启动时会触发
 * `react-native-worklets` 的 NativeWorklets 初始化（`installUnpackers`），
 * 那条调用链在 JS-only 跑不通 —— 我们整个 monorepo 的测试都通过 module-mock 规避。
 * 这里只 mock 出运动 token 真正用到的 `Easing.bezier`：返回带输入参数的 sentinel，
 * 测试里直接读 sentinel 上的参数验证"调用来源"。
 */

// 不用工厂闭包（jest.mock 的工厂 hoist 后，外层 let/const 还在 TDZ），
// 直接把 4 个控制点塞进返回的 sentinel 上 —— 完全无闭包依赖。
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  Easing: {
    // 生产端：返回 `EasingFunctionFactory` 给 worklet 解包；测试端返回一个普通对象，
    // 让断言能直接读出"哪个 motion.easing.* 来自哪次 bezier(...) 调用"。
    bezier: (x1: number, y1: number, x2: number, y2: number) => ({
      __mockEasing: true,
      x1,
      y1,
      x2,
      y2,
      // 模仿 EasingFunctionFactory 形态（worklet 端会按这个接口解包）：
      factory: () => () => 0,
    }),
  },
}));

// 注意：在 jest.mock(...) 之后才能 import 目标模块 —— 否则 mock 工厂不会跑，
// `motion.ts` 会去加载真的 reanimated，触发 worklets 原生初始化。
import { duration, easing, motion, springs } from '@/theme/motion';

describe('G46 motion tokens', () => {
  describe('AC-1 namespace 导出完整', () => {
    it('顶层 `motion` 存在且聚合三个子 namespace', () => {
      expect(motion).toBeDefined();
      expect(motion.duration).toBe(duration);
      expect(motion.easing).toBe(easing);
      expect(motion.springs).toBe(springs);
    });

    it('duration 5 个 key 全部存在', () => {
      // 用 Array#sort 防 Object.keys 顺序不稳定（jest @30 内部 JS 引擎顺序不可靠）。
      expect(Object.keys(duration).sort()).toEqual(
        ['base', 'emphasis', 'fast', 'instant', 'slow'],
      );
    });

    it('easing 3 个 key 全部存在', () => {
      expect(Object.keys(easing).sort()).toEqual(
        ['accelerate', 'decelerate', 'standard'],
      );
    });

    it('springs 2 个 key 全部存在', () => {
      expect(Object.keys(springs).sort()).toEqual(['gentle', 'snappy']);
    });
  });

  describe('AC-2 字面量值', () => {
    it('duration 字面量（base === 260）', () => {
      expect(duration.instant).toBe(100);
      expect(duration.fast).toBe(180);
      expect(duration.base).toBe(260);
      expect(duration.slow).toBe(400);
      expect(duration.emphasis).toBe(600);
    });

    it('springs 字面量（gentle.damping === 20）', () => {
      expect(springs.gentle.damping).toBe(20);
      expect(springs.gentle.stiffness).toBe(180);
      expect(springs.snappy.damping).toBe(15);
      expect(springs.snappy.stiffness).toBe(300);
    });

    it('所有 duration 值都是 number（不是字符串）', () => {
      for (const k of Object.keys(duration) as Array<keyof typeof duration>) {
        expect(typeof duration[k]).toBe('number');
      }
    });

    it('springs 的两个对象都是 plain object（无 mass 字段污染 spec）', () => {
      // motion.ts 没给 mass 默认值 —— 验证 spec 严格匹配：
      expect(Object.keys(springs.gentle).sort()).toEqual(['damping', 'stiffness']);
      expect(Object.keys(springs.snappy).sort()).toEqual(['damping', 'stiffness']);
    });
  });

  describe('easing = Material 3 标准 cubic-bezier', () => {
    it('standard 来自一次 bezier(0.2, 0, 0, 1)', () => {
      const e = motion.easing.standard as unknown as {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      };
      expect(e.x1).toBe(0.2);
      expect(e.y1).toBe(0);
      expect(e.x2).toBe(0);
      expect(e.y2).toBe(1);
    });

    it('decelerate 来自一次 bezier(0, 0, 0, 1)', () => {
      const e = motion.easing.decelerate as unknown as {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      };
      expect(e.x1).toBe(0);
      expect(e.y1).toBe(0);
      expect(e.x2).toBe(0);
      expect(e.y2).toBe(1);
    });

    it('accelerate 来自一次 bezier(0.3, 0, 1, 1)', () => {
      const e = motion.easing.accelerate as unknown as {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      };
      expect(e.x1).toBe(0.3);
      expect(e.y1).toBe(0);
      expect(e.x2).toBe(1);
      expect(e.y2).toBe(1);
    });
  });

  describe('类型安全：可直传 withTiming / withSpring', () => {
    it('duration[key] 可索引访问（不抛）', () => {
      // 真实代码会写 `withTiming(v, { duration: motion.duration.base })`
      // —— 必须能在测试里直接读出来而不抛 TypeError。
      const d: number = motion.duration.base;
      expect(d).toBe(260);
    });

    it('springs[key].damping 可索引访问', () => {
      const cfg = motion.springs.gentle;
      expect(cfg.damping).toBe(20);
      expect(cfg.stiffness).toBe(180);
    });
  });
});
