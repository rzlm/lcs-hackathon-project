import { useLocalSearchParams, Stack } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { useServices } from '@/hooks/use-services';
import { EMPTY_FILTERS } from '@/types/service';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const { services, loading } = useServices(EMPTY_FILTERS);
  const service = services.find((s) => s.id === id);

  if (!service) return <View style={styles.center}><Text>Shelter Not Found</Text></View>;

  const isLive = service.availability_label !== 'unknown';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Shelter Details', headerShown: true }} />
      <ScrollView>
        {/* Shelter Image */}
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
                    <View style={[styles.statusBadge, { backgroundColor: service.availability_label === 'available' ? '#e8f5e9' : '#fff3e0' }]}>
                        <Text style={{ color: service.availability_label === 'available' ? '#2e7d32' : '#ef6c00', fontWeight: 'bold' }}>
                            LIVE FORECAST
                        </Text>
                    </View>
                )}
            </View>

            <View style={[styles.predictionCard, isLive ? styles.liveCard : styles.offlineCard]}>
                <Text style={styles.cardLabel}>{isLive ? "AI PREDICTED BEDS" : "STATUS"}</Text>
                {loading ? (
                    <ActivityIndicator size="small" color="#666" />
                ) : (
                    <Text style={styles.mainInfo}>
                        {isLive ? `~${service.predicted_count} Beds Available` : "Connect to Wi-Fi for Live Forecast"}
                    </Text>
                )}
                <Text style={styles.disclaimer}>
                    {isLive ? "Based on real-time ML model" : "Showing historical capacity"}
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Facility Details</Text>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Organization</Text>
                    <Text style={styles.detailValue}>{service.name}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Sector</Text>
                    <Text style={styles.detailValue}>{service.type}</Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroImage: { width: '100%', height: 200 },
  content: { padding: Spacing.four },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  address: { fontSize: 16, color: '#666', marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  typeBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  typeText: { fontSize: 12, fontWeight: '600', color: '#444' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  predictionCard: { marginVertical: 20, padding: 20, borderRadius: 12, borderWidth: 1 },
  liveCard: { backgroundColor: '#f1f8e9', borderColor: '#c8e6c9' },
  offlineCard: { backgroundColor: '#fafafa', borderColor: '#eee' },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#888', marginBottom: 8 },
  mainInfo: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  disclaimer: { fontSize: 12, color: '#999', marginTop: 6 },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15, color: '#1a1a1a' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailLabel: { color: '#888', fontWeight: '500' },
  detailValue: { color: '#333', fontWeight: '600', width: '60%', textAlign: 'right' }
});