// Glassy gradient bubble with a centered Ionicon — 3D-ish illustration substitute.
// Used to replace flat icons / emojis in Home tab cards and the avatar slot.
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MEVE_GRADIENT_SIMPLE } from '../../constants/theme';

interface BubbleIconProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  iconSize?: number;
  iconColor?: string;
  colors?: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle | ViewStyle[];
}

export function BubbleIcon({
  icon,
  size = 44,
  iconSize,
  iconColor = '#FFFFFF',
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
}: BubbleIconProps) {
  const finalIconSize = iconSize ?? Math.round(size * 0.5);
  const gradientColors = colors ?? MEVE_GRADIENT_SIMPLE.colors;
  const radius = size / 2;
  // Highlight blob at the top-left, ~30% diameter
  const blob = Math.round(size * 0.32);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        styles.shadow,
        style,
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={start}
          end={end}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Top-left highlight blob — fakes the puffy specular highlight */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.12,
            left: size * 0.14,
            width: blob,
            height: blob,
            borderRadius: blob,
            backgroundColor: 'rgba(255,255,255,0.45)',
          }}
        />
        {/* Rim — slightly brighter on top to read as "lit from above" */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: radius,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.5)',
            borderTopColor: 'rgba(255,255,255,0.85)',
          }}
        />
        <View style={styles.center}>
          <Ionicons name={icon} size={finalIconSize} color={iconColor} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#F2A7C3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
