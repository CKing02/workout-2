import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useSettingsStore } from '@/store/settingsStore';
import { ThemeProvider } from '@/theme';

let tree: TestRenderer.ReactTestRenderer;

function render(node: React.ReactElement, mode: 'light' | 'dark' = 'light') {
  act(() => {
    useSettingsStore.setState({ themeMode: mode });
    tree = TestRenderer.create(<ThemeProvider initialMode={mode}>{node}</ThemeProvider>);
  });
  return tree;
}

afterEach(() => {
  act(() => {
    tree?.unmount();
    useSettingsStore.setState({ themeMode: 'light' });
  });
});

describe('EmptyState', () => {
  it('渲染主题 SVG 插画与语义标题', () => {
    render(<EmptyState illustration="plan" title="还没有训练计划" />);

    expect(tree.root.findByProps({ testID: 'empty-state-illustration-plan' })).toBeTruthy();
    expect(tree.root.findAllByType(Text).find((node) => node.props.accessibilityRole === 'header')?.props.children)
      .toBe('还没有训练计划');
  });

  it.each(['training', 'plan', 'measurement', 'search', 'chart', 'missing', 'healthy'] as const)(
    '渲染 %s 插画',
    (illustration) => {
      render(<EmptyState illustration={illustration} title="空状态" />);
      expect(tree.root.findByProps({ testID: `empty-state-illustration-${illustration}` })).toBeTruthy();
    },
  );

  it('深色模式使用主题色 token', () => {
    render(<EmptyState illustration="plan" title="深色空状态" />, 'dark');

    expect(tree.root.findAll((node) => node.props.fill === '#3A1E14').length).toBeGreaterThan(0);
    expect(tree.root.findAll((node) => node.props.stroke === '#FF7A4D').length).toBeGreaterThan(0);
  });

  it('CTA 有可访问名称并触发操作', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        illustration="search"
        title="没有匹配的动作"
        actionLabel="清除筛选"
        onAction={onAction}
      />,
    );

    const button = tree.root.findByType(Button);
    expect(button.props.accessibilityLabel).toBe('清除筛选');
    act(() => button.props.onPress());
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('自定义 icon 仍可覆盖内置插画', () => {
    render(<EmptyState icon={<Text testID="custom-icon">自定义</Text>} title="自定义空状态" />);

    expect(tree.root.findByProps({ testID: 'custom-icon' })).toBeTruthy();
    expect(tree.root.findAll((node) => String(node.props.testID).startsWith('empty-state-illustration-')))
      .toHaveLength(0);
  });
});
