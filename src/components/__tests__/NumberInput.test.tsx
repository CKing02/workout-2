/**
 * NumberInput — BL-004 onFocus 透传回归测试
 *
 * 验证 TextInput.onFocus 时,NumberInput 既执行 select-all 也调用外部传入的
 * onFocus 回调(让父级 ScrollView 能在键盘升起前开始测量 + 滚动)。
 *
 * 父级按 BL-004 顺序很重要:caller 拿到的 onFocus 应在 select-all 之前触发,
 * 这样 measureLayout 测的还是 focus 触发那一刻的位置,而不是文本全选导致
 * 布局微变后的位置(虽然这里实际不会影响位置,但保留这一顺序便于将来扩展)。
 */

import React from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { NumberInput } from '@/components/NumberInput';
import { useSettingsStore } from '@/store/settingsStore';
import { ThemeProvider } from '@/theme';

const renderedTrees: TestRenderer.ReactTestRenderer[] = [];

function render(props: {
  value: number;
  onChangeValue?: (n: number) => void;
  onFocus?: () => void;
  min?: number;
}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ThemeProvider initialMode="light">
        <NumberInput
          value={props.value}
          onChangeValue={props.onChangeValue ?? (() => {})}
          min={props.min ?? 0}
          {...(props.onFocus ? { onFocus: props.onFocus } : {})}
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

describe('NumberInput — BL-004 onFocus 透传', () => {
  it('未提供 onFocus 时,focus 事件不报错', () => {
    const tree = render({ value: 60 });
    expect(() => {
      act(() => tree.root.findByType(TextInput).props.onFocus());
    }).not.toThrow();
  });

  it('focus 事件触发时,caller 的 onFocus 被调用', () => {
    const onFocus = jest.fn();
    const tree = render({ value: 60, onFocus });

    act(() => tree.root.findByType(TextInput).props.onFocus());

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('focus 时 caller 的 onFocus 在内置 select-all 之前触发(顺序契约)', () => {
    // 用一个会修改外部状态的 onFocus 模拟 caller 的副作用
    const order: string[] = [];
    const tree = render({
      value: 60,
      onFocus: () => order.push('caller'),
      min: 0,
    });

    // Monkey-patch TextInput 的 setSelection 来跟踪调用顺序
    const ti = tree.root.findByType(TextInput);
    const originalSetSelection = ti.instance?.setSelection;
    if (ti.instance && originalSetSelection) {
      ti.instance.setSelection = function (...args: unknown[]) {
        order.push('select-all');
        // 恢复 original 防止后续调用踩坑
        return (originalSetSelection as (...a: unknown[]) => unknown).apply(ti.instance, args);
      };
    }

    act(() => ti.props.onFocus());

    expect(order[0]).toBe('caller');
  });

  it('focus 时 onFocus 不依赖 value 是否为 prefill min', () => {
    // value === min 时是 prefill,内置 handleFocus 不做 select-all,
    // 但 caller 的 onFocus 仍要被调用 —— caller 只关心 focus 事件本身。
    const onFocus = jest.fn();
    const tree = render({ value: 0, onFocus, min: 0 });

    act(() => tree.root.findByType(TextInput).props.onFocus());

    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
