import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MapView from '@/components/map/MapView';
import FilterChips from '@/components/search/FilterChips';
import SearchBar from '@/components/search/SearchBar';
import ServiceListSheet, { SheetState } from '@/components/services/ServiceListSheet';
import { Palette, Spacing } from '@/constants/theme';
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

  const { services, loading, source } = useServices(filters, location);

  const handleMarkerPress = useCallback((service: Service) => {
    setSelectedId(service.id);
    setSheetState('half');
  }, []);

  return (
    <View style={styles.screen}>
      <MapView
        services={services}
        selectedId={selectedId}
        onMarkerPress={handleMarkerPress}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.controls} pointerEvents="box-none">
          <SearchBar
            value={filters.query}
            onChangeText={(q) => setFilters((f) => ({ ...f, query: q }))}
          />
          <FilterChips filters={filters} onFiltersChange={setFilters} />
          {loading && (
            <View style={styles.loadingToast}>
              <Text style={styles.loadingText}>Updating live availability…</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      <ServiceListSheet
        services={services}
        selectedId={selectedId}
        onServicePress={(s) => {
          setSelectedId(s.id);
          router.push(`/service/${s.id}`);
        }}
        sheetState={sheetState}
        onSheetStateChange={setSheetState}
        loading={loading}
        offlineMode={source === 'csv'}
      />

      {sheetState === 'peek' && (
        <TouchableOpacity
          onPress={() => setSheetState('half')}
          style={styles.listBtn}
          activeOpacity={0.85}>
          <Text style={styles.listBtnText}>≡ List</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.background },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  controls: { marginTop: Spacing.two, marginHorizontal: Spacing.three, gap: Spacing.two },
  loadingToast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  loadingText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 15,
  },
  listBtnText: { fontSize: 16, fontWeight: '700', color: Palette.text },
});
