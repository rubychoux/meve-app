import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store';
import { supabase } from '../services/supabase';
import { RootStackParamList } from '../types';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainStackNavigator } from './MainStackNavigator';
import { BeautyOnboardingScreen } from '../screens/onboarding/BeautyOnboardingScreen';
import { Colors } from '../constants/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {
    session,
    isLoading,
    beautyOnboardingDone,
    setSession,
    setLoading,
    setBeautyOnboardingDone,
  } = useAuthStore();

  // MEVE-202 — load beauty-onboarding flag whenever the session changes.
  useEffect(() => {
    if (!session) {
      setBeautyOnboardingDone(null);
      return;
    }
    AsyncStorage.getItem('meve_onboarding_done').then((val) => {
      setBeautyOnboardingDone(val === 'true');
    });
  }, [session, setBeautyOnboardingDone]);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ? { accessToken: session.access_token } : null);
      setLoading(false);
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ? { accessToken: session.access_token } : null);
      setLoading(false);
    });

    // Handle Kakao OAuth deep link callback
    const handleDeepLink = async ({ url }: { url: string }) => {
      console.log('[deeplink] received:', url);
      if (url.includes('auth/callback')) {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[deeplink] session:', session?.user?.id, error);
        if (session) {
          useAuthStore.getState().setSession({ accessToken: session.access_token });
          useAuthStore.getState().setUser(session.user as any);
        }
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
    const linkingSub = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  const isAuthenticated = !!session;
  // While we resolve the onboarding flag, treat as loading so we don't flash the wrong screen.
  const onboardingFlagPending = isAuthenticated && beautyOnboardingDone === null;

  if (isLoading || onboardingFlagPending) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: Colors.accent,
          background: Colors.bg,
          card: Colors.surface,
          text: Colors.textPrimary,
          border: Colors.border,
          notification: Colors.accent,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : !beautyOnboardingDone ? (
          <Stack.Screen name="BeautyOnboarding" component={BeautyOnboardingScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainStackNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
