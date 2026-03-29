import { useRouter } from 'expo-router';
import React, { useCallback, useState, useMemo } from 'react';
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

export default function MapScreen() {
  const router = useRouter();
  const { location } = useLocation();

  const [filters, setFilters] = useState<ServiceFilters>(EMPTY_FILTERS);
  const [sheetState, setSheetState] = useState<SheetState>('peek');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { services: rawServices } = useServices(filters, location);

  // --- REPAIRED FILTER LOGIC ---
  const filteredServices = useMemo(() => {
    if (!rawServices) return [];

    return rawServices.filter((s: any) => {
      // 1. Search (Name/Address)
      const searchStr = (filters.query || '').toLowerCase().trim();
      const matchesSearch = !searchStr || 
        s.name?.toLowerCase().includes(searchStr) || 
        s.address_street?.toLowerCase().includes(searchStr);
      
      // 2. Sector Match (Women, Youth, etc.)
      // Matches against s.type because that's where the hook puts it
      const matchesSector = filters.populations.length === 0 || 
        filters.populations.some(p => s.type === p);

      // 3. Capacity Match (Beds vs Rooms)
      // Matches against the newly added s.capacity_type
      const matchesType = filters.types.length === 0 || 
        filters.types.some(t => s.capacity_type === t);

      return matchesSearch && matchesSector && matchesType;
    });
  }, [rawServices, filters]);

  const handleFiltersChange = useCallback((next: ServiceFilters) => {
    setFilters(next);
  }, []);

  const handleQueryChange = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, query }));
  }, []);

  const handleMarkerPress = useCallback((service: Service) => {
    setSelectedId(service.id);
    setSheetState('half');
  }, []);

  const handleServicePress = useCallback((service: Service) => {
    setSelectedId(service.id);
    router.push(`/service/${service.id}`);
  }, [router]);

  return (
    <View style={[styles.screen, { backgroundColor: Palette.background }]}>
      <MapView
        services={filteredServices}
        selectedId={selectedId}
        onMarkerPress={handleMarkerPress}
        style={StyleSheet.absoluteFill}
      />

      <ServiceListSheet
        services={filteredServices}
        selectedId={selectedId}
        onServicePress={handleServicePress}
        sheetState={sheetState}
        onSheetStateChange={setSheetState}
      />

      {sheetState === 'peek' && (
        <TouchableOpacity
          onPress={() => setSheetState('half')}
          style={styles.listBtn}
          activeOpacity={0.85}>
          <Text style={styles.listBtnText}>≡  List</Text>
        </TouchableOpacity>
      )}

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
  screen: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  controls: { marginTop: Spacing.two, marginHorizontal: Spacing.three, gap: Spacing.two },
  listBtn: {
    position: 'absolute',
    bottom: 110,
    right: Spacing.three,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 30,
    backgroundColor: Palette.card,
    borderColor: Palette.accentGreen,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 15,
  },
  listBtnText: { fontSize: 16, fontWeight: '700', color: Palette.text },
});