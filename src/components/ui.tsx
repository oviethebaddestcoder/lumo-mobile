import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text as RNText,
  TextInput,
  View,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { fonts, makeStyles, maxContentWidth, radius, space, useStatusBar, useTheme, type Typography } from '@/theme';
import { Icon, type IconName } from './Icon';

type Variant = keyof Typography;

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const { type } = useTheme();
  return <RNText {...rest} style={[type[variant], style]} />;
}

/**
 * Page frame. Sets the status bar for the theme, and on tablets keeps the
 * content in a readable centred column unless `fullWidth` (grids, video).
 */
export function Screen({
  children,
  edges = ['top'],
  style,
  fullWidth,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const { colors } = useTheme();
  useStatusBar();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {fullWidth ? children : <View style={{ flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' }}>{children}</View>}
    </SafeAreaView>
  );
}

export function Header({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const s = useStyles();
  return (
    <View style={s.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      >
        <Icon name="back" />
      </Pressable>
      <Text variant="h2" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ minWidth: 24, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'coin' | 'danger';

export function Button({
  title,
  kind = 'primary',
  loading,
  disabled,
  icon,
  style,
  small,
  ...rest
}: Omit<PressableProps, 'style'> & {
  title: string;
  kind?: ButtonKind;
  loading?: boolean;
  icon?: ReactNode;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const bg = {
    primary: colors.live,
    secondary: colors.surface2,
    ghost: 'transparent',
    coin: colors.coin,
    danger: 'transparent',
  }[kind];
  const fg = kind === 'primary' ? colors.onLive : kind === 'coin' ? colors.onCoin : kind === 'danger' ? colors.danger : colors.text;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...rest}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        (kind === 'ghost' || kind === 'danger') && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <RNText style={[s.buttonText, small && { fontSize: 13 }, { color: fg }]}>{title}</RNText>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  size = 24,
  color,
  style,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={style}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Avatar({ uri, name, size = 40, ring }: { uri?: string | null; name?: string; size?: number; ring?: string }) {
  const { colors } = useTheme();
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : (
        <RNText style={{ color: colors.mutedStrong, fontFamily: fonts.bodySemibold, fontSize: size * 0.4 }}>{initial}</RNText>
      )}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: colors.text, borderColor: colors.text }]}
    >
      <RNText style={[s.chipText, active && { color: colors.bg }]}>{label}</RNText>
    </Pressable>
  );
}

export function Field({ label, error, style, ...rest }: TextInputProps & { label?: string; error?: string }) {
  const { colors, scheme } = useTheme();
  const s = useStyles();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inactive}
        selectionColor={colors.live}
        keyboardAppearance={scheme}
        {...rest}
        style={[s.input, error ? { borderColor: colors.danger } : null, style as StyleProp<TextStyle>]}
      />
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.live, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export function ListRow({
  label,
  value,
  icon,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      {icon ? <Icon name={icon} size={20} color={danger ? colors.danger : colors.mutedStrong} /> : null}
      <Text style={{ flex: 1, color: danger ? colors.danger : colors.text }}>{label}</Text>
      {value ? <Text variant="bodyMuted">{value}</Text> : null}
    </Pressable>
  );
}

export function Loading({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }, style]}>
      <ActivityIndicator color={colors.live} />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
      <Text variant="bodyMuted" style={{ textAlign: 'center' }}>
        {message}
      </Text>
      {onRetry ? <Button title="Try again" kind="secondary" small onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: space.sm }}>
      <Text variant="h3">{title}</Text>
      {hint ? (
        <Text variant="bodyMuted" style={{ textAlign: 'center' }}>
          {hint}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function CoinAmount({ value, size = 14 }: { value: number | string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name="coin" size={size + 2} />
      <RNText style={{ color: colors.coinText, fontFamily: fonts.bodySemibold, fontSize: size }}>{value}</RNText>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  buttonSmall: { minHeight: 34, paddingHorizontal: space.lg },
  buttonText: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.mutedStrong, fontFamily: fonts.bodyMedium, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
}));
