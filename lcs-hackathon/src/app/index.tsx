import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MapView from '@/components/map/MapView';
import FilterChips from '@/components/search/FilterChips';
import SearchBar from '@/components/search/SearchBar';
import ServiceListSheet, { SheetState } from '@/components/services/ServiceListSheet';
import { Spacing, Palette } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useServices } from '@/hooks/use-services';
import type { Service, ServiceFilters } from '@/types/service';
import { EMPTY_FILTERS } from '@/types/service';

function hasActiveFilters(f: ServiceFilters): boolean {
  return (
    f.query.length > 0 ||
    f.types.length > 0 ||
    f.populations.length > 0 ||
    f.accessibility.length > 0 ||
    f.openNow ||
    f.hasAvailability
  );
}

export default function MapScreen() {
  const router = useRouter();
  const { location } = useLocation();

  // 1. Updated Filters to match actual Data (Women, Youth, Bed Based, etc.)
  const [filters, setFilters] = useState<ServiceFilters>(EMPTY_FILTERS);
  const [sheetState, setSheetState] = useState<SheetState>('peek');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 2. This hook now triggers the FastAPI fetch whenever 'filters' changes
  const { services, loading } = useServices(filters, location);

  const handleFiltersChange = useCallback(
    (next: ServiceFilters) => {
      setFilters(next);
      if (hasActiveFilters(next)) {
        setSheetState((prev) => (prev === 'peek' ? 'half' : prev));
      }
    },
    [],
  );

  const handleQueryChange = useCallback(
    (query: string) => {
      handleFiltersChange({ ...filters, query });
    },
    [filters, handleFiltersChange],
  );

  const handleMarkerPress = useCallback((service: Service) => {
    setSelectedId(service.id);
    setSheetState('half');
  }, []);

  const handleServicePress = useCallback((service: Service) => {
    setSelectedId(service.id);
    router.push(`/service/${service.id}`);
  }, [router, setSelectedId]);

  return (
    <View style={[styles.screen, { backgroundColor: Palette.background }]}>
      {/* Layer 1: Map (background) - No changes to layout */}
      <MapView
        services={services}
        selectedId={selectedId}
        onMarkerPress={handleMarkerPress}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 2: Sliding service list sheet - Keep original behavior */}
      <ServiceListSheet
        services={services}
        selectedId={selectedId}
        onServicePress={handleServicePress}
        sheetState={sheetState}
        onSheetStateChange={setSheetState}
      />

      {/* Layer 3: Floating "List" button (Sage Green/Beige Aesthetic) */}
      {sheetState === 'peek' && (
        <TouchableOpacity
          onPress={() => setSheetState('half')}
          style={[
            styles.listBtn,
            {
              backgroundColor: Palette.card, 
              borderColor: Palette.accentGreen,
            },
          ]}
          activeOpacity={0.85}>
          {/* Using text instead of black icons for a softer look */}
          <Text style={[styles.listBtnText, { color: Palette.text }]}>≡  List</Text>
        </TouchableOpacity>
      )}

      {/* Layer 4: Floating search + filters (always on top) */}
      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.controls} pointerEvents="box-none">
          <SearchBar 
            value={filters.query} 
            onChangeText={handleQueryChange}
            // Use sage green accent for focus/styling if supported by component
          />
          {/* This component needs updating to show Men/Women/Youth chips */}
          <FilterChips 
            filters={filters} 
            onFiltersChange={handleFiltersChange} 
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  controls: {
    marginTop: Spacing.two,
    marginHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  listBtn: {
    position: 'absolute',
    bottom: 120, // Keep away from tab bar
    right: Spacing.three,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 2,
    // Soft shadow for the "cute" look
    shadowColor: '#8ac28b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 15,
  },
  listBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});