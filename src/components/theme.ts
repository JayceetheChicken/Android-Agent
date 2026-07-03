/** Minimal shared design tokens – no UI library on purpose (keep deps small). */
export const colors = {
  background: '#0f1115',
  surface: '#1a1d24',
  surfaceLight: '#242833',
  border: '#333846',
  text: '#e8eaf0',
  textMuted: '#9aa1b1',
  primary: '#4f7cff',
  danger: '#e5484d',
  success: '#46a758',
  warning: '#f5a524',
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
} as const;
