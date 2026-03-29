import '@/global.css';
import { Platform } from 'react-native';

// Your "Cute" Palette merged into the system
export const Colors = {
  light: {
    // Main Background: #EFE9E1 (off white beige)
    background: '#EFE9E1',
    // Cards: #FFFFFF (white for contrast)
    card: '#FFFFFF',
    // Primary Text: #2C2C2C (dark gray)
    text: '#2C2C2C',
    textSecondary: '#60646C',
    
    // Accents
    accentGreen: '#b5e0a6',
    accentGreenDark: '#8ac28b',
    
    // Status Colours
    statusGreen: '#2E7D32',
    statusRed: '#C62828',
    statusOrange: '#F9A825',
    
    // Legacy support (to prevent crashes in other files)
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
  },
  dark: {
    text: '#ffffff',
    background: '#1A1A1A',
    card: '#2A2A2A',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    accentGreen: '#8ac28b',
    accentGreenDark: '#6aa86b',
    statusGreen: '#4CAF50',
    statusRed: '#EF5350',
    statusOrange: '#FFB74D',
  },
} as const;

// Create a 'Palette' alias so your index.tsx works perfectly
export const Palette = Colors.light;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;