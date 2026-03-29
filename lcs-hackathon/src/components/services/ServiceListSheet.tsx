import React, { useEffect, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Service } from '@/types/service';
import ServiceCard from './ServiceCard';

export type SheetState = 'peek' | 'half' | 'full';
const PEEK_HEIGHT = 96;
const SPRING = { damping: 22, stiffness: 220 };

interface ServiceListSheetProps {
  services: Service[];
  selectedId: string | null;
  onServicePress: (service: Service) => void;
  sheetState: SheetState;
  onSheetStateChange: (state: SheetState) => void;
  loading?: boolean;
  offlineMode?: boolean;
}

export default function ServiceListSheet({
  services,
  selectedId,
  onServicePress,
  sheetState,
  onSheetStateChange,
  loading = false,
  offlineMode = false,
}: ServiceListSheetProps) {
  const theme = useTheme();
  const { height: H } = useWindowDimensions();
  const listRef = useRef<FlatList>(null);

  // --- AUTO-SCROLL TO SELECTED ITEM ---
  // Delay scroll until after the sheet spring animation (~350ms) completes
  useEffect(() => {
    if (!selectedId || services.length === 0) return;
    const index = services.findIndex((s) => s.id === selectedId);
    if (index === -1) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    }, 380);
    return () => clearTimeout(timer);
  }, [selectedId, services]);

  const SNAP_PEEK = H - PEEK_HEIGHT;
  const SNAP_HALF = H * 0.52;
  const SNAP_FULL = H * 0.12;

  function stateToSnap(s: SheetState): number {
    if (s === 'peek') return SNAP_PEEK;
    if (s === 'half') return SNAP_HALF;
    return SNAP_FULL;
  }

  function snapToState(y: number): SheetState {
    const dists = [
      { state: 'peek' as SheetState, d: Math.abs(y - SNAP_PEEK) },
      { state: 'half' as SheetState, d: Math.abs(y - SNAP_HALF) },
      { state: 'full' as SheetState, d: Math.abs(y - SNAP_FULL) },
    ];
    return dists.reduce((a, b) => (a.d < b.d ? a : b)).state;
  }

  const translateY = useSharedValue(SNAP_PEEK);
  const gestureStart = useSharedValue(SNAP_PEEK);

  useEffect(() => {
    const snap = stateToSnap(sheetState);
    translateY.value = withSpring(snap, SPRING);
    gestureStart.value = snap;
  }, [sheetState, H]);

  const notifyState = (y: number) => onSheetStateChange(snapToState(y));

  const pan = Gesture.Pan()
    .onStart(() => { gestureStart.value = translateY.value; })
    .onUpdate((e) => {
      translateY.value = Math.max(SNAP_FULL, Math.min(SNAP_PEEK, gestureStart.value + e.translationY));
    })
    .onEnd(() => {
      const nearest = stateToSnap(snapToState(translateY.value));
      translateY.value = withSpring(nearest, SPRING);
      gestureStart.value = nearest;
      runOnJS(notifyState)(nearest);
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const listStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [SNAP_HALF, SNAP_PEEK], [1, 0], 'clamp'),
  }));

  return (
    <Animated.View style={[styles.sheet, { backgroundColor: theme.background, height: H }, sheetStyle]} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <View style={[styles.handleArea, { borderBottomColor: theme.backgroundElement }]} pointerEvents="auto">
          <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.peekRow}>
            <Text style={[styles.count, { color: theme.text }]}>
              {loading
                ? 'Finding places…'
                : services.length === 0
                  ? 'No places nearby'
                  : `${services.length} place${services.length === 1 ? '' : 's'} nearby`}
              {!loading && offlineMode && (
                <Text style={{ color: theme.textSecondary, fontWeight: '400', fontSize: 13 }}>{' '}(offline)</Text>
              )}
            </Text>
            {sheetState !== 'peek' && (
              <TouchableOpacity onPress={() => onSheetStateChange('peek')}>
                <Text style={[styles.collapse, { color: theme.textSecondary }]}>↓</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GestureDetector>

      <Animated.View style={[styles.list, listStyle]} pointerEvents="auto">
        <FlatList
          ref={listRef}
          data={services}
          keyExtractor={(item) => item.id}
          onScrollToIndexFailed={(info) => {
            // Failsafe if list isn't rendered yet
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          }}
          renderItem={({ item }) => (
            <ServiceCard
              service={item}
              onPress={() => onServicePress(item)}
              isSelected={item.id === selectedId}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No places found nearby.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', top: 0, left: 0, right: 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 12 },
  handleArea: { paddingTop: Spacing.two, paddingBottom: Spacing.two, paddingHorizontal: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.two },
  peekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.one },
  count: { fontSize: 15, fontWeight: '600' },
  collapse: { fontSize: 20, fontWeight: '700', paddingHorizontal: Spacing.two },
  list: { flex: 1 },
  listContent: { paddingBottom: 48 },
  empty: { paddingHorizontal: Spacing.four, paddingTop: Spacing.five, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});