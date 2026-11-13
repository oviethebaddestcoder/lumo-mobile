// Design tokens from the Lumo design canvas. Keep every colour and size the
// screens use here so a re-skin is one file.
export const colors = {
  bg: '#0B0B0F',
  surface: '#16161D',
  surface2: '#1F1F28',
  border: '#2A2A35',
  text: '#F5F5F7',
  muted: '#A1A1AE',
  mutedStrong: '#C9C9D3',
  inactive: '#8E8E9C',
  live: '#D61F52',
  coin: '#FFB224',
  onCoin: '#0B0B0F',
  diamond: '#A9C6FF',
  success: '#3DD68C',
  danger: '#FF5C6C',
  overlay: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(11,11,15,0.72)',
} as const;

export const fonts = {
  heading: 'SpaceGrotesk_700Bold',
  headingMedium: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const type = {
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  h2: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  h3: { fontFamily: fonts.headingMedium, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  bodyMuted: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
} as const;
