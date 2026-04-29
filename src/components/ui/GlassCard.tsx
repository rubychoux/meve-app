// Frosted-glass surface — BlurView + LinearGradient sheen + soft shadow.
// Used on Home tab cards (calendar, dual SKIN/LOOK, h-scroll, tip).
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'default' | 'dark';
  sheenColors?: readonly [string, string, ...string[]];
  radius?: number;
  padding?: number;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
}

const DEFAULT_SHEEN = [
  'rgba(249,196,216,0.35)',
  'rgba(184,212,240,0.25)',
] as const;

export function GlassCard({
  children,
  intensity = 30,
  tint = 'light',
  sheenColors,
  radius = 20,
  padding = 14,
  style,
  contentStyle,
}: GlassCardProps) {
  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]}>
      <View style={[styles.clip, { borderRadius: radius }]}>
        <BlurView
          intensity={intensity}
          tint={tint}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={sheenColors ?? DEFAULT_SHEEN}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={[styles.inner, { borderRadius: radius, padding }, contentStyle]}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  clip: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  inner: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
});
