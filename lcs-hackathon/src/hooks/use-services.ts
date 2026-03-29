import { useState, useEffect } from 'react';
import type { Service, ServiceFilters } from '@/types/service';
import OFFLINE_SHELTERS from '@/assets/data/shelters.json';

// Import your distance functions
import { haversineDistance } from '@/utils/distance';

const API_BASE_URL = 'https://lcs2026-fastapi.onrender.com'; 

export function useServices(filters: ServiceFilters, location?: { latitude: number; longitude: number }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getShelterData() {
      setLoading(true);

      // 1. Map Offline Data & Calculate Distances
      const offlineMapped: Service[] = (OFFLINE_SHELTERS as any[]).map((s) => {
        const sLat = parseFloat(s.lat);
        const sLng = parseFloat(s.lng);
        
        // Match your specific hook structure: location.latitude (no .coords)
        let dist = 0;
        if (location && location.latitude && location.longitude) {
          dist = haversineDistance(
            location.latitude,
            location.longitude,
            !isNaN(sLat) ? sLat : 43.6532,
            !isNaN(sLng) ? sLng : -79.3832
          );
        }

        return {
          id: String(s.id),
          name: s.name || 'Unknown Shelter',
          address_street: s.address || 'Address not available',
          type: s.sector || 'General',
          capacity_type: s.capacity_type || 'Unknown',
          availability_label: 'unknown',
          availability_score: 0.5, 
          predicted_count: 0,
          distance_m: dist, // This should now be a real number!
          latitude: !isNaN(sLat) ? sLat : 43.6532, 
          longitude: !isNaN(sLng) ? sLng : -79.3832,
          coordinates: {
            latitude: !isNaN(sLat) ? sLat : 43.6532,
            longitude: !isNaN(sLng) ? sLng : -79.3832,
          },
        };
      });

      // Initial Sort: Proximate shelters first
      setServices([...offlineMapped].sort((a, b) => a.distance_m - b.distance_m));

      // 2. Fetch Live ML Data
      try {
        const sectorParam = filters.populations.length > 0 ? filters.populations[0] : 'all';
        const response = await fetch(`${API_BASE_URL}/forecast?sector=${sectorParam}`);
        const liveData = await response.json();

        if (Array.isArray(liveData)) {
          const merged = offlineMapped.map((offlineItem) => {
            const liveInfo = liveData.find(l => String(l.shelter_id) === offlineItem.id);
            if (liveInfo) {
              const count = liveInfo.predicted_beds;
              return {
                ...offlineItem,
                predicted_count: count,
                availability_label: count > 2 ? 'available' : count > 0 ? 'limited' : 'full',
                availability_score: count > 2 ? 1.0 : count > 0 ? 0.4 : 0.1,
              };
            }
            return offlineItem;
          });

          // Secondary Sort: Group by Availability, then by Distance
          const finalSort = merged.sort((a, b) => {
            if (b.availability_score !== a.availability_score) {
              return b.availability_score - a.availability_score;
            }
            return a.distance_m - b.distance_m;
          });

          setServices(finalSort);
        }
      } catch (error) {
        console.warn("FastAPI Offline: Using distance-sorted offline data.");
      } finally {
        setLoading(false);
      }
    }

    getShelterData();
  }, [filters.populations, filters.types, location?.latitude, location?.longitude]); 

  return { services, loading };
}