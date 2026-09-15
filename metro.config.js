/**
 * Metro config — Expo SDK 57 + reanimated 4.6 + react-native-worklets 0.12 (Bundle Mode).
 *
 * 关键约束:
 * - `getDefaultConfig` 来自 expo/metro-config,带 Expo 默认的 resolver/transformer。
 * - `getBundleModeMetroConfig` 来自 react-native-worklets/bundleMode,做两件事:
 *   1. serializer.createModuleIdFactory — 让 worklets babel plugin 写入
 *      `node_modules/react-native-worklets/.worklets/<hash>.js` 的模块在 metro
 *      端有稳定的 numeric id (worklet hash),避免与主 bundle 的自增 id 冲突。
 *   2. resolver.resolveRequest — 拦截 `react-native-worklets/.worklets/...`
 *      的 require,直接解析到磁盘路径(否则 metro 会去 `react-native-worklets/lib/...` 找)。
 * - `wrapWithReanimatedMetroConfig` 加 reanimated stack collapse(symbolicator)。
 * - 顺序很重要:`wrapWithReanimatedMetroConfig` 在外层,`getBundleModeMetroConfig` 在内层,
 *   这样 expo 默认的 resolveRequest 仍可被 bundle mode 拦截。
 */

const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// worklets 0.12 bundle mode 让 babel plugin 把每个 worklet factory 拆成
// `node_modules/react-native-worklets/.worklets/<hash>.js` 文件,这些文件被
// 主 bundle 当作独立模块 require。但它们在 `node_modules/` 里,默认 watchFolders
// 不含,所以 metro 报 "Failed to get the SHA-1 for ... .worklets/<hash>.js"。
// 修复:把 `node_modules/react-native-worklets/.worklets` 加进 watchFolders。
config.watchFolders = [
  ...(config.watchFolders ?? []),
  require('path').join(__dirname, 'node_modules', 'react-native-worklets', '.worklets'),
];

module.exports = wrapWithReanimatedMetroConfig(getBundleModeMetroConfig(config));
