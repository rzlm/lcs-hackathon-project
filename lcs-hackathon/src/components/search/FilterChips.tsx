import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Palette, Spacing } from '@/constants/theme';
import type { ServiceFilters } from '@/types/service';
import { EMPTY_FILTERS } from '@/types/service';

interface FilterChipsProps {
  filters: ServiceFilters;
  onFiltersChange: (filters: ServiceFilters) => void;
}

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

const SECTOR_CHIPS = [
  { id: 'Men', label: 'Men' },
  { id: 'Women', label: 'Women' },
  { id: 'Youth', label: 'Youth' },
  { id: 'Families', label: 'Families' },
  { id: 'Mixed Adult', label: 'Mixed Adult' },
];

const CAPACITY_CHIPS = [
  { id: 'Bed Based Capacity', label: '🛏 Beds' },
  { id: 'Room Based Capacity', label: '🍽' },
];

export default function FilterChips({ filters, onFiltersChange }: FilterChipsProps) {
  const allActive = filters.populations.length === 0 && filters.types.length === 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {/* All chip */}
      <TouchableOpacity
        onPress={() => onFiltersChange(EMPTY_FILTERS)}
        activeOpacity={0.8}
        style={[styles.allChip, { backgroundColor: allActive ? Palette.accentGreen : '#E3DFD9' }]}
      >
        <Text style={[styles.allChipText, { color: allActive ? '#FFFFFF' : Palette.text }]}>
          All
        </Text>
      </TouchableOpacity>

      {/* Sector chips */}
      {SECTOR_CHIPS.map(({ id, label }) => {
        const active = filters.populations.includes(id as any);
        return (
          <TouchableOpacity
            key={id}
            onPress={() =>
              onFiltersChange({ ...filters, populations: toggle(filters.populations, id as any) })
            }
            activeOpacity={0.8}
            style={[
              styles.sectorChip,
              { backgroundColor: active ? Palette.accentGreen : '#E3DFD9' },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? '#FFFFFF' : Palette.text }]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Capacity chips */}
      {CAPACITY_CHIPS.map(({ id, label }) => {
        const active = filters.types.includes(id as any);
        return (
          <TouchableOpacity
            key={id}
            onPress={() =>
              onFiltersChange({ ...filters, types: toggle(filters.types, id as any) })
            }
            activeOpacity={0.8}
            style={[
              styles.capacityChip,
              {
                backgroundColor: active ? Palette.accentGreen : '#FFFFFF',
                borderColor: active ? Palette.accentGreenDark : '#CCC8C2',
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? '#FFFFFF' : Palette.text }]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    alignItems: 'center',
  },
  allChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectorChip: {
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  capacityChip: {
    borderRadius: 25,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#CCC8C2',
    marginHorizontal: 2,
  },
});
