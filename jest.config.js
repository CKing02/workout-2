/**
 * G20 — Jest 配置。
 *
 * 设计：
 * - preset: jest-expo（Expo SDK 57 官方 preset，自带 RN transform）。
 * - testMatch 收紧到只匹配项目内的 TypeScript 测试文件，避开 .test.tsx
 *   与 node_modules 中的第三方 .test.js。
 * - moduleNameMapper：把 tsconfig.json 里的 @ alias 告诉 jest，让 import
 *   路径以 "@/" 开头的测试代码能解析到 src 目录下。
 * - setupFiles：jest.setup.js，只固定 TZ 到 UTC，让 dayKey / weekKey
 *   这类依赖本地时区的断言在 CI 与本地保持一致。
 * - transformIgnorePatterns：jest-expo 默认已含对 react-native / expo
 *   的白名单，本批纯函数测试不需要额外扩展。
 *
 * 注意：JSDoc 注释里绝对不要嵌入含 "*[slash]" 形式的字符串（例如带
 * "**" + "/" 的 glob 写法），否则会被 V8 当成注释提前关闭。
 */

module.exports = {
  preset: 'jest-expo',
  // src/** + modules/** 都跑。modules/ 下面是本地 expo-module(2026-09-18 新增
  // expo-rest-timer-progress),其 JS 端 wrapper 走 jest mock 不依赖 native runtime。
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.tsx',
    '<rootDir>/modules/**/__tests__/**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globalSetup: '<rootDir>/jest.global-setup.js',
  testEnvironment: 'node',
};