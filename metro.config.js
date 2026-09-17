/**
 * Metro config — Expo SDK 57 + reanimated 4.5.1 + react-native-worklets 0.10.1 (Legacy Mode).
 *
 * 关键约束:
 * - expo SDK 57 内置 native worklets 是 0.10.1(见 expo-modules-core peerDeps),
 *   JS 端锁 0.10.1 后用 legacy mode(不走 bundle mode .worklets/ 拆文件),
 *   babel.config.js 的 `bundleMode: false` 让 worklet factory 直接 inline 到主 bundle。
 * - 不需要 `getBundleModeMetroConfig`,也不需要 `.worklets/` watchFolder。
 * - `wrapWithReanimatedMetroConfig` 仍需要(Reanimated 4 stack collapse symbolicator)。
 *
 * Caveat:曾试过 0.12 bundle mode(见 [[dl2-worklets-012-bundle-mode-deprecated]]),
 * 跟 expo-dev-client native 0.10.1 mismatch → SIGSEGV in expo-sqlite finalize。
 * 必须锁 0.10.1 + legacy,等 expo-dev-client 升 native worklets 才能再切 0.12。
 */

const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = wrapWithReanimatedMetroConfig(config);
