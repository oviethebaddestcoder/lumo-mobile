import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

export type IconName =
  | 'home'
  | 'live'
  | 'plus'
  | 'play'
  | 'user'
  | 'heart'
  | 'heartFill'
  | 'comment'
  | 'gift'
  | 'share'
  | 'back'
  | 'close'
  | 'coin'
  | 'diamond'
  | 'send'
  | 'settings'
  | 'more'
  | 'eye'
  | 'search'
  | 'flag'
  | 'camera'
  | 'flip'
  | 'mic'
  | 'micOff'
  | 'upload'
  | 'swords'
  | 'qr'
  | 'check'
  | 'bell'
  | 'chat'
  | 'hash'
  | 'bank';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Line icons drawn for Lumo (24px grid). */
export function Icon({ name, size = 24, color = colors.text, strokeWidth = 2 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const body = (() => {
    switch (name) {
      case 'home':
        return <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />;
      case 'live':
        return (
          <>
            <Circle {...p} cx={12} cy={12} r={3} />
            <Path {...p} d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17" />
          </>
        );
      case 'plus':
        return <Path {...p} d="M12 5v14M5 12h14" />;
      case 'play':
        return <Path {...p} fill={color} d="M7 4.5v15l13-7.5z" />;
      case 'user':
        return (
          <>
            <Circle {...p} cx={12} cy={8} r={4} />
            <Path {...p} d="M4 21a8 8 0 0 1 16 0" />
          </>
        );
      case 'heart':
      case 'heartFill':
        return (
          <Path
            {...p}
            fill={name === 'heartFill' ? color : 'none'}
            d="M12 20.5s-8-4.8-8-11A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9c0 6.2-8 11-8 11z"
          />
        );
      case 'comment':
        return <Path {...p} d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />;
      case 'gift':
        return (
          <>
            <Rect {...p} x={3} y={8} width={18} height={5} rx={1} />
            <Path {...p} d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 3.5 7 8 12 8zM12 8s1.5-5 4-4.5S17 8 12 8z" />
          </>
        );
      case 'share':
        return <Path {...p} d="M14 4l7 7-7 7v-4c-6 0-9 2-11 6 0-7 3-12 11-12z" />;
      case 'back':
        return <Path {...p} d="M15 5l-7 7 7 7" />;
      case 'close':
        return <Path {...p} d="M6 6l12 12M18 6 6 18" />;
      case 'coin':
        return (
          <>
            <Circle cx={12} cy={12} r={9} fill={colors.coin} />
            <Path stroke={colors.onCoin} strokeWidth={2} fill="none" strokeLinecap="round" d="M12 7.5v9M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" />
          </>
        );
      case 'diamond':
        return <Path stroke={colors.diamond} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" d="M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16 3-16" />;
      case 'send':
        return <Path {...p} d="M4 12 20 4l-6 16-3-7z" />;
      case 'settings':
        return (
          <>
            <Circle {...p} cx={12} cy={12} r={3} />
            <Path {...p} d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </>
        );
      case 'more':
        return (
          <>
            <Circle cx={5} cy={12} r={1.6} fill={color} />
            <Circle cx={12} cy={12} r={1.6} fill={color} />
            <Circle cx={19} cy={12} r={1.6} fill={color} />
          </>
        );
      case 'eye':
        return (
          <>
            <Path {...p} d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <Circle {...p} cx={12} cy={12} r={3} />
          </>
        );
      case 'search':
        return (
          <>
            <Circle {...p} cx={11} cy={11} r={7} />
            <Path {...p} d="m20 20-3.5-3.5" />
          </>
        );
      case 'flag':
        return <Path {...p} d="M5 21V4M5 4h11l-2 4 2 4H5" />;
      case 'camera':
        return (
          <>
            <Rect {...p} x={2} y={6} width={14} height={12} rx={2} />
            <Path {...p} d="m16 10 6-3v10l-6-3" />
          </>
        );
      case 'flip':
        return <Path {...p} d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4" />;
      case 'mic':
      case 'micOff':
        return (
          <>
            <Rect {...p} x={9} y={3} width={6} height={11} rx={3} />
            <Path {...p} d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            {name === 'micOff' && <Path {...p} d="M3 3l18 18" />}
          </>
        );
      case 'upload':
        return <Path {...p} d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />;
      case 'swords':
        return <Path {...p} d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M9.5 6.5 14 2h3v3l-4.5 4.5M5 14l-2 2 4 4 2-2" />;
      case 'qr':
        return (
          <>
            <Rect {...p} x={3} y={3} width={7} height={7} rx={1} />
            <Rect {...p} x={14} y={3} width={7} height={7} rx={1} />
            <Rect {...p} x={3} y={14} width={7} height={7} rx={1} />
            <Path {...p} d="M14 14h3v3M21 14v7h-4M14 21v-3" />
          </>
        );
      case 'check':
        return <Path {...p} d="m5 12 5 5 9-10" />;
      case 'bell':
        return <Path {...p} d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />;
      case 'chat':
        return <Path {...p} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
      case 'hash':
        return <Path {...p} d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />;
      case 'bank':
        return <Path {...p} d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M12 3 3 8h18z" />;
    }
  })();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
