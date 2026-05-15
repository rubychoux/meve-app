/**
 * AuthGateScreen — meve v1.5 디자인.
 *
 * SignatureWashBg variant="soft" + 중앙 "meve" letter-stagger + 3 auth buttons.
 */

import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Easing,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { OnboardingStackParamList } from '../../types';
import { colors, spacing } from '../../theme';
import { SignatureWashBg, ShimmerDot } from '../../components/signature';
import { supabase } from '../../services/supabase';

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'AuthGate'>;

const MEVE_LETTERS = ['m', 'e', 'v', 'e'] as const;

export function AuthGateScreen() {
  const navigation = useNavigation<Nav>();

  // Letter stagger animation (same pattern as Welcome slide)
  const letterOps = useRef(MEVE_LETTERS.map(() => new Animated.Value(0))).current;
  const letterTYs = useRef(MEVE_LETTERS.map(() => new Animated.Value(12))).current;
  const breatheScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const entrance = MEVE_LETTERS.map((_, i) =>
      Animated.parallel([
        Animated.timing(letterOps[i], {
          toValue: 1,
          duration: 600,
          delay: i * 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(letterTYs[i], {
          toValue: 0,
          duration: 600,
          delay: i * 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.parallel(entrance).start();

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheScale, {
          toValue: 1.02,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const breatheTimer = setTimeout(() => breatheLoop.start(), 1960);

    return () => {
      clearTimeout(breatheTimer);
      breatheLoop.stop();
    };
  }, [letterOps, letterTYs, breatheScale]);

  const handleKakao = async () => {
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: { redirectTo: redirectUrl, scopes: 'profile_nickname' },
      });
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('오류', '카카오 로그인에 실패했어요. 다시 시도해 주세요.');
      console.error('[kakao] login error:', e);
    }
  };

  const handleApple = async () => {
    Alert.alert('준비 중', 'Apple 로그인은 곧 지원될 예정이에요.');
  };

  return (
    <SignatureWashBg variant="soft">
      <SafeAreaView style={styles.safe}>
        {/* Back button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(45,58,107,0.6)" />
          </TouchableOpacity>
        </View>

        {/* Center: logo + subtitle */}
        <View style={styles.center}>
          <Animated.View
            style={[styles.lettersRow, { transform: [{ scale: breatheScale }] }]}
          >
            {MEVE_LETTERS.map((letter, i) => (
              <Animated.Text
                key={i}
                style={[
                  styles.logo,
                  {
                    opacity: letterOps[i],
                    transform: [{ translateY: letterTYs[i] }],
                  },
                ]}
              >
                {letter}
              </Animated.Text>
            ))}
          </Animated.View>
          <Text style={styles.subtitle}>나다운 아름다움, 가장 정확하게</Text>
        </View>

        {/* Bottom: buttons + footer text */}
        <View style={styles.bottom}>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.kakaoBtn}
              onPress={handleKakao}
              activeOpacity={0.85}
            >
              <View style={styles.iconLeft}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#1A1A1F" />
              </View>
              <Text style={styles.kakaoBtnText}>카카오로 시작하기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.appleBtn}
              onPress={handleApple}
              activeOpacity={0.85}
            >
              <View style={styles.iconLeft}>
                <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.appleBtnText}>Apple로 시작하기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emailBtn}
              onPress={() => navigation.navigate('EmailSignUp')}
              activeOpacity={0.85}
            >
              <Text style={styles.emailBtnText}>이메일로 가입하기</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
            hitSlop={8}
          >
            <Text style={styles.loginLinkText}>이미 계정이 있어요 →</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            시작하기를 누르면 이용약관 및{'\n'}개인정보처리방침에 동의하는 것으로 간주합니다.
          </Text>
        </View>

        {/* Scattered glitter (8 dots) */}
        <ShimmerDot top="8%"     left="14%"  size={2} delay={0}    duration={4000} />
        <ShimmerDot top="12%"    right="20%" size={3} delay={1200} duration={5000} />
        <ShimmerDot top="28%"    left="8%"   size={2} delay={2500} duration={3500} />
        <ShimmerDot top="38%"    right="12%" size={1} delay={800}  duration={4500} />
        <ShimmerDot top="55%"    left="18%"  size={3} delay={3000} duration={5500} />
        <ShimmerDot top="62%"    right="24%" size={2} delay={1500} duration={4000} />
        <ShimmerDot bottom="20%" left="10%"  size={2} delay={2000} duration={4500} />
        <ShimmerDot bottom="14%" right="14%" size={1} delay={3500} duration={3500} />
      </SafeAreaView>
    </SignatureWashBg>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  logo: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -2,
    color: colors.mysticNavy,
    fontWeight: '300',
  },
  subtitle: {
    marginTop: spacing.lg,
    fontFamily: 'Pretendard-Light',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(26,26,31,0.6)',
    fontWeight: '300',
    textAlign: 'center',
  },
  bottom: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  buttons: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  // Common button base via individual styles below.
  iconLeft: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  kakaoBtn: {
    height: 52,
    borderRadius: 100,
    backgroundColor: '#FEE500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoBtnText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  appleBtn: {
    height: 52,
    borderRadius: 100,
    backgroundColor: '#1A1A1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleBtnText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emailBtn: {
    height: 52,
    borderRadius: 100,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: 'rgba(45,58,107,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailBtnText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    lineHeight: 20,
    color: colors.mysticNavy,
    fontWeight: '500',
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  loginLinkText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: colors.mysticNavy,
    fontWeight: '500',
  },
  legal: {
    marginTop: 12,
    fontFamily: 'Pretendard-Light',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(26,26,31,0.45)',
    fontWeight: '300',
    textAlign: 'center',
  },
});
