/**
 * G20 — Jest per-test setup（暂留空）。
 *
 * TZ 固定已移到 globalSetup（jest.global-setup.js），因为 Node 启动
 * 时已经缓存时区，setupFiles 阶段改 process.env.TZ 已经太晚。
 *
 * 本文件保留以便后续批次（G20.x）加入 react-native preset 的全局
 * mock / polyfill。
 *
 * ## G46 — reanimated 全局 mock 走 `__mocks__/react-native-reanimated.js`（手动 mock）
 *
 * 原因：`src/theme/motion.ts` 在模块加载时调 `Easing.bezier(...)`，会拉
 * `react-native-reanimated/src/index.ts` → `react-native-worklets`
 * NativeWorklets → `loadUnpackers`（native）。JS-only jest 跑不通。
 *
 * 但 `theme` 几乎全 App 都 import，不能靠具体测试 `jest.mock` —— 必须全局挡死。
 *
 * jest `setupFiles` 里的 `jest.mock(...)` 在某些 jest 版本会被忽略。改用
 * jest 原生 manual mock：项目根 `__mocks__/react-native-reanimated.js`
 * 会被 jest 自动发现并应用（无须 setupFiles）。需要重写行为的测试
 * （CountUp / ConfettiBurst）在自己 test file 里 `jest.mock` 覆盖即可。
 */
