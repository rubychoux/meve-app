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
        style={[styles.tab, mode === 'skin' && styles.tabActive]}
        onPress={() => setMode('skin')}
        activeOpacity={0.85}
      >
        <Text style={[styles.tabText, mode === 'skin' && styles.tabTextActive]}>
          SKIN
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, mode === 'look' && styles.tabActive]}
        onPress={() => setMode('look')}
        activeOpacity={0.85}
      >
        <Text style={[styles.tabText, mode === 'look' && styles.tabTextActive]}>
          LOOK
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45,58,107,0.06)',
    borderRadius: 100,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 100,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#2D3A6B',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  tabText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: '#8E8E93',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#2D3A6B',
  },
});
