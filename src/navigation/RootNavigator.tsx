import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../store';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { RootStackParamList } from '../types';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainStackNavigator } from './MainStackNavigator';
import { Colors } from '../constants/theme';
import { hydratePremiumFromLocalStorage, refreshPremiumFromSupabase } from '../services/premium';
import { identifyUser, trackOnboardingCompletedOnce } from '../services/analytics';

const Stack =
  Platform.OS === 'web'
    ? createStackNavigator<RootStackParamList>()
    : createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, isLoading, setSession, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session ? { accessToken: session.access_token } : null);
        setLoading(false);
        if (session) {
          identifyUser(session.user?.id);
          void trackOnboardingCompletedOnce({ auth_provider: session.user?.app_metadata?.provider });
          refreshPremiumFromSupabase();
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session ? { accessToken: session.access_token } : null);
      setLoading(false);
      if (session) {
        identifyUser(session.user?.id);
        void trackOnboardingCompletedOnce({ auth_provider: session.user?.app_metadata?.provider });
        refreshPremiumFromSupabase();
      }
    });

    hydratePremiumFromLocalStorage();

    // Handle Kakao OAuth deep link callback
    const handleDeepLink = async ({ url }: { url: string }) => {
      console.log('[deeplink] received:', url);
      if (url.includes('auth/callback')) {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[deeplink] session:', session?.user?.id, error);
        if (session) {
          useAuthStore.getState().setSession({ accessToken: session.access_token });
          useAuthStore.getState().setUser(session.user as any);
          identifyUser(session.user?.id);
          void trackOnboardingCompletedOnce({ auth_provider: session.user?.app_metadata?.provider });
          refreshPremiumFromSupabase();
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const isAuthenticated = !!session;

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
        ) : (
          <Stack.Screen name="Main" component={MainStackNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
