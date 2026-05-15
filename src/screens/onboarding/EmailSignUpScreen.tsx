/**
 * EmailSignUpScreen — meve v1.5 디자인.
 *
 * SignatureWashBg + 3 input fields with focus state + GradientPill CTA.
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

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'EmailSignUp'>;
type FieldName = 'name' | 'email' | 'password';

export function EmailSignUpScreen() {
  const navigation = useNavigation<Nav>();
  const { setSession } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<FieldName | null>(null);

  const isValid = name.trim().length > 0 && email.includes('@') && password.length >= 6;

  const handleSignUp = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() } },
      });

      if (error) {
        if (error.message.toLowerCase().includes('rate')) {
          Alert.alert('잠시 후 다시 시도해 주세요.');
        } else if (error.message.includes('already registered')) {
          Alert.alert('이미 가입된 이메일이에요.', '로그인해 주세요.');
        } else {
          Alert.alert('가입 실패', error.message);
        }
        return;
      }

      if (data.session) {
        // 이메일 확인 비활성화 — 즉시 세션 발급
        const { error: upsertError } = await supabase
          .from('user_profiles')
          .upsert({
            id: data.user!.id,
            display_name: name.trim(),
            onboarding_completed: false,
          });
        console.log('[signup] upsert error:', upsertError);
        setSession({ accessToken: data.session.access_token });
        // RootNavigator가 isAuthenticated = true 감지 → Main으로 자동 전환
      } else if (data.user) {
        // 이메일 확인 ON — OTP 화면으로 이동
        navigation.navigate('OTPVerify', { email: email.trim(), name: name.trim() });
      }
    } catch {
      Alert.alert('오류', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
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
              <Ionicons name="chevron-back" size={20} color="rgba(45,58,107,0.6)" />
            </TouchableOpacity>

            {/* Title */}
            <Text style={styles.title}>이메일로 가입하기</Text>

            {/* Fields */}
            <View style={styles.fields}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>이름</Text>
                <TextInput
                  style={inputStyle('name')}
                  placeholder="이름을 입력해 주세요"
                  placeholderTextColor="rgba(26,26,31,0.35)"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  style={inputStyle('email')}
                  placeholder="example@email.com"
                  placeholderTextColor="rgba(26,26,31,0.35)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput
                  style={inputStyle('password')}
                  placeholder="6자 이상"
                  placeholderTextColor="rgba(26,26,31,0.35)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            {/* Spacer pushes CTA to bottom */}
            <View style={{ flex: 1 }} />

            {/* CTA */}
            <GradientPill
              label={loading ? '가입 중...' : '가입하기'}
              onPress={handleSignUp}
              size="lg"
              fullWidth
              iconRight={null}
              disabled={!isValid || loading}
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
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  fields: {
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(26,26,31,0.55)',
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
    borderColor: 'rgba(45,58,107,0.4)',
  },
});
