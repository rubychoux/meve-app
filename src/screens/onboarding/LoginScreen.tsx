/**
 * LoginScreen — meve v1.5 디자인.
 *
 * SignatureWashBg + email/password fields with focus state + GradientPill CTA.
 * KeyboardAvoidingView로 키보드 올라올 때 CTA가 같이 올라옴.
 */

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackParamList } from '../../types';
import { colors, spacing } from '../../theme';
import { GradientPill, ShimmerDot, SignatureWashBg } from '../../components/signature';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store';

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'Login'>;
type FieldName = 'email' | 'password';

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { setSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<FieldName | null>(null);

  const isValid = email.includes('@') && password.length >= 6;
  const ctaDisabled = !isValid || loading;

  const handleLogin = async () => {
    if (ctaDisabled) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해 주세요.');
        return;
      }
      if (data.session) {
        setSession({ accessToken: data.session.access_token });
        // RootNavigator가 isAuthenticated = true 감지 → Main으로 자동 전환
      }
    } catch {
      Alert.alert('오류', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('준비 중', '비밀번호 찾기 기능은 곧 지원될 예정이에요.');
  };

  const inputStyle = (field: FieldName) => [
    styles.input,
    focused === field && styles.inputFocused,
  ];

  return (
    <SignatureWashBg variant="soft">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>
            {/* Back */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={24} color={colors.mysticNavy} />
            </TouchableOpacity>

            {/* Title */}
            <Text style={styles.title}>로그인</Text>

            {/* Fields */}
            <View style={styles.fields}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  style={inputStyle('email')}
                  placeholder="example@email.com"
                  placeholderTextColor="rgba(26,26,31,0.3)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput
                  style={inputStyle('password')}
                  placeholder="비밀번호를 입력해 주세요"
                  placeholderTextColor="rgba(26,26,31,0.3)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  hitSlop={8}
                  style={styles.forgotPasswordWrap}
                >
                  <Text style={styles.forgotPassword}>비밀번호 찾기</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Spacer pushes CTA to bottom */}
            <View style={{ flex: 1 }} />

            {/* CTA */}
            <GradientPill
              label={loading ? '로그인 중...' : '로그인'}
              onPress={handleLogin}
              size="lg"
              fullWidth
              iconRight={null}
              disabled={ctaDisabled}
              style={ctaDisabled ? { opacity: 0.45 } : undefined}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Scattered glitter (outside KAV so they don't shift with keyboard) */}
        <ShimmerDot top="10%"    left="18%"  size={2} delay={0}    duration={4000} />
        <ShimmerDot top="22%"    right="14%" size={3} delay={1500} duration={5000} />
        <ShimmerDot top="38%"    left="8%"   size={1} delay={2500} duration={3500} />
        <ShimmerDot top="55%"    right="22%" size={2} delay={800}  duration={4500} />
        <ShimmerDot bottom="22%" left="12%"  size={3} delay={2000} duration={5000} />
        <ShimmerDot bottom="14%" right="18%" size={1} delay={3500} duration={3500} />
      </SafeAreaView>
    </SignatureWashBg>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  backBtn: {
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  title: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.7,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  fields: {
    gap: spacing.lg,
  },
  fieldGroup: {
    // label and input gap handled by label's marginBottom (6)
  },
  label: {
    marginBottom: 6,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(26,26,31,0.5)',
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(45,58,107,0.15)',
    height: 52,
    paddingHorizontal: 16,
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    lineHeight: 20,
    color: '#1A1A1F',
    fontWeight: '400',
  },
  inputFocused: {
    borderWidth: 1,
    borderColor: 'rgba(45,58,107,0.5)',
  },
  forgotPasswordWrap: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPassword: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(45,58,107,0.6)',
  },
});
