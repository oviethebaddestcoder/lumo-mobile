import { dark, light, type Palette } from '@/theme/tokens';

// WCAG 2.x relative luminance and contrast ratio.
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
}

// Pairs the screens actually draw. 4.5 for body text, 3 for large text and
// icons (WCAG AA).
const pairs: [keyof Palette, keyof Palette, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface2', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['mutedStrong', 'surface', 4.5],
  ['onLive', 'live', 4.5],
  ['onCoin', 'coin', 4.5],
  ['liveText', 'bg', 4.5],
  ['coinText', 'surface', 4.5],
  ['danger', 'surface', 4.5],
  ['success', 'surface', 4.5],
  ['diamond', 'surface', 3],
  ['inactive', 'bg', 3],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s palette', (_name, p) => {
  test.each(pairs)('%s on %s is readable', (fg, bg, min) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(min);
  });

  test('both palettes define the same tokens', () => {
    expect(Object.keys(p).sort()).toEqual(Object.keys(light).sort());
  });
});
