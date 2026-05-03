// MEVE-258 — restored uploaded PNG tab icons. Tab bar is otherwise still
// flat (white, hairline border, no blur/gradient backdrop).
import React from 'react';
import { Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ScanScreen } from '../screens/scan/ScanScreen';
import { MeveScreen } from '../screens/meve/MeveScreen';
import { CommunityStackNavigator } from './CommunityStackNavigator';
import { MyPageScreen } from '../screens/mypage/MyPageScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Scan reuses tab-skin.png; Meve reuses tab-look.png until dedicated icons land.
const TAB_ICONS: Record<
  string,
  { active: ImageSourcePropType; inactive: ImageSourcePropType }
> = {
  Home: {
    active: require('../../assets/icons/tab-home.png'),
    inactive: require('../../assets/icons/tab-home.png'),
  },
  Scan: {
    active: require('../../assets/icons/tab-skin.png'),
    inactive: require('../../assets/icons/tab-skin.png'),
  },
  Meve: {
    active: require('../../assets/icons/tab-look.png'),
    inactive: require('../../assets/icons/tab-look.png'),
  },
  Community: {
    active: require('../../assets/icons/tab-eve.png'),
    inactive: require('../../assets/icons/tab-eve.png'),
  },
  MyPage: {
    active: require('../../assets/icons/tab-mypage.png'),
    inactive: require('../../assets/icons/tab-mypage.png'),
  },
};

const labels: Record<string, string> = {
  Home: '홈',
  Scan: '나',
  Meve: 'meve',
  Community: 'eve',
  MyPage: '마이페이지',
};

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          const set = TAB_ICONS[route.name];
          if (!set) return null;
          return (
            <Image
              source={focused ? set.active : set.inactive}
              style={[tabStyles.icon, { opacity: focused ? 1 : 0.6 }]}
            />
          );
        },
        tabBarLabel: labels[route.name],
        tabBarActiveTintColor: '#5BA3D9',
        tabBarInactiveTintColor: '#C0C0CC',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F5',
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Meve" component={MeveScreen} />
      <Tab.Screen name="Community" component={CommunityStackNavigator} />
      <Tab.Screen name="MyPage" component={MyPageScreen} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  icon: {
    width: 96,
    height: 96,
    resizeMode: 'contain',
  },
});
