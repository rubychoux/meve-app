import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types';
import { MainNavigator } from './MainNavigator';
import { EventStackNavigator } from './EventStackNavigator';
import { ScanResultScreen } from '../screens/scanner/ScanResultScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainNavigator} />
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EventFlow"
        component={EventStackNavigator}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="FaceAnalysis" component={FaceAnalysisScreen} />
      <Stack.Screen name="FaceAnalysisResult" component={FaceAnalysisResultScreen} />
      <Stack.Screen name="TodaysLook" component={TodaysLookScreen} />
      <Stack.Screen name="LookDetail" component={LookDetailScreen} />
      <Stack.Screen name="InspoLook" component={InspoLookScreen} />
      <Stack.Screen name="InspoLookResult" component={InspoLookResultScreen} />
      <Stack.Screen name="GlamSyncList" component={GlamSyncListScreen} />
      <Stack.Screen name="GlamSyncCreate" component={GlamSyncCreateScreen} />
      <Stack.Screen name="GlamSyncDetail" component={GlamSyncDetailScreen} />
      <Stack.Screen name="LookPollList" component={LookPollListScreen} />
      <Stack.Screen name="LookPollCreate" component={LookPollCreateScreen} />
      <Stack.Screen name="LookPollDetail" component={LookPollDetailScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="RoutineCoachChat" component={RoutineCoachChatScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
    </Stack.Navigator>
  );
}
