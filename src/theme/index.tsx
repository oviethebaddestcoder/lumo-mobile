import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { setStatusBarStyle } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, type ComponentType, type ReactNode } from 'react';
import { Appearance, StyleSheet, useColorScheme, useWindowDimensions, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { create } from 'zustand';
import { dark, light, maxContentWidth, typography, type Palette, type Typography } from './tokens';

export * from './tokens';

export type Scheme = 'light' | 'dark';
export type ThemePref = 'system' | Scheme;
export type Theme = { scheme: Scheme; colors: Palette; type: Typography };

const PREF_KEY = 'lumo.theme';
const themes: Record<Scheme, Theme> = {
  light: { scheme: 'light', colors: light, type: typography(light) },
  dark: { scheme: 'dark', colors: dark, type: typography(dark) },
};

/** The viewer's Appearance choice (Settings → Appearance), kept on the device. */
export const useThemePref = create<{ pref: ThemePref; set: (p: ThemePref) => void; load: () => Promise<void> }>((set) => ({
  pref: 'system',
  set: (pref) => {
    set({ pref });
    // Native pieces (alerts, keyboards, date pickers) follow Appearance.
    Appearance.setColorScheme?.(pref === 'system' ? 'unspecified' : pref);
    void SecureStore.setItemAsync(PREF_KEY, pref).catch(() => undefined);
  },
  load: async () => {
    const v = await SecureStore.getItemAsync(PREF_KEY).catch(() => null);
    if (v === 'light' || v === 'dark') {
      Appearance.setColorScheme?.(v);
      set({ pref: v });
    }
  },
}));

const ThemeContext = createContext<Theme>(themes.light);

/** Root provider: the phone's setting unless the viewer picked one. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useThemePref((s) => s.pref);
  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  useEffect(() => {
    // Root view colour shows during navigation transitions and the keyboard.
    void SystemUI.setBackgroundColorAsync(themes[scheme].colors.bg).catch(() => undefined);
  }, [scheme]);
  return <ThemeContext.Provider value={themes[scheme]}>{children}</ThemeContext.Provider>;
}

/** Forces a palette for a subtree: video, LIVE and the camera are always dark. */
export function ThemeScope({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return <ThemeContext.Provider value={themes[scheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Styles that depend on the palette. Built once per scheme and cached, so it
 * costs the same as a module-level StyleSheet.create.
 *
 *   const useStyles = makeStyles((colors) => ({ box: { backgroundColor: colors.surface } }));
 *   function Thing() { const s = useStyles(); … }
 */
type NamedStyles = { [key: string]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends NamedStyles>(build: (colors: Palette, theme: Theme) => T & NamedStyles): () => Readonly<T> {
  const cache = new Map<Scheme, Readonly<T>>();
  return function useStyles() {
    const theme = useTheme();
    let styles = cache.get(theme.scheme);
    if (!styles) {
      styles = StyleSheet.create(build(theme.colors, theme));
      cache.set(theme.scheme, styles);
    }
    return styles;
  };
}

/** Sets the status bar icons for whichever screen has focus. */
export function useStatusBar(scheme?: Scheme) {
  const theme = useTheme();
  const s = scheme ?? theme.scheme;
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(s === 'dark' ? 'light' : 'dark', true);
    }, [s]),
  );
}

/**
 * Layout breakpoints. Phones get the full width; on tablets and unfolded
 * foldables reading screens become a centred column and grids gain columns.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const wide = width >= 700;
    return {
      width,
      height,
      wide,
      compact: width < 360,
      contentWidth: Math.min(width, maxContentWidth),
      gridColumns: width >= 1000 ? 5 : width >= 700 ? 4 : 3,
    };
  }, [width, height]);
}

function DarkStatusBar() {
  useStatusBar('dark');
  return null;
}

/**
 * Wraps a screen that is mostly video or camera: always the dark palette and
 * light status bar icons, whatever the app theme is.
 */
export function darkScreen<P extends object>(Screen: ComponentType<P>) {
  function DarkScreen(props: P) {
    return (
      <ThemeScope scheme="dark">
        <DarkStatusBar />
        <Screen {...props} />
      </ThemeScope>
    );
  }
  DarkScreen.displayName = `Dark(${Screen.displayName ?? Screen.name})`;
  return DarkScreen;
}

/**
 * Full-bleed style for VideoView. absoluteFill alone is not enough on the web
 * build: a <video> keeps its intrinsic size unless width/height are set.
 */
export const fill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' } as const;
