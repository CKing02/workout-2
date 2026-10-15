import React from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { NumberInput } from '@/components/NumberInput';
import { WeightInput } from '@/components/WeightInput';
import { useSettingsStore } from '@/store/settingsStore';
import { ThemeProvider } from '@/theme';

const renderedTrees: TestRenderer.ReactTestRenderer[] = [];

function render(onChangeValue = jest.fn()) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ThemeProvider initialMode="light">
        <WeightInput value={60} onChangeValue={onChangeValue} min={0} max={500} />
      </ThemeProvider>,
    );
  });
  renderedTrees.push(tree);
  return { tree, onChangeValue };
}

describe('WeightInput', () => {
  beforeEach(() => {
    useSettingsStore.setState({ unit: 'kg' });
  });

  afterEach(() => {
    act(() => {
      for (const tree of renderedTrees.splice(0)) tree.unmount();
      useSettingsStore.setState({ unit: 'kg' });
    });
  });

  it('lb 模式显示换算值，未编辑 blur 不回写 kg', () => {
    useSettingsStore.setState({ unit: 'lb' });
    const { tree, onChangeValue } = render();
    const numberInput = tree.root.findByType(NumberInput);

    expect(numberInput.props.value).toBe(132.3);
    expect(numberInput.props.unitLabel).toBe('lb');
    expect(numberInput.props.max).toBe(1102.3);

    act(() => tree.root.findByType(TextInput).props.onBlur());
    expect(onChangeValue).not.toHaveBeenCalled();
  });

  it('lb 输入反向换算为 kg，并受 kg 上限约束', () => {
    useSettingsStore.setState({ unit: 'lb' });
    const { tree, onChangeValue } = render();
    const numberInput = tree.root.findByType(NumberInput);

    act(() => numberInput.props.onChangeValue(220.5));
    expect(onChangeValue).toHaveBeenLastCalledWith(expect.closeTo(100, 1));

    act(() => numberInput.props.onChangeValue(2000));
    expect(onChangeValue).toHaveBeenLastCalledWith(500);
  });

  it('切换单位只更新显示，不写回存储', () => {
    const { tree, onChangeValue } = render();
    expect(tree.root.findByType(NumberInput).props.value).toBe(60);

    act(() => useSettingsStore.setState({ unit: 'lb' }));
    expect(tree.root.findByType(NumberInput).props.value).toBe(132.3);
    expect(onChangeValue).not.toHaveBeenCalled();
  });
});
