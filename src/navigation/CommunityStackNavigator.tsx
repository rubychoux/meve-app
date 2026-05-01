import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommunityStackParamList } from '../types';
import { Colors } from '../constants/theme';
import { CommunityScreen } from '../screens/community/CommunityScreen';
import { CreatePostScreen } from '../screens/community/CreatePostScreen';
import { PostDetailScreen } from '../screens/community/PostDetailScreen';
import { NotificationScreen } from '../screens/community/NotificationScreen';

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
        name="Community"
        component={CommunityScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ title: '글쓰기' }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{ title: '게시글' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{ title: '알림' }}
      />
    </Stack.Navigator>
  );
}
