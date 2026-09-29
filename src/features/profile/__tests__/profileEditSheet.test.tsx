/**
 * ProfileEditSheet 单元测。
 *
 * 这个组件是「我的」页与「设置」页**共用**的那一个（原来两份几乎逐字相同的
 * Sheet 合并而来），所以这里不只测内容齐不齐，重点钉三件合并后容易碎的事：
 *
 *  1. **每次打开都重新播种用户名草稿** —— 合并前两份代码在打开时都显式
 *     `setUsernameDraft(username)`；改成组件内部 state 后，如果只写
 *     `useState(username)`，用户「改了 → 取消 → 再打开」会看到上次那份陈旧草稿。
 *     这是整个抽取里最容易引入的回归，专门一条用例钉它。
 *  2. **「恢复默认头像」只在已有头像时出现** —— 没头像时它是个无意义且带
 *     danger 色的入口。
 *  3. **头像动作立即生效、保存只管用户名** —— 存了名字才关抽屉 + toast。
 *
 * mocks：
 *  - `@/components` 整体替换成可断言的哑组件（`Sheet` 内部是 Reanimated + RN
 *    `Modal`，直接挂载会让 `react-test-renderer` 出像环境问题一样的怪错）。
 *  - 两个 store 用真的 zustand 现搭一个最小实现，保住 selector / getState 的语义，
 *    免得测试通过但真实调用姿势不对。
 *
 * ⚠️ 不要整体 mock `expo-modules-core`（原因见 avatarFile.test.ts 顶部）。
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useToastStore } from '@/hooks/useToast';

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: { primary: '#111111' },
    typography: { label: { fontSize: 13 } },
    spacing: { sm: 8, md: 12, lg: 16 },
  }),
}));

jest.mock('@/components', () => {
  const { View: RNView, Text: RNText } = require('react-native');
  return {
    __esModule: true,
    // visible=false 时不渲染 children（真 Sheet 的 Modal 也是这个效果）
    Sheet: ({ visible, title, children }: { visible: boolean; title?: string; children?: unknown }) =>
      visible ? (
        <RNView testID="sheet">
          <RNText testID="sheet-title">{title}</RNText>
          {children as never}
        </RNView>
      ) : null,
    Avatar: ({ uri, text, size }: { uri?: string | null; text?: string; size?: number }) => (
      <RNView testID="avatar" data-uri={uri ?? 'null'} data-text={text ?? ''} data-size={String(size)} />
    ),
    Input: ({
      value,
      onChangeText,
      maxLength,
      autoFocus,
      accessibilityLabel,
    }: {
      value: string;
      onChangeText: (v: string) => void;
      maxLength?: number;
      autoFocus?: boolean;
      accessibilityLabel?: string;
    }) => (
      <RNView
        testID="input"
        data-value={value}
        data-maxLength={String(maxLength)}
        data-autoFocus={String(!!autoFocus)}
        accessibilityLabel={accessibilityLabel}
        onChangeText={onChangeText}
      />
    ),
    MenuRow: ({
      label,
      hint,
      danger,
      onPress,
    }: {
      label: string;
      hint?: string;
      danger?: boolean;
      onPress: () => void;
    }) => (
      <RNView
        testID="menu-row"
        data-label={label}
        data-hint={hint ?? ''}
        data-danger={String(!!danger)}
        onPress={onPress}
      />
    ),
  };
});

jest.mock('@/store/settingsStore', () => {
  const { create } = require('zustand');
  return {
    __esModule: true,
    useSettingsStore: create((set: (p: unknown) => void) => ({
      username: 'ring',
      setUsername: async (name: string) => set({ username: name }),
    })),
  };
});

jest.mock('@/store/avatarStore', () => {
  const { create } = require('zustand');
  return {
    __esModule: true,
    useAvatarStore: create((set: (p: unknown) => void) => ({
      uri: null as string | null,
      loaded: true,
      load: async () => {},
      pickFromLibrary: async () => {},
      clear: async () => set({ uri: null }),
      resetForTests: () => set({ uri: null }),
    })),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ProfileEditSheet } =
  require('@/features/profile/ProfileEditSheet') as typeof import('@/features/profile/ProfileEditSheet');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useSettingsStore } = require('@/store/settingsStore') as typeof import('@/store/settingsStore');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useAvatarStore } = require('@/store/avatarStore') as typeof import('@/store/avatarStore');

/* ------------------------------- 小工具 ------------------------------- */

/**
 * 按 testID 找**宿主节点**（`type` 是字符串的那些）。
 *
 * 不写成 `findAllByType(View)` —— 标题是 `<Text testID="sheet-title">`，宿主类型
 * 是 Text 不是 View，按 View 过滤会永远返回 0 个。只认宿主节点同时也避开了
 * 「mock 函数组件实例 + 它的宿主子节点被算两次」的重复计数。
 */
function nodesByTestId(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);
}

function sheetTitle(tree: TestRenderer.ReactTestRenderer): string | null {
  const t = nodesByTestId(tree, 'sheet-title');
  return t.length ? (t[0].props.children as string) : null;
}

function menuLabels(tree: TestRenderer.ReactTestRenderer): string[] {
  return nodesByTestId(tree, 'menu-row').map((n) => n.props['data-label'] as string);
}

function inputValue(tree: TestRenderer.ReactTestRenderer): string {
  return nodesByTestId(tree, 'input')[0].props['data-value'] as string;
}

function menuRow(tree: TestRenderer.ReactTestRenderer, label: string) {
  const row = nodesByTestId(tree, 'menu-row').find((n) => n.props['data-label'] === label);
  if (!row) throw new Error(`找不到 MenuRow「${label}」；实际有：${menuLabels(tree).join(' / ')}`);
  return row;
}

/**
 * 找 Pressable 节点。
 *
 * ⚠️ **不能用 `findAllByType(Pressable)`** —— RN 0.86 里 `react-native` 导出的
 * `Pressable` 与树里那个同名组件不是同一个对象引用，按类型查永远返回 0 个
 * （`avatar.test.tsx` 里踩过同一个坑）。按 `type.name` 查才有 `onPress`。
 */
function pressables(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((n) => (n.type as { name?: string })?.name === 'Pressable');
}

function pressableByLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  const hit = pressables(tree).find((n) => n.props.accessibilityLabel === label);
  if (!hit) {
    const all = pressables(tree).map((n) => n.props.accessibilityLabel);
    throw new Error(`找不到 accessibilityLabel=「${label}」的按钮；实际有：${all.join(' / ')}`);
  }
  return hit;
}

/** 渲染成受控组件：visible 从外部 state 驱动，方便反复开关。 */
function renderSheet(initialVisible = true) {
  const onClose = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  const render = (visible: boolean) =>
    tree.update(<ProfileEditSheet visible={visible} onClose={onClose} />);

  act(() => {
    tree = TestRenderer.create(<ProfileEditSheet visible={initialVisible} onClose={onClose} />);
  });

  return { tree, onClose, show: render, get current() { return tree; } };
}

/* ------------------------------- 用例 ------------------------------- */

let showSpy: jest.SpyInstance;

beforeEach(() => {
  jest.restoreAllMocks();
  showSpy = jest.spyOn(useToastStore.getState(), 'show').mockImplementation(() => {});
  useSettingsStore.setState({ username: 'ring' });
  useAvatarStore.setState({ uri: null });
});

describe('ProfileEditSheet', () => {
  it('visible=false 时什么都不渲染', () => {
    const { tree } = renderSheet(false);
    expect(nodesByTestId(tree, 'sheet')).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('打开后：标题是「编辑资料」，含头像预览 / 选图入口 / 用户名输入 / 保存', () => {
    const { tree } = renderSheet(true);

    expect(sheetTitle(tree)).toBe('编辑资料');
    expect(nodesByTestId(tree, 'avatar')).toHaveLength(1);
    expect(nodesByTestId(tree, 'input')).toHaveLength(1);
    expect(menuLabels(tree)).toContain('从相册选择');
    expect(inputValue(tree)).toBe('ring');

    act(() => tree.unmount());
  });

  it('头像预览是 72px，并把当前用户名透传下去当兜底首字符', () => {
    const { tree } = renderSheet(true);
    const avatar = nodesByTestId(tree, 'avatar')[0];
    expect(avatar.props['data-size']).toBe('72');
    expect(avatar.props['data-text']).toBe('ring');
    act(() => tree.unmount());
  });

  it('用户名输入 maxLength=20 且 autoFocus', () => {
    const { tree } = renderSheet(true);
    const input = nodesByTestId(tree, 'input')[0];
    expect(input.props['data-maxLength']).toBe('20');
    expect(input.props['data-autoFocus']).toBe('true');
    act(() => tree.unmount());
  });

  /* ---------------- 回归主线：每次打开都重新播种草稿 ---------------- */

  describe('草稿播种（合并两份 Sheet 时最容易碎的地方）', () => {
    it('打开时用当前用户名播种', () => {
      useSettingsStore.setState({ username: '阿强' });
      const { tree } = renderSheet(true);
      expect(inputValue(tree)).toBe('阿强');
      act(() => tree.unmount());
    });

    it('「改了 → 取消 → 再打开」看到的是保存过的值，不是上次没保存的陈旧草稿', () => {
      const { tree, show } = renderSheet(true);

      // 用户改了输入框，但没点保存
      act(() => {
        nodesByTestId(tree, 'input')[0].props.onChangeText('改了一半');
      });
      expect(inputValue(tree)).toBe('改了一半');

      // 关掉再打开
      act(() => show(false));
      act(() => show(true));

      // 必须回到 store 里的值 —— 若只写 useState(username) 这里会是「改了一半」
      expect(inputValue(tree)).toBe('ring');

      act(() => tree.unmount());
    });

    it('从另一个入口改了用户名后再打开，草稿跟着变（依赖数组里有 username）', () => {
      const { tree, show } = renderSheet(true);
      act(() => show(false));

      act(() => {
        useSettingsStore.setState({ username: '新名字' });
      });
      act(() => show(true));

      expect(inputValue(tree)).toBe('新名字');
      act(() => tree.unmount());
    });
  });

  /* ---------------------------- 保存 ---------------------------- */

  describe('保存', () => {
    const saveButton = (tree: TestRenderer.ReactTestRenderer) =>
      pressableByLabel(tree, '保存用户名');

    it('保存去掉首尾空格后的用户名 + 关抽屉 + success toast', async () => {
      const { tree, onClose } = renderSheet(true);
      const setUsername = jest.spyOn(useSettingsStore.getState(), 'setUsername');

      act(() => {
        nodesByTestId(tree, 'input')[0].props.onChangeText('  阿强  ');
      });
      await act(async () => {
        await saveButton(tree).props.onPress();
      });

      expect(setUsername).toHaveBeenCalledWith('阿强');
      expect(useSettingsStore.getState().username).toBe('阿强');
      expect(onClose).toHaveBeenCalledTimes(1);
      // toast.show(msg, 'success') 会转成 { variant: 'success' } 传给 store
      expect(showSpy).toHaveBeenCalledWith('用户名已保存', { variant: 'success' });

      act(() => tree.unmount());
    });

    it('存空名：仍然关抽屉，但不 toast 成功（保持抽取前的老行为）', async () => {
      const { tree, onClose } = renderSheet(true);

      act(() => {
        nodesByTestId(tree, 'input')[0].props.onChangeText('   ');
      });
      await act(async () => {
        await saveButton(tree).props.onPress();
      });

      expect(useSettingsStore.getState().username).toBe('');
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(showSpy).not.toHaveBeenCalled();

      act(() => tree.unmount());
    });
  });

  /* -------------------------- 头像动作 -------------------------- */

  describe('头像', () => {
    it('没有头像时不显示「恢复默认头像」', () => {
      const { tree } = renderSheet(true);
      expect(menuLabels(tree)).toEqual(['从相册选择']);
      act(() => tree.unmount());
    });

    it('有头像时多一个 danger 的「恢复默认头像」', () => {
      useAvatarStore.setState({ uri: 'file:///doc/avatars/avatar-1.jpg' });
      const { tree } = renderSheet(true);

      expect(menuLabels(tree)).toEqual(['从相册选择', '恢复默认头像']);
      expect(menuRow(tree, '恢复默认头像').props['data-danger']).toBe('true');
      expect(nodesByTestId(tree, 'avatar')[0].props['data-uri']).toBe(
        'file:///doc/avatars/avatar-1.jpg',
      );

      act(() => tree.unmount());
    });

    it('「从相册选择」→ 调 avatarStore.pickFromLibrary（头像立即生效，不等保存）', async () => {
      const { tree } = renderSheet(true);
      const pick = jest.spyOn(useAvatarStore.getState(), 'pickFromLibrary');

      await act(async () => {
        await menuRow(tree, '从相册选择').props.onPress();
      });

      expect(pick).toHaveBeenCalledTimes(1);

      act(() => tree.unmount());
    });

    it('「恢复默认头像」→ 调 avatarStore.clear 并 toast', async () => {
      useAvatarStore.setState({ uri: 'file:///doc/avatars/avatar-1.jpg' });
      const { tree } = renderSheet(true);
      const clear = jest.spyOn(useAvatarStore.getState(), 'clear');

      await act(async () => {
        await menuRow(tree, '恢复默认头像').props.onPress();
      });

      expect(clear).toHaveBeenCalledTimes(1);
      expect(useAvatarStore.getState().uri).toBeNull();
      expect(showSpy).toHaveBeenCalledWith('已恢复默认头像', { variant: 'success' });

      act(() => tree.unmount());
    });

    it('动作进行中（busy）不再接受第二次点击 —— 防止连点拉两次相册', async () => {
      const { tree } = renderSheet(true);
      let release: () => void = () => {};
      jest
        .spyOn(useAvatarStore.getState(), 'pickFromLibrary')
        .mockImplementation(() => new Promise<void>((r) => (release = r)));

      let first!: Promise<void>;
      act(() => {
        first = menuRow(tree, '从相册选择').props.onPress();
      });
      // busy 期间再点一次 —— 应当被直接挡掉
      await act(async () => {
        await menuRow(tree, '从相册选择').props.onPress();
      });
      expect(useAvatarStore.getState().pickFromLibrary).toHaveBeenCalledTimes(1);

      await act(async () => {
        release();
        await first;
      });

      act(() => tree.unmount());
    });
  });
});
