module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated/Worklets plugin must be listed LAST.
      // `bundleMode: true` 让 babel 把 worklet factory 拆成 `node_modules/react-native-worklets/.worklets/<hash>.js`
      // 独立文件 + 让 worklets 运行时走 `bundleModeInit` (从 Metro 拉 worklets bundle),不走 legacy unpacker。
      // 必需配套 `metro.config.js` 的 `getBundleModeMetroConfig` 让 metro 解析 `.worklets/` 路径。
      ['react-native-worklets/plugin', { bundleMode: true }],
    ],
  };
};