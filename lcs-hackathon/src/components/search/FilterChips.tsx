import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type {
  AccessibilityFilter,
  PopulationFilter,
  ServiceFilters,
  ServiceType,
} from '@/types/service';

interface Chip {
  id: string;
  label: string;
  active: boolean;
  onPress: () => void;
}

interface FilterChipsProps {
  filters: ServiceFilters;
  onFiltersChange: (filters: ServiceFilters) => void;
}

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

const TYPE_CHIPS: Array<{ type: ServiceType; label: string }> = [
  { type: 'shelter', label: 'Shelter' },
  { type: 'food', label: 'Food' },
  { type: 'clinic', label: 'Clinic' },
  { type: 'library', label: 'Library' },
  { type: 'wifi', label: 'WiFi' },
  { type: 'hygiene', label: 'Hygiene' },
  { type: 'warming_centre', label: 'Warming' },
  { type: 'cooling_centre', label: 'Cooling' },
  { type: 'drop_in', label: 'Drop-in' },
];

const POP_CHIPS: Array<{ pop: PopulationFilter; label: string }> = [
  { pop: 'women', label: 'Women' },
  { pop: 'youth', label: 'Youth' },
  { pop: 'families', label: 'Families' },
];

export default function FilterChips({ filters, onFiltersChange }: FilterChipsProps) {
  const theme = useTheme();

  const chips: Chip[] = [
    {
      id: 'open_now',
      label: 'Open now',
      active: filters.openNow,
      onPress: () => onFiltersChange({ ...filters, openNow: !filters.openNow }),
    },
    {
      id: 'has_space',
      label: 'Space available',
      active: filters.hasAvailability,
      onPress: () =>
        onFiltersChange({ ...filters, hasAvailability: !filters.hasAvailability }),
    },
    ...TYPE_CHIPS.map(({ type, label }) => ({
      id: `type_${type}`,
      label,
      active: filters.types.includes(type),
      onPress: () =>
        onFiltersChange({ ...filters, types: toggle(filters.types, type) }),
    })),
    ...POP_CHIPS.map(({ pop, label }) => ({
      id: `pop_${pop}`,
      label,
      active: filters.populations.includes(pop),
      onPress: () =>
        onFiltersChange({
          ...filters,
          populations: toggle(filters.populations, pop),
        }),
    })),
    {
      id: 'acc_wheelchair',
      label: 'Wheelchair',
      active: filters.accessibility.includes('wheelchair'),
      onPress: () =>
        onFiltersChange({
          ...filters,
          accessibility: toggle(filters.accessibility, 'wheelchair' as AccessibilityFilter),
        }),
    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {chips.map((chip) => (
        <TouchableOpacity
          key={chip.id}
          onPress={chip.onPress}
          activeOpacity={0.75}
          style={[
            styles.chip,
            {
              backgroundColor: chip.active ? theme.text : theme.background,
              borderColor: chip.active ? theme.text : theme.backgroundElement,
            },
          ]}>
          <Text
            style={[
              styles.chipText,
              { color: chip.active ? theme.background : theme.text },
            ]}>
            {chip.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
