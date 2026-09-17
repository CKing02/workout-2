/**
 * G39 + G40 — 52 张 bundled GIF 的 RN require() 静态映射 + gifUrl 分类。
 *
 * 背景:
 * - G35 时塞了 52 张 GIF 进 assets/exercises/(5.2MB)。G39 把 30 张保留为
 *   bundled(冷启动 / 离线可用),其余 22 → CDN(首次访问下载到 cache,
 *   见 exerciseGifCache.ts)。
 * - G40 补完:22 张 remote GIF 也已从 hasaneyldrm/exercises-dataset 下载到
 *   assets/exercises/,mapping 里 22 个 bundled:false 全部翻成 true。
 *   现在 52/52 全部 bundled,seed 阶段 gif_url 全部 = asset:{file}。
 *   CDN 路线留作后续 1000+ 动作扩展用(Path C 待开发,见 memory)。
 *
 * RN 的 `Image` 要本地 source 必须用静态 `require()` —— 不能在运行时
 * 拼字符串(会被 Metro Babel transform 拦下,报 "Invalid call at line N:
 * require(path)")。下面 G35_GIF_ASSETS 内 52 个 require() 全部走字面量
 * 路径,不允许包成函数或动态拼接。
 *
 * Jest 不测本文件(`testMatch` 只匹配 `__tests__/*.test.ts`,本文件
 * 不在该目录下),所以 `require` 在 jest-expo preset 里的 transform
 * 会把 GIF 当成空对象返回 —— 不影响编译/测试,只影响真机上的
 * Image 渲染。
 */
import type { ImageSourcePropType } from 'react-native';

/**
 * 52 张 bundled GIF 的 file basename → ImageSourcePropType 映射。
 *
 * Metro 通过这些 require() 静态分析,把对应 GIF 文件作为原生资源打进
 * APK / IPA(走 `react-native-asset` linker);卸载重装都不会丢。
 */
export const G35_GIF_ASSETS: Readonly<Record<string, ImageSourcePropType>> = {
  // 胸 (7)
  '0025-EIeI8Vf.gif': require('../../assets/exercises/0025-EIeI8Vf.gif'),
  '0289-SpYC0Kp.gif': require('../../assets/exercises/0289-SpYC0Kp.gif'),
  '0308-yz9nUhF.gif': require('../../assets/exercises/0308-yz9nUhF.gif'),
  '0596-v3xmPAR.gif': require('../../assets/exercises/0596-v3xmPAR.gif'),
  '0188-xLYSdtg.gif': require('../../assets/exercises/0188-xLYSdtg.gif'),
  '0047-3TZduzM.gif': require('../../assets/exercises/0047-3TZduzM.gif'),
  '0314-ns0SIbU.gif': require('../../assets/exercises/0314-ns0SIbU.gif'),
  // 背 (8)
  '0652-lBDjFxJ.gif': require('../../assets/exercises/0652-lBDjFxJ.gif'),
  '2330-LEprlgG.gif': require('../../assets/exercises/2330-LEprlgG.gif'),
  '0027-eZyBC3j.gif': require('../../assets/exercises/0027-eZyBC3j.gif'),
  '0861-fUBheHs.gif': require('../../assets/exercises/0861-fUBheHs.gif'),
  '0606-aaXr7ld.gif': require('../../assets/exercises/0606-aaXr7ld.gif'),
  '1325-CmEr4pM.gif': require('../../assets/exercises/1325-CmEr4pM.gif'),
  '0488-zkgRrbK.gif': require('../../assets/exercises/0488-zkgRrbK.gif'),
  '0292-C0MA9bC.gif': require('../../assets/exercises/0292-C0MA9bC.gif'),
  // 肩 (8)
  '0091-kTbSH9h.gif': require('../../assets/exercises/0091-kTbSH9h.gif'),
  '0334-DsgkuIt.gif': require('../../assets/exercises/0334-DsgkuIt.gif'),
  '0383-EAs3xL9.gif': require('../../assets/exercises/0383-EAs3xL9.gif'),
  '0203-wqNPGCg.gif': require('../../assets/exercises/0203-wqNPGCg.gif'),
  '0310-3eGE2JC.gif': require('../../assets/exercises/0310-3eGE2JC.gif'),
  '0406-NJzBsGJ.gif': require('../../assets/exercises/0406-NJzBsGJ.gif'),
  '0095-dG7tG5y.gif': require('../../assets/exercises/0095-dG7tG5y.gif'),
  '0993-sTfvVsG.gif': require('../../assets/exercises/0993-sTfvVsG.gif'),
  // 臂 (8)
  '0031-25GPyDY.gif': require('../../assets/exercises/0031-25GPyDY.gif'),
  '0285-BU15nH4.gif': require('../../assets/exercises/0285-BU15nH4.gif'),
  '0241-gAwDzB3.gif': require('../../assets/exercises/0241-gAwDzB3.gif'),
  '0061-iZop9xO.gif': require('../../assets/exercises/0061-iZop9xO.gif'),
  '0165-HPlPoQA.gif': require('../../assets/exercises/0165-HPlPoQA.gif'),
  '0976-kmVVAfu.gif': require('../../assets/exercises/0976-kmVVAfu.gif'),
  '0070-qOgPVf6.gif': require('../../assets/exercises/0070-qOgPVf6.gif'),
  '3287-LkoAWAE.gif': require('../../assets/exercises/3287-LkoAWAE.gif'),
  // 腿 (12)
  '0043-qXTaZnJ.gif': require('../../assets/exercises/0043-qXTaZnJ.gif'),
  '0032-ila4NZS.gif': require('../../assets/exercises/0032-ila4NZS.gif'),
  '2287-V07qpXy.gif': require('../../assets/exercises/2287-V07qpXy.gif'),
  '0336-RRWFUcw.gif': require('../../assets/exercises/0336-RRWFUcw.gif'),
  '1373-bJYHBIN.gif': require('../../assets/exercises/1373-bJYHBIN.gif'),
  '0085-wQ2c4XD.gif': require('../../assets/exercises/0085-wQ2c4XD.gif'),
  '1760-yn8yg1r.gif': require('../../assets/exercises/1760-yn8yg1r.gif'),
  '0585-my33uHU.gif': require('../../assets/exercises/0585-my33uHU.gif'),
  '0586-17lJ1kr.gif': require('../../assets/exercises/0586-17lJ1kr.gif'),
  '1756-gEyURal.gif': require('../../assets/exercises/1756-gEyURal.gif'),
  '0024-Y7YcmIJ.gif': require('../../assets/exercises/0024-Y7YcmIJ.gif'),
  '1379-r29jP7S.gif': require('../../assets/exercises/1379-r29jP7S.gif'),
  // 核心 (6)
  '0464-CosupLu.gif': require('../../assets/exercises/0464-CosupLu.gif'),
  '0274-TFqbd8t.gif': require('../../assets/exercises/0274-TFqbd8t.gif'),
  '0472-I3tsCnC.gif': require('../../assets/exercises/0472-I3tsCnC.gif'),
  '0103-xnInPfE.gif': require('../../assets/exercises/0103-xnInPfE.gif'),
  '0014-r7cT9YD.gif': require('../../assets/exercises/0014-r7cT9YD.gif'),
  '0012-UGhRD1A.gif': require('../../assets/exercises/0012-UGhRD1A.gif'),
  // 全身 (2)
  '0549-UHJlbu3.gif': require('../../assets/exercises/0549-UHJlbu3.gif'),
  '3666-rjiM4L3.gif': require('../../assets/exercises/3666-rjiM4L3.gif'),
  // 有氧 (1)
  '2138-H1PESYI.gif': require('../../assets/exercises/2138-H1PESYI.gif'),
};

/**
 * G39: DB `gif_url` 字段语义。
 *  - `'asset:{filename}'`  → 本地 bundled,秒开
 *  - `'https://...'`        → 走 CDN,首次访问下载到 cache(Path C 待开发)
 *  - `null`/`undefined`    → 无 GIF(自定义动作 / 数据缺失)
 */
export type GifSourceKind = 'asset' | 'remote' | 'none';

/**
 * 把 DB 里的 gif_url 分类。`gifUrl` 是 `assets/exercises/{file}.gif` 风格的旧路径
 * 也识别为 'asset'(兼容 migration v9 前的存量数据)。
 */
export function classifyGifSource(gifUrl: string | null | undefined): GifSourceKind {
  if (!gifUrl) return 'none';
  if (gifUrl.startsWith('asset:')) return 'asset';
  if (gifUrl.startsWith('https://') || gifUrl.startsWith('http://')) return 'remote';
  // 兼容旧路径 'assets/exercises/xxx.gif'(迁移前)
  if (gifUrl.startsWith('assets/exercises/')) return 'asset';
  return 'none';
}

/**
 * 同步解析本地 bundled GIF 的 ImageSource。`gifUrl` 必须是 `asset:{filename}`
 * 或旧 `assets/exercises/{filename}` 风格(分类为 'asset' 的)。
 *
 * 返回 `undefined` 表示:非 bundled(remote/none),调用方需走异步 cache 路径。
 */
export function resolveGifSource(gifUrl: string | null | undefined): ImageSourcePropType | undefined {
  const kind = classifyGifSource(gifUrl);
  if (kind !== 'asset' || !gifUrl) return undefined;
  const fileName = gifUrl.startsWith('asset:')
    ? gifUrl.slice('asset:'.length)
    : gifUrl.slice('assets/exercises/'.length);
  return G35_GIF_ASSETS[fileName];
}
