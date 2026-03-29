import { useLocalSearchParams, Stack } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { TORONTO_CENTER } from '@/hooks/use-location';
import { useServices } from '@/hooks/use-services';
import { EMPTY_FILTERS } from '@/types/service';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const { services, loading } = useServices(EMPTY_FILTERS, TORONTO_CENTER);
  const service = services.find((s) => s.id === id);

  if (loading && !service) return <View style={styles.center}><ActivityIndicator size="large" color="#2D5A27" /></View>;
  if (!service) return <View style={styles.center}><Text>Shelter Not Found</Text></View>;

  // A score of 0.5 is our 'Unknown/Offline' state. 
  // We only consider it 'Live' if it has a score that isn't 0.5.
  const isLive = service.availability_label !== 'unknown' && service.availability_score !== 0.5;
  const mockAmenities = ["Free Wi-Fi", "Showers", "Laundry", "Pet Friendly", "Storage"];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Shelter Details', headerShown: true }} />
      <ScrollView>
        <Image 
          source={{ uri: `https://picsum.photos/seed/${id}/600/300` }} 
          style={styles.heroImage} 
        />

        <View style={styles.content}>
            <Text style={styles.name}>{service.name}</Text>
            <Text style={styles.address}>{service.address_street}</Text>
            
            <View style={styles.badgeRow}>
                <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{service.type}</Text>
                </View>
                {isLive && (
                    <View style={[styles.statusBadge, { backgroundColor: '#e8f5e9' }]}>
                        <Text style={{ color: '#2e7d32', fontSize: 10, fontWeight: '800' }}>
                            RECENTLY UPDATED
                        </Text>
                    </View>
                )}
            </View>

            <View style={[styles.predictionCard, isLive ? styles.liveCard : styles.offlineCard]}>
                <Text style={styles.cardLabel}>{isLive ? "EXPECTED SPACE" : "CURRENT STATUS"}</Text>
                
                {loading ? (
                    <ActivityIndicator size="small" color="#666" />
                ) : (
                    <View>
                        <Text style={styles.mainInfo}>
                            {isLive 
                              ? `~ ${service.predicted_count ?? 0} beds usually available` 
                              : "Live updates unavailable"}
                        </Text>
                        <Text style={styles.lastUpdated}>
                            {isLive 
                              ? "Updated: 12 minutes ago" 
                              : "Connect to Wi-Fi for live timing"}
                        </Text>
                    </View>
                )}
                
                <Text style={styles.disclaimer}>
                    {isLive 
                      ? "Based on historical patterns and current weather data." 
                      : "We recommend calling ahead if you are offline."}
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Facility Highlights</Text>
                <View style={styles.amenityGrid}>
                    {mockAmenities.map((item) => (
                        <View key={item} style={styles.amenityChip}>
                            <Text style={styles.amenityText}>✓ {item}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Facility Details</Text>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Organization</Text>
                    <Text style={styles.detailValue}>{service.name}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Room Format</Text>
                    <Text style={styles.detailValue}>Bed-based / Dormitory</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Shelter ID</Text>
                    <Text style={styles.detailValue}>#{service.id}</Text>
                </View>
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFE9E1' }, // Beige from your theme
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroImage: { width: '100%', height: 200 },
  content: { padding: Spacing.four },
  name: { fontSize: 24, fontWeight: 'bold', color: '#2C2C2C' },
  address: { fontSize: 16, color: '#60646C', marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  typeBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  typeText: { fontSize: 12, fontWeight: '600', color: '#444', textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  predictionCard: { marginVertical: 20, padding: 20, borderRadius: 16, borderWidth: 1 },
  liveCard: { backgroundColor: '#FFFFFF', borderColor: '#b5e0a6' },
  offlineCard: { backgroundColor: '#FFFFFF', borderColor: '#e0e1e6' },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 8, letterSpacing: 1 },
  mainInfo: { fontSize: 19, fontWeight: '700', color: '#2C2C2C' },
  lastUpdated: { fontSize: 13, color: '#8ac28b', fontWeight: '600', marginTop: 4 },
  disclaimer: { fontSize: 12, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' },
  section: { marginTop: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#2C2C2C' },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e0e1e6' },
  amenityText: { fontSize: 13, color: '#60646C', fontWeight: '500' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  detailLabel: { color: '#60646C', fontWeight: '500' },
  detailValue: { color: '#2C2C2C', fontWeight: '600', width: '60%', textAlign: 'right' }
});