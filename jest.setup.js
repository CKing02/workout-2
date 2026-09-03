/**
 * G20 — Jest per-test setup（暂留空）。
 *
 * TZ 固定已移到 globalSetup（jest.global-setup.js），因为 Node 启动
 * 时已经缓存时区，setupFiles 阶段改 process.env.TZ 已经太晚。
 *
 * 本文件保留以便后续批次（G20.x）加入 react-native preset 的全局
 * mock / polyfill。
 */