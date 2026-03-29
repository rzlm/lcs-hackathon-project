import {
  Camera,
  Map,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TORONTO_CENTER } from '@/hooks/use-location';
import type { Service } from '@/types/service';
import { MARKER_HEX, scoreToColor } from '@/utils/scoring';

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
    <View style={styles.container}>
      <Map
        style={[styles.map, style]}
        mapStyle={CARTO_LIGHT}
>

        <Camera
          initialViewState={{
            center: [TORONTO_CENTER.longitude, TORONTO_CENTER.latitude],
            zoom: 12,
          }}
        />

        <UserLocation />

        {services
          .filter((s): s is typeof s & { latitude: number; longitude: number } =>
            s.latitude != null && s.longitude != null,
          )
          .map((service) => {
            const color = MARKER_HEX[scoreToColor(service.availability_score)];
            const selected = service.id === selectedId;
            const size = selected ? 24 : 18;

            return (
              <Marker
                key={`marker-${service.id}`}
                id={service.id}
                coordinate={[service.longitude, service.latitude]}
                lngLat={[service.longitude, service.latitude]}
                anchor={{ x: 0.5, y: selected ? 1.0 : 0.5 } as any}
                onPress={() => onMarkerPress(service)}>
                <View style={styles.markerWrapper}>
                  {selected && (
                    <View style={styles.callout}>
                      <Text style={styles.calloutText} numberOfLines={1}>
                        {service.name}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.markerContainer,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: color,
                        borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.8)',
                        borderWidth: selected ? 3 : 2,
                        zIndex: selected ? 99 : 1,
                      },
                    ]}>
                    {selected && (
                      <View style={[styles.pulse, { borderColor: color }]} />
                    )}
                  </View>
                </View>
              </Marker>
            );
          })}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  markerWrapper: { alignItems: 'center' },
  callout: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
    maxWidth: 160,
    borderWidth: 1.5,
    borderColor: '#2D5A27',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  calloutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  markerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 10,
  },
  pulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    opacity: 0.4,
  },
});
