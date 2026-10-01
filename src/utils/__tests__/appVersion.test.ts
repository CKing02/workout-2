/**
 * 版本号唯一来源 —— 防止 `0.1.0` 那种硬编码回潮。
 *
 * 2026-10-01 出 1.0.0 正式包时真机发现：「我的」页页脚显示 `v0.1.0`，
 * 导出的备份 JSON 里 `appVersion` 也是 `0.1.0`。三个文件各自硬编码了一份
 * 从没更新过的字面量，**且没有任何东西会因它和 app.json 不一致而报错**。
 *
 * 本文件钉两件事：
 *   1. getAppVersion() 真的跟着 app.json 走（而不是任何写死的值）；
 *   2. 那几个调用点不许再出现字面量版本号（源码级断言，见最后一个用例）。
 *
 * 第 2 条是「读源码」的测试，平时少见，但这里正合适：这个 bug 的本质就是
 * **有人写了字面量**，运行时行为完全正常，只有下次发版才暴雷 —— 没有比
 * 直接扫源码更贴合的判据。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import appJson from '../../../app.json';

const mockExpoConfig = { version: undefined as string | undefined };

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig.version === undefined
        ? null
        : { version: mockExpoConfig.version };
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getAppVersion } = require('@/utils/appVersion') as typeof import('@/utils/appVersion');

beforeEach(() => {
  mockExpoConfig.version = undefined;
});

describe('getAppVersion', () => {
  it('读的是 app.json 的 expo.version', () => {
    mockExpoConfig.version = appJson.expo.version;
    expect(getAppVersion()).toBe(appJson.expo.version);
  });

  it('app.json 改版本号时跟着变（不是缓存下来的常量）', () => {
    mockExpoConfig.version = '9.9.9';
    expect(getAppVersion()).toBe('9.9.9');
    mockExpoConfig.version = '8.8.8';
    expect(getAppVersion()).toBe('8.8.8');
  });

  it('expoConfig 拿不到时兜底 0.0.0，不是空串也不是旧值', () => {
    mockExpoConfig.version = undefined; // getter 返回 null
    expect(getAppVersion()).toBe('0.0.0');
  });
});

describe('调用点不再硬编码版本号', () => {
  // appJson.expo.version 当前是 1.0.0，把任何 "x.y.z" 字面量都当嫌疑。
  // 允许 0.0.0（appVersion.ts 的兜底）与测试文件自身。
  const CALL_SITES = [
    'src/screens/ProfileScreen.tsx',
    'src/utils/exportData.ts',
    'src/screens/DiagnosticsScreen.tsx',
  ];

  it.each(CALL_SITES)('%s 里没有版本号字面量', (relPath) => {
    const source = readFileSync(resolve(process.cwd(), relPath), 'utf8');
    const hits = [...source.matchAll(/'(\d+\.\d+\.\d+)'/g)]
      .map((m) => m[1])
      .filter((v) => v !== '0.0.0');
    expect(hits).toEqual([]);
  });
});
