import type { ServiceType } from '@/types/service';

export const KEYWORD_SYNONYMS: Record<string, string[]> = {
  bed: ['shelter', 'overnight', 'sleep', 'bed', 'housing'],
  food: ['meal', 'food', 'eat', 'breakfast', 'lunch', 'dinner', 'snack'],
  shower: ['shower', 'hygiene', 'bath', 'washing'],
  wifi: ['wifi', 'internet', 'computer', 'library'],
  doctor: ['clinic', 'health', 'medical', 'nurse', 'dentist'],
  warm: ['warming', 'heat', 'cold', 'winter'],
  women: ['women', 'female', 'woman', 'domestic', 'violence'],
  family: ['family', 'children', 'kids', 'child'],
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  shelter: 'Shelter',
  food: 'Food',
  clinic: 'Clinic',
  library: 'Library',
  wifi: 'WiFi',
  hygiene: 'Hygiene',
  warming_centre: 'Warming',
  cooling_centre: 'Cooling',
  restroom: 'Restroom',
  drop_in: 'Drop-in',
};

export function expandQuery(query: string): string[] {
  const lower = query.toLowerCase().trim();
  if (!lower) return [];
  const terms = [lower];
  for (const [, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (synonyms.some((s) => s.includes(lower) || lower.includes(s))) {
      terms.push(...synonyms);
    }
  }
  return [...new Set(terms)];
}
