import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { ensureRoutineNotificationsMigrated } from './src/services/routineNotifications';
import { initAnalytics } from './src/services/analytics';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  useEffect(() => {
    initAnalytics();
    void ensureRoutineNotificationsMigrated();
  }, []);

  const [fontsLoaded] = useFonts({
    NanumSquareRoundL: require('./assets/fonts/NanumSquareRoundL.ttf'),
    NanumSquareRoundR: require('./assets/fonts/NanumSquareRoundR.ttf'),
    NanumSquareRoundB: require('./assets/fonts/NanumSquareRoundB.ttf'),
    NanumSquareRoundEB: require('./assets/fonts/NanumSquareRoundEB.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <RootNavigator />
    </>
  );
}
