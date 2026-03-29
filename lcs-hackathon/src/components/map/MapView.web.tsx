import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_LIGHT,
      center: [TORONTO_CENTER.longitude, TORONTO_CENTER.latitude],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    // Popup styles
    const style = document.createElement('style');
    style.textContent = `.haven-popup .maplibregl-popup-content{background:#fff;border:1.5px solid #2D5A27;border-radius:8px;padding:6px 10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);}.haven-popup .maplibregl-popup-tip{border-top-color:#2D5A27;}`;
    document.head.appendChild(style);

    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers whenever services or selectedId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const incoming = new Set(services.map((s) => s.id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!incoming.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add or update markers (skip services without coordinates)
    // Remove existing popup
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }

    // Show popup for selected marker
    if (selectedId) {
      const sel = services.find((s) => s.id === selectedId);
      if (sel && sel.latitude != null && sel.longitude != null) {
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
          className: 'haven-popup',
        })
          .setLngLat([sel.longitude, sel.latitude])
          .setHTML(`<span style="font-size:12px;font-weight:700;color:#1A1A1A;white-space:nowrap;">${sel.name}</span>`)
          .addTo(map);
      }
    }

    services.filter((s): s is typeof s & { latitude: number; longitude: number } => s.latitude != null && s.longitude != null).forEach((service) => {
      const color = MARKER_HEX[scoreToColor(service.availability_score)];
      const selected = service.id === selectedId;
      const size = selected ? 22 : 16;

      const existing = markersRef.current.get(service.id);
      if (existing) {
        // Update element style in place
        const el = existing.getElement();
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = '50%';
        el.style.backgroundColor = color;
        el.style.border = selected ? '3px solid #fff' : '2px solid rgba(255,255,255,0.85)';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        return;
      }

      const el = document.createElement('div');
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = selected ? '3px solid #fff' : '2px solid rgba(255,255,255,0.85)';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.transition = 'width 0.15s, height 0.15s';
      el.addEventListener('click', () => onMarkerPress(service));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([service.longitude, service.latitude])
        .addTo(map);

      markersRef.current.set(service.id, marker);
    });
  }, [services, selectedId, onMarkerPress]);

  return (
    <View style={[styles.container, style]}>
      {/* @ts-ignore — div is valid in web context */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
