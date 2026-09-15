/**
 * G35 §1/§2 + G39 / G40 — 翻译 52 个动作 mapping 表 + bundle 52 张 GIF 自测
 *
 * §1 验证:
 * 1. 52 个 seed 全有 mapping
 * 2. 每个 mapping id 在 hasaneyldrm 数据集里都存在
 * 3. 每个 mapping 都同时有 gif_url + 中文 instruction_steps
 * 4. equipment/target 中译表覆盖所有出现的 en 值
 *
 * §2/G40 验证:
 * 5. assetFileName 和 gifUrl 的 basename 一致(改名时只能改一处)
 * 6. bundled === true 的 52 张 GIF 都真实落盘 + GIF89a magic
 * 7. G40 bundled 字段:52 条 true / 0 条 false;true 时 assetFileName 必填
 */

import { EXERCISE_SEEDS } from '../exercises';
import {
  EXERCISE_G35_MAPPING,
  EXERCISE_G35_BY_NAME,
  EQUIPMENT_EN_TO_ZH,
  TARGET_EN_TO_CATEGORY_ZH,
  assertMappingComplete,
  translateEquipment,
  translateTarget,
} from '../exerciseG35Mapping';

// exercises-source.json 是 §3 用的源数据,不入库;测试只 read require
// jest 配置应允许读取仓库根目录相对路径
const source = require('../../../../scripts/audit/exercises-source.json') as Array<{
  id: string;
  name: string;
  equipment: string;
  target: string;
  gif_url: string;
  instruction_steps: { zh?: string[] };
}>;

// 项目没有 @types/node,§2 的 GIF 落盘校验只能用 require 走通类型检查。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as {
  existsSync: (p: string) => boolean;
  statSync: (p: string) => { size: number };
  openSync: (p: string, mode: string) => number;
  closeSync: (fd: number) => void;
  readSync: (fd: number, buf: any, offset: number, length: number, position: number) => number;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as {
  resolve: (...segments: string[]) => string;
  join: (...segments: string[]) => string;
  basename: (p: string) => string;
};
declare const __dirname: string;

const ASSETS_DIR = path.resolve(__dirname, '../../../../assets/exercises');

describe('G35 §1 exercise mapping', () => {
  it('52 条 seed 都有对应 mapping', () => {
    expect(EXERCISE_SEEDS.length).toBe(52);
    expect(EXERCISE_G35_MAPPING.length).toBe(52);
    assertMappingComplete(EXERCISE_SEEDS);
  });

  it('52 条 mapping id 在 hasaneyldrm 数据集里都能查到', () => {
    const ids = new Set(source.map((r) => r.id));
    for (const m of EXERCISE_G35_MAPPING) {
      expect(ids.has(m.hasaneyldrmId)).toBe(true);
    }
  });

  it('52 条 mapping 都有 gif_url + 中文 instruction_steps.zh', () => {
    for (const m of EXERCISE_G35_MAPPING) {
      const rec = source.find((r) => r.id === m.hasaneyldrmId)!;
      expect(rec.gif_url).toBeTruthy();
      expect(Array.isArray(rec.instruction_steps.zh)).toBe(true);
      expect(rec.instruction_steps.zh!.length).toBeGreaterThan(0);
    }
  });

  it('gif_url 字段和源数据 gif_url 一致', () => {
    // 防止手抄 id 时写错后缀
    for (const m of EXERCISE_G35_MAPPING) {
      const rec = source.find((r) => r.id === m.hasaneyldrmId)!;
      expect(m.gifUrl).toBe(rec.gif_url);
    }
  });

  it('mapping 表里没有重复的 seedName', () => {
    const names = EXERCISE_G35_MAPPING.map((m) => m.seedName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('BY_NAME 快查表能 O(1) 查到每个 seed', () => {
    for (const m of EXERCISE_G35_MAPPING) {
      expect(EXERCISE_G35_BY_NAME.get(m.seedName)).toEqual(m);
    }
  });
});

describe('G35 §1 equipment en → zh', () => {
  it('52 条 seed 用到的所有 equipment en 值都有中文翻译', () => {
    const used = new Set(EXERCISE_G35_MAPPING.map((m) => m.equipmentEn));
    for (const en of used) {
      expect(translateEquipment(en)).not.toBe(en);
    }
  });

  it('translateEquipment 缺省兜底原样返回', () => {
    expect(translateEquipment('not_in_dict_xyz')).toBe('not_in_dict_xyz');
  });

  it('关键译名一眼看得出', () => {
    expect(translateEquipment('barbell')).toBe('杠铃');
    expect(translateEquipment('dumbbell')).toBe('哑铃');
    expect(translateEquipment('cable')).toBe('缆绳');
    expect(translateEquipment('leverage machine')).toBe('固定器械');
    expect(translateEquipment('body weight')).toBe('自重');
    expect(translateEquipment('kettlebell')).toBe('壶铃');
  });
});

describe('G35 §1 target en → category zh', () => {
  it('52 条 seed 用到的所有 target en 值都有中文翻译', () => {
    const used = new Set(EXERCISE_G35_MAPPING.map((m) => m.targetEn));
    for (const en of used) {
      expect(translateTarget(en)).not.toBe(en);
    }
  });

  it('translateTarget 缺省兜底原样返回', () => {
    expect(translateTarget('not_in_dict_xyz')).toBe('not_in_dict_xyz');
  });

  it('关键译名一眼看得出', () => {
    expect(translateTarget('pectorals')).toBe('胸');
    expect(translateTarget('lats')).toBe('背');
    expect(translateTarget('upper back')).toBe('背');
    expect(translateTarget('delts')).toBe('肩');
    expect(translateTarget('biceps')).toBe('二头');
    expect(translateTarget('triceps')).toBe('三头');
    expect(translateTarget('quads')).toBe('股四头');
    expect(translateTarget('hamstrings')).toBe('腘绳');
    expect(translateTarget('glutes')).toBe('臀');
    expect(translateTarget('calves')).toBe('小腿');
    expect(translateTarget('abs')).toBe('腹');
    expect(translateTarget('cardiovascular system')).toBe('全身');
  });

  it('TARGET_EN_TO_CATEGORY_ZH 没有重复 key', () => {
    expect(new Set(Object.keys(TARGET_EN_TO_CATEGORY_ZH)).size).toBe(
      Object.keys(TARGET_EN_TO_CATEGORY_ZH).length,
    );
  });
});

describe('G35 §1 EQUIPMENT_EN_TO_ZH', () => {
  it('没有重复 key', () => {
    expect(new Set(Object.keys(EQUIPMENT_EN_TO_ZH)).size).toBe(
      Object.keys(EQUIPMENT_EN_TO_ZH).length,
    );
  });
});

describe('G35 §2 GIF bundle', () => {
  it('assetFileName 字段 = gifUrl basename', () => {
    for (const m of EXERCISE_G35_MAPPING) {
      expect(m.assetFileName).toBe(path.basename(m.gifUrl));
    }
  });

  it('assetFileName 没有重复', () => {
    const names = EXERCISE_G35_MAPPING.map((m) => m.assetFileName);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('G40 GIF bundle(52/52 全 bundled,无 remote)', () => {
  const bundled = EXERCISE_G35_MAPPING.filter((m) => m.bundled);
  const remote = EXERCISE_G35_MAPPING.filter((m) => !m.bundled);

  it('bundled === true = 52 张;bundled === false = 0 张', () => {
    expect(bundled.length).toBe(52);
    expect(remote.length).toBe(0);
  });

  it('bundled === true 时 assetFileName 必填且匹配命名规范', () => {
    for (const m of bundled) {
      expect(m.assetFileName).toBeTruthy();
      expect(m.assetFileName).toMatch(/^[0-9]{4}-[A-Za-z0-9]+\.gif$/);
    }
  });

  it('52 张 bundled GIF 都真实落在 assets/exercises/ 下且 > 1 KB', () => {
    for (const m of bundled) {
      const p = path.join(ASSETS_DIR, m.assetFileName!);
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.statSync(p).size).toBeGreaterThan(1024);
    }
  });

  it('52 张 bundled GIF 都是合法 GIF(GIF87a / GIF89a magic)', () => {
    for (const m of bundled) {
      const p = path.join(ASSETS_DIR, m.assetFileName!);
      const fd = fs.openSync(p, 'r');
      try {
        const buf = new Uint8Array(6);
        fs.readSync(fd, buf, 0, 6, 0);
        let s = '';
        for (let i = 0; i < 6; i++) s += String.fromCharCode(buf[i]);
        expect(s.startsWith('GIF8')).toBe(true);
      } finally {
        fs.closeSync(fd);
      }
    }
  });
});