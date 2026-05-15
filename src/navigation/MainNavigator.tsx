// MEVE — v1.5 tab bar v3: 홈 / SKIN / 스캔 / LOOK / eve.
// MyPage + Meve relocated to MainStack (accessible via Home top icons).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from '../types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { SkincareScreen } from '../screens/skincare/SkincareScreen';
import { ScanScreen } from '../screens/scan/ScanScreen';
import { LookScreen } from '../screens/look/LookScreen';
import { CommunityStackNavigator } from './CommunityStackNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<
  string,
  { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }
> = {
  Home:      { focused: 'home',           unfocused: 'home-outline' },
  Skincare:  { focused: 'water',          unfocused: 'water-outline' },
  Scan:      { focused: 'scan',           unfocused: 'scan-outline' },
  Look:      { focused: 'color-palette',  unfocused: 'color-palette-outline' },
  Community: { focused: 'heart',          unfocused: 'heart-outline' },
};

const LABELS: Record<string, string> = {
  Home: '홈',
  Skincare: 'SKIN',
  Scan: '스캔',
  Look: 'LOOK',
  Community: 'eve',
};

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          const set = ICONS[route.name];
          if (!set) return null;
          // Center "스캔" tab gets a slightly larger icon (26 vs 22).
          const size = route.name === 'Scan' ? 26 : 22;
          return (
            <Ionicons
              name={focused ? set.focused : set.unfocused}
              size={size}
              color={color}
            />
          );
        },
        tabBarLabel: LABELS[route.name],
        tabBarActiveTintColor: '#2D3A6B',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FBF5F6',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(26,26,31,0.08)',
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: 'Pretendard-Medium',
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Skincare" component={SkincareScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Look" component={LookScreen} />
      <Tab.Screen name="Community" component={CommunityStackNavigator} />
    </Tab.Navigator>
  );
}
