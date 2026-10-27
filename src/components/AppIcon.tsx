/**
 * AppIcon — the app's shared rounded-outline icon language.
 *
 * Keeping these small, themeable SVGs in one place prevents platform glyphs
 * and emoji from changing the UI between Android devices.
 */

import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

export type AppIconName =
  | 'add'
  | 'body'
  | 'calendar'
  | 'chart'
  | 'check'
  | 'chevron'
  | 'chevronDown'
  | 'clock'
  | 'close'
  | 'dumbbell'
  | 'edit'
  | 'export'
  | 'home'
  | 'list'
  | 'minus'
  | 'more'
  | 'play'
  | 'profile'
  | 'scale'
  | 'settings'
  | 'star'
  | 'trash'
  | 'trend'
  | 'trophy'
  | 'stop';

export interface AppIconProps {
  name: AppIconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function AppIcon({
  name,
  size = 24,
  color,
  strokeWidth = 1.8,
}: AppIconProps) {
  const content = (() => {
    switch (name) {
      case 'add':
        return <Path d="M12 5v14M5 12h14" />;
      case 'calendar':
        return (
          <>
            <Rect x="3" y="5" width="18" height="16" rx="3" />
            <Path d="M8 3v4M16 3v4M3 10h18" />
            <Path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
          </>
        );
      case 'body':
        return (
          <>
            <Circle cx="12" cy="5" r="2.5" />
            <Path d="M8 10c1.3-1 2.6-1.5 4-1.5s2.7.5 4 1.5l2 4M6 14l2-4M9.5 10.5 9 15l-2 6M14.5 10.5 15 15l2 6" />
          </>
        );
      case 'trophy':
        return (
          <>
            <Path d="M8 4h8v4c0 4-1.7 6-4 6S8 12 8 8V4Z" />
            <Path d="M8 6H4v2c0 2.2 1.5 4 4 4M16 6h4v2c0 2.2-1.5 4-4 4M12 14v4M8 21h8M9 18h6" />
          </>
        );
      case 'close':
        return <Path d="m6 6 12 12M18 6 6 18" />;
      case 'chevronDown':
        return <Path d="m5 9 7 7 7-7" />;
      case 'more':
        return (
          <>
            <Circle cx="5" cy="12" r="1" fill={color} stroke="none" />
            <Circle cx="12" cy="12" r="1" fill={color} stroke="none" />
            <Circle cx="19" cy="12" r="1" fill={color} stroke="none" />
          </>
        );
      case 'play':
        return <Path d="M8 5.5 19 12 8 18.5Z" />;
      case 'stop':
        return <Rect x="6" y="6" width="12" height="12" rx="2" />;
      case 'star':
        return <Path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />;
      case 'minus':
        return <Path d="M5 12h14" />;
      case 'home':
        return (
          <>
            <Path d="m3.5 10 8.5-7 8.5 7" />
            <Path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
          </>
        );
      case 'profile':
        return (
          <>
            <Circle cx="12" cy="8" r="4" />
            <Path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
          </>
        );
      case 'chart':
        return (
          <>
            <Rect x="3" y="12" width="4" height="8" rx="1" />
            <Rect x="10" y="8" width="4" height="12" rx="1" />
            <Rect x="17" y="4" width="4" height="16" rx="1" />
          </>
        );
      case 'scale':
        return (
          <>
            <Rect x="3" y="4" width="18" height="16" rx="4" />
            <Path d="M8 10a4 4 0 0 1 8 0" />
            <Line x1="12" y1="10" x2="14.5" y2="7.5" />
          </>
        );
      case 'dumbbell':
        return (
          <>
            <Line x1="5" y1="8" x2="5" y2="16" />
            <Line x1="9" y1="6" x2="9" y2="18" />
            <Line x1="15" y1="6" x2="15" y2="18" />
            <Line x1="19" y1="8" x2="19" y2="16" />
            <Line x1="5" y1="12" x2="19" y2="12" />
          </>
        );
      case 'settings':
        return (
          <>
            <Circle cx="12" cy="12" r="3.25" />
            <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
            <Path d="m5.3 5.3 2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
          </>
        );
      case 'export':
        return (
          <>
            <Path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
            <Path d="M5 13v6.5h14V13" />
          </>
        );
      case 'trash':
        return (
          <>
            <Path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
            <Line x1="10" y1="11" x2="10.5" y2="17" />
            <Line x1="14" y1="11" x2="13.5" y2="17" />
          </>
        );
      case 'edit':
        return (
          <>
            <Path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z" />
            <Line x1="14.5" y1="7.1" x2="17.3" y2="9.9" />
          </>
        );
      case 'chevron':
        return <Path d="m9 5 7 7-7 7" />;
      case 'clock':
        return (
          <>
            <Circle cx="12" cy="12" r="9" />
            <Path d="M12 7v5l3.5 2" />
          </>
        );
      case 'trend':
        return (
          <>
            <Path d="M4 18 9 13l4 3 7-9" />
            <Path d="M15 7h5v5" />
          </>
        );
      case 'list':
        return (
          <>
            <Line x1="9" y1="6" x2="20" y2="6" />
            <Line x1="9" y1="12" x2="20" y2="12" />
            <Line x1="9" y1="18" x2="20" y2="18" />
            <Circle cx="4.5" cy="6" r="1" />
            <Circle cx="4.5" cy="12" r="1" />
            <Circle cx="4.5" cy="18" r="1" />
          </>
        );
      case 'check':
        return <Path d="m4.5 12.5 5 5 10-11" />;
    }
  })();

  return (
    <Svg
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <G
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {content}
      </G>
    </Svg>
  );
}
