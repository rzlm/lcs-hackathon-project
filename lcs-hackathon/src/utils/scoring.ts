import type { MarkerColor } from '@/types/service';

export function scoreToColor(score: number | null): MarkerColor {
  if (score === null) return 'gray';
  if (score >= 0.5) return 'green';
  if (score >= 0.2) return 'yellow';
  return 'red';
}

export const MARKER_HEX: Record<MarkerColor, string> = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
  gray: '#9ca3af',
};
