// Design tokens, shared with the web app (src/app/globals.css there). Every
// colour and size the screens use lives here, so a re-skin is one file.
//
// The app follows the phone's light/dark setting (or the choice in
// Settings → Appearance). Full-screen video, LIVE and the camera always use
// the dark palette: see ThemeScope in ./index.tsx.

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderSoft: string;
  text: string;
  muted: string;
  mutedStrong: string;
  inactive: string;
  live: string;
  liveText: string;
  onLive: string;
  coin: string;
  coinText: string;
  onCoin: string;
  diamond: string;
  success: string;
  danger: string;
  overlay: string;
  scrim: string;
  /** Text and icons drawn on top of video, in either theme. */
  onMedia: string;
};

export const dark: Palette = {
  bg: '#0C0C0F',
  surface: '#15151A',
  surface2: '#1F1F26',
  border: '#2B2B33',
  borderSoft: '#222229',
  text: '#F4F3F1',
  muted: '#A3A2AB',
  mutedStrong: '#CAC9D0',
  inactive: '#8E8D97',
  live: '#E0285C',
  liveText: '#FF7A9C',
  onLive: '#FFFFFF',
  coin: '#FFB224',
  coinText: '#FFB224',
  onCoin: '#0C0C0F',
  diamond: '#A9C6FF',
  success: '#3DD68C',
  danger: '#FF5C6C',
  overlay: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(12,12,15,0.72)',
  onMedia: '#FFFFFF',
};

export const light: Palette = {
  bg: '#FAF9F7',
  surface: '#FFFFFF',
  surface2: '#F1EFEB',
  border: '#E3E0DA',
  borderSoft: '#ECE9E4',
  text: '#17161A',
  muted: '#6B6A72',
  mutedStrong: '#45444C',
  inactive: '#8B8A92',
  live: '#D61F52',
  liveText: '#B8173F',
  onLive: '#FFFFFF',
  coin: '#FFB224',
  coinText: '#A15C00',
  onCoin: '#17161A',
  diamond: '#2F5FCC',
  success: '#18794E',
  danger: '#C4213F',
  overlay: 'rgba(23,22,26,0.35)',
  scrim: 'rgba(23,22,26,0.45)',
  onMedia: '#FFFFFF',
};

export const fonts = {
  // Classic serif for titles; Inter for everything you read or tap.
  heading: 'Newsreader_600SemiBold',
  headingMedium: 'Newsreader_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Widest a reading column gets on tablets and large phones in landscape. */
export const maxContentWidth = 640;

export function typography(c: Palette) {
  return {
    title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: c.text, letterSpacing: -0.3 },
    h2: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 26, color: c.text, letterSpacing: -0.2 },
    h3: { fontFamily: fonts.bodySemibold, fontSize: 16, color: c.text },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: c.text },
    bodyMuted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: c.muted },
    label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: c.text },
    caption: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  } as const;
}

export type Typography = ReturnType<typeof typography>;
