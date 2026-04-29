import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommunityStackParamList } from '../types';
import { Colors } from '../constants/theme';
import { CommunityFeedScreen } from '../screens/community/CommunityFeedScreen';
import { CreatePostScreen } from '../screens/community/CreatePostScreen';

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export function CommunityStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTintColor: Colors.textPrimary,
        headerStyle: { backgroundColor: Colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="CommunityFeed"
        component={CommunityFeedScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ title: '글쓰기' }}
      />
    </Stack.Navigator>
  );
}
