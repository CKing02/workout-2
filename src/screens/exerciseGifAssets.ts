/**
 * G35 §4 — 32 张 GIF 的 RN require() 静态映射表
 *
 * RN 的 `Image` 组件要 image source,只能用静态 `require()` ——
 * 不能在运行时拼字符串。所以这里把 32 个 asset 静态 require 到一张表里,
 * 详情页根据 `gifUrl` 字段的 basename 查。
 *
 * ⚠️ Metro 的 Babel transform 要求 require() 参数必须是字面量字符串 ——
 * 不能 `const r = (p) => require(p); r('./foo')`(实测会 throw
 * "Invalid call at line N: require(path)")。所以下面 32 行必须是
 * 直白的 require('../../assets/exercises/{file}.gif'),不允许
 * 包成函数复用。
 *
 * Jest 不测本文件(`testMatch` 只匹配 `__tests__/*.test.ts`,本文件
 * 不在该目录下),所以 `require` 在 jest-expo preset 里的 transform
 * 会把 GIF 当成空对象返回 —— 不影响编译/测试,只影响真机上的
 * Image 渲染。
 */

import type { ImageSourcePropType } from 'react-native';

export const G35_GIF_ASSETS: Readonly<Record<string, ImageSourcePropType>> = {
  '0025-EIeI8Vf.gif': require('../../assets/exercises/0025-EIeI8Vf.gif'),
  '0027-eZyBC3j.gif': require('../../assets/exercises/0027-eZyBC3j.gif'),
  '0031-25GPyDY.gif': require('../../assets/exercises/0031-25GPyDY.gif'),
  '0032-ila4NZS.gif': require('../../assets/exercises/0032-ila4NZS.gif'),
  '0043-qXTaZnJ.gif': require('../../assets/exercises/0043-qXTaZnJ.gif'),
  '0061-iZop9xO.gif': require('../../assets/exercises/0061-iZop9xO.gif'),
  '0091-kTbSH9h.gif': require('../../assets/exercises/0091-kTbSH9h.gif'),
  '0188-xLYSdtg.gif': require('../../assets/exercises/0188-xLYSdtg.gif'),
  '0203-wqNPGCg.gif': require('../../assets/exercises/0203-wqNPGCg.gif'),
  '0241-gAwDzB3.gif': require('../../assets/exercises/0241-gAwDzB3.gif'),
  '0274-TFqbd8t.gif': require('../../assets/exercises/0274-TFqbd8t.gif'),
  '0285-BU15nH4.gif': require('../../assets/exercises/0285-BU15nH4.gif'),
  '0289-SpYC0Kp.gif': require('../../assets/exercises/0289-SpYC0Kp.gif'),
  '0292-C0MA9bC.gif': require('../../assets/exercises/0292-C0MA9bC.gif'),
  '0308-yz9nUhF.gif': require('../../assets/exercises/0308-yz9nUhF.gif'),
  '0314-ns0SIbU.gif': require('../../assets/exercises/0314-ns0SIbU.gif'),
  '0334-DsgkuIt.gif': require('../../assets/exercises/0334-DsgkuIt.gif'),
  '0336-RRWFUcw.gif': require('../../assets/exercises/0336-RRWFUcw.gif'),
  '0383-EAs3xL9.gif': require('../../assets/exercises/0383-EAs3xL9.gif'),
  '0464-CosupLu.gif': require('../../assets/exercises/0464-CosupLu.gif'),
  '0472-I3tsCnC.gif': require('../../assets/exercises/0472-I3tsCnC.gif'),
  '0549-UHJlbu3.gif': require('../../assets/exercises/0549-UHJlbu3.gif'),
  '0585-my33uHU.gif': require('../../assets/exercises/0585-my33uHU.gif'),
  '0586-17lJ1kr.gif': require('../../assets/exercises/0586-17lJ1kr.gif'),
  '0596-v3xmPAR.gif': require('../../assets/exercises/0596-v3xmPAR.gif'),
  '0652-lBDjFxJ.gif': require('../../assets/exercises/0652-lBDjFxJ.gif'),
  '0861-fUBheHs.gif': require('../../assets/exercises/0861-fUBheHs.gif'),
  '1373-bJYHBIN.gif': require('../../assets/exercises/1373-bJYHBIN.gif'),
  '1379-r29jP7S.gif': require('../../assets/exercises/1379-r29jP7S.gif'),
  '2287-V07qpXy.gif': require('../../assets/exercises/2287-V07qpXy.gif'),
  '2330-LEprlgG.gif': require('../../assets/exercises/2330-LEprlgG.gif'),
  '3666-rjiM4L3.gif': require('../../assets/exercises/3666-rjiM4L3.gif'),
  // ===== G37 补缺 20 个 =====
  '0047-3TZduzM.gif': require('../../assets/exercises/0047-3TZduzM.gif'),
  '3287-LkoAWAE.gif': require('../../assets/exercises/3287-LkoAWAE.gif'),
  '0606-aaXr7ld.gif': require('../../assets/exercises/0606-aaXr7ld.gif'),
  '1325-CmEr4pM.gif': require('../../assets/exercises/1325-CmEr4pM.gif'),
  '0488-zkgRrbK.gif': require('../../assets/exercises/0488-zkgRrbK.gif'),
  '0310-3eGE2JC.gif': require('../../assets/exercises/0310-3eGE2JC.gif'),
  '0406-NJzBsGJ.gif': require('../../assets/exercises/0406-NJzBsGJ.gif'),
  '0095-dG7tG5y.gif': require('../../assets/exercises/0095-dG7tG5y.gif'),
  '0993-sTfvVsG.gif': require('../../assets/exercises/0993-sTfvVsG.gif'),
  '0165-HPlPoQA.gif': require('../../assets/exercises/0165-HPlPoQA.gif'),
  '0976-kmVVAfu.gif': require('../../assets/exercises/0976-kmVVAfu.gif'),
  '0070-qOgPVf6.gif': require('../../assets/exercises/0070-qOgPVf6.gif'),
  '0085-wQ2c4XD.gif': require('../../assets/exercises/0085-wQ2c4XD.gif'),
  '1756-gEyURal.gif': require('../../assets/exercises/1756-gEyURal.gif'),
  '1760-yn8yg1r.gif': require('../../assets/exercises/1760-yn8yg1r.gif'),
  '0024-Y7YcmIJ.gif': require('../../assets/exercises/0024-Y7YcmIJ.gif'),
  '0103-xnInPfE.gif': require('../../assets/exercises/0103-xnInPfE.gif'),
  '0014-r7cT9YD.gif': require('../../assets/exercises/0014-r7cT9YD.gif'),
  '0012-UGhRD1A.gif': require('../../assets/exercises/0012-UGhRD1A.gif'),
  '2138-H1PESYI.gif': require('../../assets/exercises/2138-H1PESYI.gif'),
};

/**
 * 把 DB 里的 `gif_url`(形如 'assets/exercises/0025-EIeI8Vf.gif')解析成
 * RN ImageSourcePropType。返回 undefined 表示没找到(让调用方决定 fallback)。
 */
export function resolveGifSource(gifUrl: string | null | undefined): ImageSourcePropType | undefined {
  if (!gifUrl) return undefined;
  // gifUrl 形如 'assets/exercises/{file}' 或 'videos/{file}'(老 hasaneyldrm 路径)
  const fileName = gifUrl.split('/').pop();
  if (!fileName) return undefined;
  return G35_GIF_ASSETS[fileName];
}