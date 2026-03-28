import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SERVICE_TYPE_LABELS } from '@/constants/keywords';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Service } from '@/types/service';
import { formatDistance } from '@/utils/distance';
import { MARKER_HEX, scoreToColor } from '@/utils/scoring';

const AVAILABILITY_TEXT: Record<string, string> = {
  available: 'Space available',
  limited: 'Filling up',
  full: 'Full right now',
  unknown: 'Status unknown',
};

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
  const color = MARKER_HEX[scoreToColor(service.availability_score)];
  const availabilityText =
    service.availability_label != null
      ? AVAILABILITY_TEXT[service.availability_label]
      : 'Status unknown';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? theme.backgroundSelected : theme.background,
          borderBottomColor: theme.backgroundElement,
        },
      ]}>
      {/* Colored availability stripe on left edge */}
      <View style={[styles.stripe, { backgroundColor: color }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {service.name}
          </Text>
          {service.distance_m !== undefined && (
            <Text style={[styles.distance, { color: theme.textSecondary }]}>
              {formatDistance(service.distance_m)}
            </Text>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
              {SERVICE_TYPE_LABELS[service.type]}
            </Text>
          </View>
          <Text style={[styles.availability, { color }]}>{availabilityText}</Text>
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
    minHeight: 76,
  },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.one,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  distance: {
    fontSize: 13,
    marginLeft: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  availability: {
    fontSize: 13,
    fontWeight: '500',
  },
  address: {
    fontSize: 13,
  },
});
