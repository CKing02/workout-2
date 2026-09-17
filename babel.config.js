module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated/Worklets plugin must be listed LAST.
      // expo SDK 57 内置 native worklets 是 0.10.1 (见 expo-modules-core peerDeps),
      // JS 端锁 0.10.1 + bundleMode: false (legacy unpacker 模式)。
      // 0.12 bundle mode 跟 native 0.10 mismatch 会触发 SIGSEGV (expo-sqlite async finalize race)。
      ['react-native-worklets/plugin', { bundleMode: false }],
    ],
  };
};