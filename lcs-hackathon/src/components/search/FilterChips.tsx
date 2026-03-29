import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { Spacing, Palette } from '@/constants/theme';
import type { ServiceFilters } from '@/types/service';

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

/**
 * Helper to add or remove an item from the filter array
 */
function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

/** * EXACT matches for your JSON "sector" field 
 */
const SECTOR_CHIPS = [
  { id: 'Women', label: 'Women' },
  { id: 'Youth', label: 'Youth' },
  { id: 'Families', label: 'Families' },
  { id: 'Men', label: 'Men' },
  { id: 'Mixed Adult', label: 'Mixed Adult' },
];

/** * EXACT matches for your JSON "capacity_type" field 
 */
const CAPACITY_CHIPS = [
  { id: 'Bed Based Capacity', label: 'Beds' },
  { id: 'Room Based Capacity', label: 'Rooms' },
];

export default function FilterChips({ filters, onFiltersChange }: FilterChipsProps) {
  
  const chips: Chip[] = [
    // 1. Sector Filters (stored in filters.populations)
    // ID must match JSON string exactly (e.g., "Women")
    ...SECTOR_CHIPS.map(({ id, label }) => ({
      id: id, 
      label,
      active: filters.populations.includes(id as any),
      onPress: () =>
        onFiltersChange({
          ...filters,
          populations: toggle(filters.populations, id as any),
        }),
    })),
    
    // 2. Capacity Filters (stored in filters.types)
    // ID must match JSON string exactly (e.g., "Bed Based Capacity")
    ...CAPACITY_CHIPS.map(({ id, label }) => ({
      id: id,
      label,
      active: filters.types.includes(id as any),
      onPress: () =>
        onFiltersChange({
          ...filters,
          types: toggle(filters.types, id as any),
        }),
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {chips.map((chip) => (
        <TouchableOpacity
          key={chip.id}
          onPress={chip.onPress}
          activeOpacity={0.8}
          style={[
            styles.chip,
            {
              // Sage Green for Active, White/Beige for Inactive
              backgroundColor: chip.active ? Palette.accentGreen : Palette.card,
              borderColor: chip.active ? Palette.accentGreenDark : '#E0DCD6',
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: chip.active ? '#FFFFFF' : Palette.text },
            ]}
          >
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
    borderRadius: 25,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
});