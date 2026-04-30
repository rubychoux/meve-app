import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { MainTabParamList } from '../types';
import { Typography } from '../constants/theme';
import { HomeScreen } from '../screens/home/HomeScreen';
import { AIScanNavigator } from './AIScanNavigator';
import { LookScreen } from '../screens/look/LookScreen';
import { CommunityStackNavigator } from './CommunityStackNavigator';
import { MyPageScreen } from '../screens/mypage/MyPageScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

// NOTE: tab-*-active.png variants do not exist yet. Once added, swap the
// `active` entries below to point at the *-active.png files.
const tabIcons: Record<
  string,
  { active: ImageSourcePropType; inactive: ImageSourcePropType }
> = {
  Home: {
    active: require('../../assets/icons/tab-home.png'),
    inactive: require('../../assets/icons/tab-home.png'),
  },
  Skin: {
    active: require('../../assets/icons/tab-skin.png'),
    inactive: require('../../assets/icons/tab-skin.png'),
  },
  Look: {
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
  Skin: 'SKIN',
  Look: 'LOOK',
  Community: 'eve',
  MyPage: '마이페이지',
};

function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, tabStyles.blurFallback]} />
      <LinearGradient
        colors={['rgba(249,196,216,0.18)', 'rgba(184,212,240,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={tabStyles.topHairline} />
    </View>
  );
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarBackground: () => <TabBarBackground />,
        tabBarIcon: ({ focused }) => {
          const set = tabIcons[route.name];
          if (!set) return null;
          return (
            <Image
              source={focused ? set.active : set.inactive}
              style={tabStyles.icon}
            />
          );
        },
        tabBarLabel: labels[route.name],
        tabBarActiveTintColor: '#FF6B9D',
        tabBarInactiveTintColor: '#C0C0CC',
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 84,
          paddingBottom: 20,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          ...Typography.caption,
          fontFamily: 'NanumSquareRoundB',
          fontSize: 10,
          marginTop: 9,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Skin" component={AIScanNavigator} />
      <Tab.Screen name="Look" component={LookScreen} />
      <Tab.Screen name="Community" component={CommunityStackNavigator} />
      <Tab.Screen name="MyPage" component={MyPageScreen} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  blurFallback: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  icon: {
    width: 96,
    height: 96,
    resizeMode: 'contain',
  },
});
