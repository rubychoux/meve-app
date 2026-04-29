import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { ensureRoutineNotificationsMigrated } from './src/services/routineNotifications';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  useEffect(() => {
    void ensureRoutineNotificationsMigrated();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <RootNavigator />
    </>
  );
}
