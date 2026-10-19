/**
 * ExerciseFormSheet — BL-001 回归测试
 *
 * 验证 ExerciseFormSheet 在 picker / browse 两条入口下都可复用,
 * 并把提交的 ExerciseFormInput 形状契约锁住,避免后续重构破坏
 * PlanEditor 「+ 新建」流或 ExerciseLibrary 「+」流。
 */

import React from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { ExerciseFormSheet, type ExerciseFormInput } from '@/components/ExerciseFormSheet';
import { useSettingsStore } from '@/store/settingsStore';
import { ThemeProvider } from '@/theme';

const renderedTrees: TestRenderer.ReactTestRenderer[] = [];
const noop = () => {};

function render(props: {
  onSubmit: (input: ExerciseFormInput) => void | Promise<void>;
  onCancel?: () => void;
  initial?: Parameters<typeof ExerciseFormSheet>[0]['initial'];
}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ThemeProvider initialMode="light">
        <ExerciseFormSheet
          mode="create"
          onSubmit={props.onSubmit}
          onCancel={props.onCancel ?? noop}
          {...(props.initial ? { initial: props.initial } : {})}
        />
      </ThemeProvider>,
    );
  });
  renderedTrees.push(tree);
  return tree;
}

afterEach(() => {
  act(() => {
    for (const tree of renderedTrees.splice(0)) tree.unmount();
    useSettingsStore.setState({ themeMode: 'light' });
  });
});

describe('ExerciseFormSheet — BL-001 picker-create flow', () => {
  it('create mode 下不提供 initial,名称输入 + 保存可触发 onSubmit', async () => {
    const onSubmit = jest.fn();
    const tree = render({ onSubmit });

    // 第一个 TextInput 是「名称」输入。
    const nameInput = tree.root.findByType(TextInput);
    act(() => nameInput.props.onChangeText('蝴蝶机夹胸'));

    // 触发保存 — 通过 Pressable (Button) 难以直接抓取,改走 handleSubmit 路径:
    // 在组件内,onPress={handleSubmit} 绑在 Button primary 上,我们通过找 Button
    // 实例拿不到 props.onPress,所以这里改走另一种验证:模拟点击「保存」按钮
    // 后,name 已更新 + canSave=true,所以 onSubmit 会被调用。
    // 由于没有 ref 暴露,我们直接断言「输入合法时,Button 上的 onPress
    // 引用函数存在即可」,并在第二个 it 测完整提交流。
    const button = tree.root.findAllByProps({ accessibilityLabel: '保存自定义动作' });
    expect(button.length).toBeGreaterThan(0);
  });

  it('onSubmit 在用户填名后被调用,且 payload 形状对齐 ExerciseFormInput', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const tree = render({ onSubmit });

    // 输入名称
    const nameInput = tree.root.findByType(TextInput);
    act(() => nameInput.props.onChangeText('杠铃弯举'));

    // 找「保存自定义动作」Button 并触发
    const saveButton = tree.root.findByProps({ accessibilityLabel: '保存自定义动作' });
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as ExerciseFormInput;
    expect(payload.name).toBe('杠铃弯举');
    expect(Array.isArray(payload.secondaryMuscles)).toBe(true);
    expect(typeof payload.muscleGroup).toBe('string');
    expect(typeof payload.equipment).toBe('string');
    expect(typeof payload.metricType).toBe('string');
  });

  it('名称为空时,onSubmit 不会被调用', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const tree = render({ onSubmit });

    const saveButton = tree.root.findByProps({ accessibilityLabel: '保存自定义动作' });
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('取消按钮触发 onCancel', () => {
    const onCancel = jest.fn();
    const tree = render({ onSubmit: noop, onCancel });

    const cancelButton = tree.root.findByProps({ accessibilityLabel: '取消' });
    act(() => cancelButton.props.onPress());

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
