export type ThemeMode = 'dark' | 'light' | 'system';
export const themes = {
  dark: { background: '#131514', surface: '#1C1F1D', user: '#2A302C', text: '#ECEEE8', muted: '#9EA79F', line: '#303630', accent: '#CDDBCB', onAccent: '#20291F', error: '#EAB9AF' },
  light: { background: '#F8F9F5', surface: '#EEF0E9', user: '#E3E9DF', text: '#242B25', muted: '#69746B', line: '#D9DFD5', accent: '#354B3A', onAccent: '#FFFFFF', error: '#963D31' },
};
export type Palette = typeof themes.dark;
