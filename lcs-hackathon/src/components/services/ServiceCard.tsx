import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SERVICE_TYPE_LABELS } from '@/constants/keywords';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Service } from '@/types/service';
import { formatDistance } from '@/utils/distance';
import { MARKER_HEX, scoreToColor } from '@/utils/scoring';

interface ServiceCardProps {
  service: Service;
  onPress: () => void;
  isSelected?: boolean;
}

export default function ServiceCard({
  service,
  onPress,
  isSelected = false,
}: ServiceCardProps) {
  const theme = useTheme();
  
  const statusColor = MARKER_HEX[scoreToColor(service.availability_score)];
  const distanceLabel = service.distance_m != null ? formatDistance(service.distance_m) : null;

  const getStatusText = () => {
    switch (service.availability_label) {
      case 'available': return 'Space available';
      case 'limited':   return 'Limited space';
      case 'full':      return 'Currently full';
      default:          return 'Status unknown';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? theme.background : '#FDF6E8',
          borderBottomColor: theme.backgroundElement,
          borderLeftColor: isSelected ? '#B8832A' : 'transparent',
          borderLeftWidth: 4,
        },
      ]}>
      
      {/* Stripe is Gray while loading, then snaps to Green/Orange/Red */}
      <View style={[styles.stripe, { backgroundColor: statusColor }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {service.name}
          </Text>
          {distanceLabel && (
            <Text style={[styles.distance, { color: theme.textSecondary }]}>
              {distanceLabel}
            </Text>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
              {SERVICE_TYPE_LABELS[service.type] || service.type}
            </Text>
          </View>
          
          <Text style={[styles.availability, { color: statusColor }]}>
            {getStatusText()}
          </Text>
        </View>

        {service.address_street != null && (
          <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>
            {service.address_street}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
  },
  stripe: {
    width: 6,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  distance: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  availability: {
    fontSize: 13,
    fontWeight: '700',
  },
  address: {
    fontSize: 13,
    marginTop: 2,
  },
});