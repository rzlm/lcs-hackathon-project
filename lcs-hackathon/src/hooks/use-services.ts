import { useState, useEffect } from 'react';
import type { Service, ServiceFilters } from '@/types/service';
import OFFLINE_SHELTERS from '@/assets/data/shelters.json';

// FIND YOUR IP: 
// Mac: System Settings > Wi-Fi > Details
// Windows: Command Prompt > type 'ipconfig'
const API_BASE_URL = 'http://0.0.0.0:8000'; 

export function useServices(filters: ServiceFilters, location?: any) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getShelterData() {
      setLoading(true);

      // 1. Initial Offline State - MAP ALL NECESSARY FIELDS
      const offlineMapped: Service[] = (OFFLINE_SHELTERS as any[]).map((s) => ({
        id: String(s.id),
        name: s.name,
        address_street: s.address,
        // We map sector to 'type' because your Detail screen uses .type
        type: s.sector, 
        // IMPORTANT: We must include this so the filter works!
        capacity_type: s.capacity_type, 
        availability_label: 'unknown',
        availability_score: 0.5,
        predicted_count: 0,
        latitude: Number(s.lat),
        longitude: Number(s.lng),
        coordinates: { latitude: Number(s.lat), longitude: Number(s.lng) }
      }));

      setServices(offlineMapped);

      // 2. Fetch Live Forecast
      try {
        const sectorParam = filters.populations.length > 0 ? filters.populations[0] : 'all';
        const response = await fetch(`${API_BASE_URL}/forecast?sector=${sectorParam}`);
        const liveData = await response.json();

        if (Array.isArray(liveData)) {
          const merged = offlineMapped.map((offlineItem) => {
            const liveInfo = liveData.find(l => String(l.shelter_id) === offlineItem.id);
            if (liveInfo) {
              return {
                ...offlineItem,
                predicted_count: liveInfo.predicted_beds,
                availability_label: liveInfo.predicted_beds > 2 ? 'available' : 'limited',
                availability_score: liveInfo.predicted_beds > 2 ? 1.0 : 0.4
              };
            }
            return offlineItem;
          });
          setServices(merged);
        }
      } catch (error) {
        console.warn("Could not reach Fast API. Using offline data.");
      } finally {
        setLoading(false);
      }
    }

    getShelterData();
  }, [filters]);

  return { services, loading };
}