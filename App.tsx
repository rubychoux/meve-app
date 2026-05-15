import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput, StyleSheet, TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { RootNavigator } from './src/navigation/RootNavigator';
import { supabase } from './src/services/supabase';
import { useBeautyProfile } from './src/stores/beautyProfileStore';
import { useModeStore } from './src/stores/modeStore';

// ─── App-wide NanumSquareRound font ────────────────────────────────────────────
// Map every Text/TextInput's `fontWeight` to the matching NanumSquareRound
// family. Style with explicit `fontFamily` always wins. Patch is idempotent —
// `__nanumPatched` flag prevents double-wrap on Fast Refresh.
function pickNanumFamily(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '300':
    case '200':
    case '100':
    case 'light':
    case 'ultralight':
    case 'thin':
      return 'NanumSquareRoundL';
    case '600':
    case '700':
    case 'bold':
    case 'semibold':
      return 'NanumSquareRoundB';
    case '800':
    case '900':
    case 'heavy':
    case 'black':
      return 'NanumSquareRoundEB';
    default:
      return 'NanumSquareRoundR';
  }
}

function patchTextWithNanum(Component: any) {
  if (!Component || Component.__nanumPatched) return;
  const originalRender = Component.render;
  if (typeof originalRender !== 'function') return;
  Component.render = function patched(this: any, ...args: any[]) {
    const element = originalRender.apply(this, args);
    if (!element || !element.props) return element;
    const flat: TextStyle = StyleSheet.flatten(element.props.style) || {};
    const fontFamily = flat.fontFamily ?? pickNanumFamily(flat.fontWeight);
    return React.cloneElement(element, {
      style: [element.props.style, { fontFamily }],
    });
  };
  Component.__nanumPatched = true;
}

patchTextWithNanum(Text);
patchTextWithNanum(TextInput);

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [fontsLoaded] = useFonts({
    NanumSquareRoundL: require('./assets/fonts/NanumSquareRoundL.ttf'),
    NanumSquareRoundR: require('./assets/fonts/NanumSquareRoundR.ttf'),
    NanumSquareRoundB: require('./assets/fonts/NanumSquareRoundB.ttf'),
    NanumSquareRoundEB: require('./assets/fonts/NanumSquareRoundEB.ttf'),
    // meve v1.5 design system — Pretendard (한글 + UI)
    'Pretendard-Thin':     require('./assets/fonts/Pretendard-Thin.otf'),
    'Pretendard-Light':    require('./assets/fonts/Pretendard-Light.otf'),
    'Pretendard-Regular':  require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium':   require('./assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold':     require('./assets/fonts/Pretendard-Bold.otf'),
    // meve v1.5 design system — Fraunces Italic (영문 디스플레이)
    'Fraunces-LightItalic': require('./assets/fonts/Fraunces_72pt-LightItalic.ttf'),
    'Fraunces-Italic':      require('./assets/fonts/Fraunces_72pt-Italic.ttf'),
  });

  const loadProfile = useBeautyProfile((s) => s.loadProfile);

  useEffect(() => {
    // Initial load (covers cold-start when session is already restored)
    loadProfile();
    // MEVE-249 — restore last-used app mode (SKIN / LOOK).
    useModeStore.getState().loadMode();
    // Re-load on sign-in / sign-out so the store stays in sync with auth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <RootNavigator />
    </>
  );
}
