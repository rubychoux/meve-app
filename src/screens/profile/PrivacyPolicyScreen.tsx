// MEVE-211 — PIPA-compliant privacy policy.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'PrivacyPolicy'>;

export function PrivacyPolicyScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보처리방침</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.docTitle}>개인정보처리방침</Text>
        <Text style={styles.intro}>
          meve(이하 "회사")는 개인정보보호법(PIPA)에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </Text>
        <Text style={styles.meta}>시행일: 2026년 5월 1일</Text>

        <Section title="1. 수집하는 개인정보 항목">
          <Body>회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.</Body>

          <SubTitle>필수 항목</SubTitle>
          <Bullet>이메일 주소, 비밀번호 (회원가입 시)</Bullet>
          <Bullet>기기 정보 (OS 버전, 기기 모델)</Bullet>
          <Bullet>서비스 이용 기록</Bullet>

          <SubTitle>선택 항목</SubTitle>
          <Bullet>이름(닉네임), 생년월일, 성별</Bullet>
          <Bullet>프로필 사진</Bullet>
          <Bullet>피부 분석 사진 (AI 스캔 시, 분석 후 즉시 삭제)</Bullet>
          <Bullet>퍼스널 컬러, 얼굴형, 피부 타입 등 뷰티 프로필 정보</Bullet>
        </Section>

        <Divider />

        <Section title="2. 개인정보 수집 및 이용 목적">
          <Bullet>회원 가입 및 본인 확인</Bullet>
          <Bullet>AI 피부 분석 및 맞춤 뷰티 서비스 제공</Bullet>
          <Bullet>서비스 개선 및 신규 서비스 개발</Bullet>
          <Bullet>고객 문의 및 불만 처리</Bullet>
          <Bullet>마케팅 및 광고 활용 (동의한 경우에 한함)</Bullet>
        </Section>

        <Divider />

        <Section title="3. 개인정보 보유 및 이용 기간">
          <Bullet>회원 탈퇴 시까지 보유 후 즉시 파기</Bullet>
          <Bullet>단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관</Bullet>
          <Body style={styles.indent}>· 소비자 불만 또는 분쟁 처리: 3년 (전자상거래법)</Body>
          <Body style={styles.indent}>· 서비스 이용 기록: 1년 (통신비밀보호법)</Body>
        </Section>

        <Divider />

        <Section title="4. 개인정보의 제3자 제공">
          <Body>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
          </Body>
          <Body>
            단, 이용자가 사전에 동의한 경우 또는 법령의 규정에 의한 경우는 예외로 합니다.
          </Body>
        </Section>

        <Divider />

        <Section title="5. 개인정보 처리 위탁">
          <Body>회사는 서비스 향상을 위해 아래와 같이 개인정보를 위탁하고 있습니다.</Body>
          <Bullet>OpenAI: AI 분석 서비스 제공 (사진 데이터 분석 후 즉시 삭제)</Bullet>
          <Bullet>Supabase: 데이터베이스 및 인증 서비스</Bullet>
          <Bullet>Vercel: 웹 서비스 호스팅</Bullet>
        </Section>

        <Divider />

        <Section title="6. 이용자의 권리">
          <Body>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</Body>
          <Bullet>개인정보 열람 요청</Bullet>
          <Bullet>개인정보 정정·삭제 요청</Bullet>
          <Bullet>개인정보 처리 정지 요청</Bullet>
          <Bullet>동의 철회 (회원 탈퇴)</Bullet>
          <Body>
            권리 행사는 앱 내 마이페이지 → 설정 또는 아래 이메일로 연락해 주세요.
          </Body>
        </Section>

        <Divider />

        <Section title="7. 개인정보 보호 조치">
          <Body>회사는 개인정보 보호를 위해 다음의 조치를 취하고 있습니다.</Body>
          <Bullet>개인정보의 암호화 (전송 및 저장 시 SSL/TLS 적용)</Bullet>
          <Bullet>접근 권한 최소화 및 관리</Bullet>
          <Bullet>정기적인 보안 점검</Bullet>
        </Section>

        <Divider />

        <Section title="8. 개인정보 보호책임자">
          <Body>이름: 김슈크림</Body>
          <Body>이메일: chouxxkim@gmail.com</Body>
        </Section>

        <Divider />

        <Section title="9. 개인정보처리방침 변경">
          <Body>
            이 개인정보처리방침은 법령, 정책 변경에 따라 내용이 추가·삭제·수정될 수 있습니다.
          </Body>
          <Body>변경 시 앱 공지 또는 이메일을 통해 사전 안내합니다.</Body>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subTitle}>{children}</Text>;
}

function Body({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletText}>• {children}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  content: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 60 },

  docTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 12 },
  intro: { fontSize: 14, color: '#4A4A5A', lineHeight: 24, marginBottom: 8 },
  meta: { fontSize: 12, color: '#8A8A9A', marginBottom: 24 },

  section: { marginBottom: 4 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 24,
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 10,
    marginBottom: 4,
  },
  body: { fontSize: 14, color: '#4A4A5A', lineHeight: 24 },
  indent: { marginLeft: 12 },
  bulletRow: { marginBottom: 2 },
  bulletText: { fontSize: 14, color: '#4A4A5A', lineHeight: 24 },

  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginTop: 16,
  },
});
