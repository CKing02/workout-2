/**
 * G39 — 30 张 bundled GIF 的 RN require() 静态映射 + gifUrl 分类。
 *
 * 背景:
 * - G35 时塞了 52 张 GIF 进 assets/exercises/(5.2MB)。G39 把 30 张保留为
 *   bundled(冷启动 / 离线可用),其余 22 + 1 orphan → CDN(首次访问下载到
 *   cache,见 exerciseGifCache.ts)。
 *
 * RN 的 `Image` 要本地 source 必须用静态 `require()` ——
 * 不能在运行时拼字符串。所以 30 个 require() 直白列出来。
 *
 * ⚠️ Metro 的 Babel transform 要求 require() 参数必须是字面量字符串 ——
 * 不能 `const r = (p) => require(p); r('./foo')`(实测会 throw
 * "Invalid call at line N: require(path)")。所以下面 30 行必须是
 * 直白的 require('../../assets/exercises/{file}.gif'),不允许
 * 包成函数复用。
 *
 * Jest 不测本文件(`testMatch` 只匹配 `__tests__/*.test.ts`,本文件
 * 不在该目录下),所以 `require` 在 jest-expo preset 里的 transform
 * 会把 GIF 当成空对象返回 —— 不影响编译/测试,只影响真机上的
 * Image 渲染。
 */
import type { ImageSourcePropType } from 'react-native';

const ASSET_PREFIX = '../../assets/exercises/';

// ===== 胸 (5) =====
require(`${ASSET_PREFIX}0025-EIeI8Vf.gif`); // 杠铃卧推
require(`${ASSET_PREFIX}0289-SpYC0Kp.gif`); // 哑铃卧推
require(`${ASSET_PREFIX}0308-yz9nUhF.gif`); // 哑铃飞鸟
require(`${ASSET_PREFIX}0596-v3xmPAR.gif`); // 器械夹胸
require(`${ASSET_PREFIX}0188-xLYSdtg.gif`); // 龙门架夹胸

// ===== 背 (4) =====
require(`${ASSET_PREFIX}0652-lBDjFxJ.gif`); // 引体向上
require(`${ASSET_PREFIX}2330-LEprlgG.gif`); // 高位下拉
require(`${ASSET_PREFIX}0027-eZyBC3j.gif`); // 杠铃划船
require(`${ASSET_PREFIX}0861-fUBheHs.gif`); // 坐姿绳索划船

// ===== 肩 (4) =====
require(`${ASSET_PREFIX}0091-kTbSH9h.gif`); // 杠铃推举
require(`${ASSET_PREFIX}0334-DsgkuIt.gif`); // 哑铃侧平举
require(`${ASSET_PREFIX}0383-EAs3xL9.gif`); // 俯身飞鸟
require(`${ASSET_PREFIX}0203-wqNPGCg.gif`); // 绳索面拉

// ===== 臂 (4) =====
require(`${ASSET_PREFIX}0031-25GPyDY.gif`); // 杠铃弯举
require(`${ASSET_PREFIX}0285-BU15nH4.gif`); // 哑铃弯举
require(`${ASSET_PREFIX}0241-gAwDzB3.gif`); // 三头下压
require(`${ASSET_PREFIX}0061-iZop9xO.gif`); // 仰卧臂屈伸

// ===== 腿 (7) =====
require(`${ASSET_PREFIX}0043-qXTaZnJ.gif`); // 深蹲
require(`${ASSET_PREFIX}0032-ila4NZS.gif`); // 硬拉
require(`${ASSET_PREFIX}2287-V07qpXy.gif`); // 腿推
require(`${ASSET_PREFIX}0336-RRWFUcw.gif`); // 弓步蹲
require(`${ASSET_PREFIX}1373-bJYHBIN.gif`); // 站姿提踵
require(`${ASSET_PREFIX}0085-wQ2c4XD.gif`); // 罗马尼亚硬拉
require(`${ASSET_PREFIX}1760-yn8yg1r.gif`); // 高脚杯深蹲

// ===== 核心 (3) =====
require(`${ASSET_PREFIX}0464-CosupLu.gif`); // 平板支撑
require(`${ASSET_PREFIX}0274-TFqbd8t.gif`); // 卷腹
require(`${ASSET_PREFIX}0472-I3tsCnC.gif`); // 悬垂举腿

// ===== 全身 (2) =====
require(`${ASSET_PREFIX}0549-UHJlbu3.gif`); // 壶铃摇摆
require(`${ASSET_PREFIX}3666-rjiM4L3.gif`); // 跑步机慢跑

// ===== 有氧 (1) =====
require(`${ASSET_PREFIX}2138-H1PESYI.gif`); // 动感单车

/**
 * 30 张 bundled GIF 的 file basename → ImageSourcePropType 映射。
 *
 * 注意:动态拼接 require() 路径会被 Metro Babel transform 拦截 —— 上面的
 * require() 调用必须保留为字面量字符串;下方映射只引用那些已注册的 module。
 */
export const G35_GIF_ASSETS: Readonly<Record<string, ImageSourcePropType>> = {
  '0025-EIeI8Vf.gif': require('../../assets/exercises/0025-EIeI8Vf.gif'),
  '0289-SpYC0Kp.gif': require('../../assets/exercises/0289-SpYC0Kp.gif'),
  '0308-yz9nUhF.gif': require('../../assets/exercises/0308-yz9nUhF.gif'),
  '0596-v3xmPAR.gif': require('../../assets/exercises/0596-v3xmPAR.gif'),
  '0188-xLYSdtg.gif': require('../../assets/exercises/0188-xLYSdtg.gif'),
  '0652-lBDjFxJ.gif': require('../../assets/exercises/0652-lBDjFxJ.gif'),
  '2330-LEprlgG.gif': require('../../assets/exercises/2330-LEprlgG.gif'),
  '0027-eZyBC3j.gif': require('../../assets/exercises/0027-eZyBC3j.gif'),
  '0861-fUBheHs.gif': require('../../assets/exercises/0861-fUBheHs.gif'),
  '0091-kTbSH9h.gif': require('../../assets/exercises/0091-kTbSH9h.gif'),
  '0334-DsgkuIt.gif': require('../../assets/exercises/0334-DsgkuIt.gif'),
  '0383-EAs3xL9.gif': require('../../assets/exercises/0383-EAs3xL9.gif'),
  '0203-wqNPGCg.gif': require('../../assets/exercises/0203-wqNPGCg.gif'),
  '0031-25GPyDY.gif': require('../../assets/exercises/0031-25GPyDY.gif'),
  '0285-BU15nH4.gif': require('../../assets/exercises/0285-BU15nH4.gif'),
  '0241-gAwDzB3.gif': require('../../assets/exercises/0241-gAwDzB3.gif'),
  '0061-iZop9xO.gif': require('../../assets/exercises/0061-iZop9xO.gif'),
  '0043-qXTaZnJ.gif': require('../../assets/exercises/0043-qXTaZnJ.gif'),
  '0032-ila4NZS.gif': require('../../assets/exercises/0032-ila4NZS.gif'),
  '2287-V07qpXy.gif': require('../../assets/exercises/2287-V07qpXy.gif'),
  '0336-RRWFUcw.gif': require('../../assets/exercises/0336-RRWFUcw.gif'),
  '1373-bJYHBIN.gif': require('../../assets/exercises/1373-bJYHBIN.gif'),
  '0085-wQ2c4XD.gif': require('../../assets/exercises/0085-wQ2c4XD.gif'),
  '1760-yn8yg1r.gif': require('../../assets/exercises/1760-yn8yg1r.gif'),
  '0464-CosupLu.gif': require('../../assets/exercises/0464-CosupLu.gif'),
  '0274-TFqbd8t.gif': require('../../assets/exercises/0274-TFqbd8t.gif'),
  '0472-I3tsCnC.gif': require('../../assets/exercises/0472-I3tsCnC.gif'),
  '0549-UHJlbu3.gif': require('../../assets/exercises/0549-UHJlbu3.gif'),
  '3666-rjiM4L3.gif': require('../../assets/exercises/3666-rjiM4L3.gif'),
  '2138-H1PESYI.gif': require('../../assets/exercises/2138-H1PESYI.gif'),
};

/**
 * G39: DB `gif_url` 字段语义。
 *  - `'asset:{filename}'`  → 本地 bundled,秒开
 *  - `'https://...'`        → 走 CDN,首次访问下载到 cache
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