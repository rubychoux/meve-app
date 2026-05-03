// MEVE-249 — global SKIN / LOOK mode toggle (used on Home, Scan, Meve, eve, MyPage).
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useModeStore } from '../../stores/modeStore';

export function ModeToggle() {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tab, mode === 'skin' && styles.tabActiveSkin]}
        onPress={() => setMode('skin')}
        activeOpacity={0.85}
      >
        <Text style={[styles.tabText, mode === 'skin' && styles.tabTextActiveSkin]}>
          💙 SKIN
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, mode === 'look' && styles.tabActiveLook]}
        onPress={() => setMode('look')}
        activeOpacity={0.85}
      >
        <Text style={[styles.tabText, mode === 'look' && styles.tabTextActiveLook]}>
          💕 LOOK
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F5',
    borderRadius: 50,
    padding: 3,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 50,
  },
  tabActiveSkin: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#5BA3D9',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  tabActiveLook: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FF6B9D',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A8A9A',
  },
  tabTextActiveSkin: {
    color: '#5BA3D9',
    fontWeight: '700',
  },
  tabTextActiveLook: {
    color: '#FF6B9D',
    fontWeight: '700',
  },
});
