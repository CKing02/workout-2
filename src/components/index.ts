/**
 * Public barrel for the design-system components.
 *
 * Always import components via `@/components`, not their individual files.
 * That gives us a single chokepoint for tree-shaking, renaming, or
 * deprecating components.
 */

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { Input } from './Input';
export type { InputProps } from './Input';

export { NumberInput } from './NumberInput';
export type { NumberInputProps } from './NumberInput';

export { Card } from './Card';
export type { CardProps, CardPadding } from './Card';

export { ListItem } from './ListItem';
export type { ListItemProps } from './ListItem';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';

export { Dialog } from './Dialog';
export type { DialogProps } from './Dialog';

export { SegmentedControl } from './SegmentedControl';
export type {
  SegmentedControlProps,
  SegmentedOption,
} from './SegmentedControl';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { TimerRing } from './TimerRing';
export type { TimerRingProps } from './TimerRing';

export { CheckableRow } from './CheckableRow';
export type { CheckableRowProps } from './CheckableRow';

export { Placeholder } from './Placeholder';

export { Toast, useToastDismiss } from './Toast';

export { ErrorBoundary } from './ErrorBoundary';

export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { MenuRow } from './MenuRow';
export type { MenuRowProps } from './MenuRow';