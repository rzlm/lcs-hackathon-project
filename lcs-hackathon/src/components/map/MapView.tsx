import {
  Camera,
  Map,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { TORONTO_CENTER } from '@/hooks/use-location';
import type { Service } from '@/types/service';
import { MARKER_HEX, scoreToColor } from '@/utils/scoring';

// CARTO free basemap — no API key required
const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

interface MapViewProps {
  services: Service[];
  selectedId: string | null;
  onMarkerPress: (service: Service) => void;
  style?: object;
}

export default function MapView({
  services,
  selectedId,
  onMarkerPress,
  style,
}: MapViewProps) {
  return (
    <Map
      style={[styles.map, style]}
      mapStyle={CARTO_LIGHT}>
      <Camera
        initialViewState={{
          center: [TORONTO_CENTER.longitude, TORONTO_CENTER.latitude],
          zoom: 13,
        }}
      />

      <UserLocation />

      {services.map((service) => {
        const color = MARKER_HEX[scoreToColor(service.availability_score)];
        const selected = service.id === selectedId;
        const size = selected ? 22 : 16;
        return (
          <Marker
            key={service.id}
            lngLat={[service.longitude, service.latitude]}>
            <View
              onTouchEnd={() => onMarkerPress(service)}
              style={[
                styles.marker,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: color,
                  borderWidth: selected ? 3 : 2,
                  borderColor: selected ? '#fff' : 'rgba(255,255,255,0.85)',
                },
              ]}>
              {selected && (
                <View style={[styles.pulse, { borderColor: color }]} />
              )}
            </View>
          </Marker>
        );
      })}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  marker: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  pulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    opacity: 0.35,
  },
});
