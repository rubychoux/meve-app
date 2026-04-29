import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types';
import { MainNavigator } from './MainNavigator';
import { EventStackNavigator } from './EventStackNavigator';
import { ScanResultScreen } from '../screens/scanner/ScanResultScreen';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import { ProfileEditScreen } from '../screens/profile/ProfileEditScreen';
import { NotificationSettingsScreen } from '../screens/profile/NotificationSettingsScreen';
import { PrivacyPolicyScreen } from '../screens/profile/PrivacyPolicyScreen';
import { TermsOfServiceScreen } from '../screens/profile/TermsOfServiceScreen';
import { FaceAnalysisScreen } from '../screens/look/FaceAnalysisScreen';
import { FaceAnalysisResultScreen } from '../screens/look/FaceAnalysisResultScreen';
import { TodaysLookScreen } from '../screens/look/TodaysLookScreen';
import { LookDetailScreen } from '../screens/look/LookDetailScreen';
import { InspoLookScreen } from '../screens/look/InspoLookScreen';
import { InspoLookResultScreen } from '../screens/look/InspoLookResultScreen';
import { InspoLookSavedScreen } from '../screens/look/InspoLookSavedScreen';
import { GlamSyncListScreen } from '../screens/community/GlamSyncListScreen';
import { GlamSyncCreateScreen } from '../screens/community/GlamSyncCreateScreen';
import { GlamSyncDetailScreen } from '../screens/community/GlamSyncDetailScreen';
import { LookPollListScreen } from '../screens/community/LookPollListScreen';
import { LookPollCreateScreen } from '../screens/community/LookPollCreateScreen';
import { LookPollDetailScreen } from '../screens/community/LookPollDetailScreen';
import { CreatePostScreen } from '../screens/community/CreatePostScreen';
import { PostDetailScreen } from '../screens/community/PostDetailScreen';
import { RoutineCoachChatScreen } from '../screens/skincare/RoutineCoachChatScreen';
import { NotificationScreen } from '../screens/community/NotificationScreen';

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
      <Stack.Screen name="InspoLookSaved" component={InspoLookSavedScreen} />
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
