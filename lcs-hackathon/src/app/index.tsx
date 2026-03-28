import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MapView from '@/components/map/MapView';
import FilterChips from '@/components/search/FilterChips';
import SearchBar from '@/components/search/SearchBar';
import ServiceListSheet, { SheetState } from '@/components/services/ServiceListSheet';
import { Spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useServices } from '@/hooks/use-services';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
  const { location } = useLocation();

  const [filters, setFilters] = useState<ServiceFilters>(EMPTY_FILTERS);
  const [sheetState, setSheetState] = useState<SheetState>('peek');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { services } = useServices(filters, location);

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
    // TODO: router.push(`/service/${service.id}`) once detail screen exists
  }, []);

  return (
    <View style={styles.screen}>
      {/* Layer 1: Map (background) */}
      <MapView
        services={services}
        selectedId={selectedId}
        onMarkerPress={handleMarkerPress}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 2: Sliding service list sheet */}
      <ServiceListSheet
        services={services}
        selectedId={selectedId}
        onServicePress={handleServicePress}
        sheetState={sheetState}
        onSheetStateChange={setSheetState}
      />

      {/* Layer 3: Floating "List" button (only when sheet is peeked) */}
      {sheetState === 'peek' && (
        <TouchableOpacity
          onPress={() => setSheetState('half')}
          style={[
            styles.listBtn,
            {
              backgroundColor: theme.background,
              borderColor: theme.backgroundElement,
            },
          ]}
          activeOpacity={0.85}>
          <Text style={[styles.listBtnText, { color: theme.text }]}>≡  List</Text>
        </TouchableOpacity>
      )}

      {/* Layer 4: Floating search + filters (always on top) */}
      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.controls} pointerEvents="box-none">
          <SearchBar value={filters.query} onChangeText={handleQueryChange} />
          <FilterChips filters={filters} onFiltersChange={handleFiltersChange} />
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
    bottom: 120,
    right: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 15,
  },
  listBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
