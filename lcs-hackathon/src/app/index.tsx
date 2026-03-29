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

  // Pass the 'location' object directly. 
  // Our hook now correctly reads { latitude, longitude } from your useLocation hook.
  const { services: rawServices, loading } = useServices(filters, location);

  const filteredServices = useMemo(() => {
    if (!rawServices) return [];

    // We only need to filter here. 
    // The sorting (Availability > Distance) is handled inside the useServices hook.
    return rawServices.filter((s: Service) => {
      const searchStr = (filters.query || '').toLowerCase().trim();
      
      const matchesSearch = !searchStr || 
        s.name?.toLowerCase().includes(searchStr) || 
        s.address_street?.toLowerCase().includes(searchStr);

      const matchesSector = 
        filters.populations.length === 0 || 
        filters.populations.some(p => s.type === p);

      const matchesType = 
        filters.types.length === 0 || 
        filters.types.some(t => s.capacity_type === t);

      return matchesSearch && matchesSector && matchesType;
    });
  }, [rawServices, filters]);

  const handleMarkerPress = useCallback((service: Service) => {
    setSelectedId(service.id);
    // Open to half-sheet so the user can see the card for the marker they tapped
    setSheetState('half'); 
  }, []);

  return (
    <View style={styles.screen}>
      {/* MAP LAYER */}
      <MapView
        services={filteredServices}
        selectedId={selectedId}
        onMarkerPress={handleMarkerPress}
        style={StyleSheet.absoluteFill}
      />

      {/* SEARCH & FILTERS OVERLAY */}
      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.controls} pointerEvents="box-none">
          <SearchBar 
            value={filters.query} 
            onChangeText={(q) => setFilters(f => ({ ...f, query: q }))} 
          />
          <FilterChips filters={filters} onFiltersChange={setFilters} />
          
          {/* Subtle loading indicator when API is fetching ML data */}
          {loading && (
            <View style={styles.loadingToast}>
              <Text style={styles.loadingText}>Updating live availability...</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* BOTTOM SHEET LIST */}
      <ServiceListSheet
        services={filteredServices}
        selectedId={selectedId}
        onServicePress={(s) => {
          setSelectedId(s.id);
          router.push(`/service/${s.id}`);
        }}
        sheetState={sheetState}
        onSheetStateChange={setSheetState}
      />

      {/* FLOATING LIST BUTTON (Only visible when sheet is collapsed) */}
      {sheetState === 'peek' && (
        <TouchableOpacity
          onPress={() => setSheetState('half')}
          style={styles.listBtn}>
          <Text style={styles.listBtnText}>≡ List</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: Palette.background 
  },
  overlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 20 
  },
  controls: { 
    marginTop: Spacing.two, 
    marginHorizontal: Spacing.three, 
    gap: Spacing.two 
  },
  loadingToast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  listBtn: {
    position: 'absolute',
    bottom: 110, // Sits above the peek area of the sheet
    right: Spacing.three,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 30,
    backgroundColor: Palette.card,
    borderColor: Palette.accentGreen,
    borderWidth: 2,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 15,
  },
  listBtnText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: Palette.text 
  },
});