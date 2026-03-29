import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      {/* Top section: header + search + filters */}
      <SafeAreaView edges={['top']} style={styles.topSection}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoArea}>
            <Image
              source={require('@/assets/images/havennow.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>
              <Text style={styles.logoHaven}>Haven</Text>
              <Text style={styles.logoNow}>Now</Text>
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL('tel:211')}
              activeOpacity={0.85}>
              <Text style={styles.callBtnText}>📞 211</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search + Filters */}
        <View style={styles.controls}>
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

      {/* Map fills remaining space */}
      <View style={styles.mapContainer}>
        <MapView
          services={services}
          selectedId={selectedId}
          onMarkerPress={handleMarkerPress}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Bottom sheet */}
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

  // Top section
  topSection: { backgroundColor: Palette.background, zIndex: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  logoArea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logoImage: {
    width: 34,
    height: 34,
  },
  logoText: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  logoHaven: { color: '#B8832A' },
  logoNow: { color: Palette.accentGreen },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF50' },
  liveText: { fontSize: 12, fontWeight: '600', color: Palette.text },
  callBtn: {
    backgroundColor: '#C0392B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#C0392B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  callBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  controls: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  loadingToast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  loadingText: { color: '#FFF', fontSize: 10, fontWeight: '600' },

  // Map
  mapContainer: { flex: 1 },

  // List button
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
