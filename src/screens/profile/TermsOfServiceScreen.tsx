// MEVE-211 — Terms of service.
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

type Nav = NativeStackNavigationProp<MainStackParamList, 'TermsOfService'>;

export function TermsOfServiceScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>이용약관</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.docTitle}>이용약관</Text>
        <Text style={styles.meta}>시행일: 2026년 5월 1일</Text>

        <Section title="제1조 (목적)">
          <Body>
            이 약관은 meve(이하 "회사")가 제공하는 AI 뷰티 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
          </Body>
        </Section>

        <Divider />

        <Section title="제2조 (정의)">
          <Bullet>
            "서비스"란 회사가 제공하는 AI 피부 분석, 메이크업 추천, 커뮤니티 등 모든 서비스를 의미합니다.
          </Bullet>
          <Bullet>
            "이용자"란 이 약관에 동의하고 서비스를 이용하는 회원을 말합니다.
          </Bullet>
        </Section>

        <Divider />

        <Section title="제3조 (약관의 효력 및 변경)">
          <Body>① 이 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.</Body>
          <Body>
            ② 회사는 필요한 경우 약관을 변경할 수 있으며, 변경 시 7일 전 공지합니다.
          </Body>
        </Section>

        <Divider />

        <Section title="제4조 (서비스 이용)">
          <Body>① 서비스는 연중무휴 24시간 제공을 원칙으로 합니다.</Body>
          <Body>
            ② 회사는 시스템 점검, 서버 장애 등의 경우 서비스를 일시 중단할 수 있습니다.
          </Body>
          <Body>
            ③ AI 분석 결과는 참고용이며, 의학적 진단이나 처방을 대체하지 않습니다.
          </Body>
        </Section>

        <Divider />

        <Section title="제5조 (회원 가입 및 탈퇴)">
          <Body>
            ① 이용자는 회사가 정한 절차에 따라 회원 가입을 신청할 수 있습니다.
          </Body>
          <Body>
            ② 회원 탈퇴는 앱 내 마이페이지에서 언제든지 신청할 수 있습니다.
          </Body>
          <Body>
            ③ 탈퇴 시 이용자의 개인정보는 즉시 파기됩니다. (단, 관련 법령에 따른 경우 예외)
          </Body>
        </Section>

        <Divider />

        <Section title="제6조 (이용자의 의무)">
          <Body>이용자는 다음 행위를 하여서는 안 됩니다.</Body>
          <Bullet>타인의 정보 도용</Bullet>
          <Bullet>회사의 지식재산권 침해</Bullet>
          <Bullet>서비스 운영 방해</Bullet>
          <Bullet>음란, 폭력적인 콘텐츠 게시</Bullet>
          <Bullet>상업적 목적의 무단 광고</Bullet>
        </Section>

        <Divider />

        <Section title="제7조 (서비스 요금)">
          <Body>① 기본 서비스는 무료로 제공됩니다.</Body>
          <Body>② 프리미엄 서비스는 월 ₩9,900의 구독료가 부과됩니다.</Body>
          <Body>③ 구독 취소 시 현재 구독 기간 종료 후 자동 해지됩니다.</Body>
          <Body>④ 환불은 앱스토어 환불 정책에 따릅니다.</Body>
        </Section>

        <Divider />

        <Section title="제8조 (지식재산권)">
          <Body>서비스 내 모든 콘텐츠의 지식재산권은 회사에 귀속됩니다.</Body>
          <Body>
            단, 이용자가 직접 작성한 게시물의 권리는 해당 이용자에게 있습니다.
          </Body>
        </Section>

        <Divider />

        <Section title="제9조 (면책 조항)">
          <Body>① AI 분석 결과의 정확성을 100% 보장하지 않습니다.</Body>
          <Body>
            ② 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다.
          </Body>
          <Body>③ 이용자 간의 거래 또는 분쟁에 대해 회사는 개입하지 않습니다.</Body>
        </Section>

        <Divider />

        <Section title="제10조 (분쟁 해결)">
          <Body>
            이 약관과 관련한 분쟁은 대한민국 법을 준거법으로 하며, 서울중앙지방법원을 전속 관할법원으로 합니다.
          </Body>
        </Section>

        <Divider />

        <Section title="부칙">
          <Body>이 약관은 2026년 5월 1일부터 시행합니다.</Body>
          <Body>문의: chouxxkim@gmail.com</Body>
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

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
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

  docTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  meta: { fontSize: 12, color: '#8A8A9A', marginBottom: 24 },

  section: { marginBottom: 4 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 24,
    marginBottom: 8,
  },
  body: { fontSize: 14, color: '#4A4A5A', lineHeight: 24 },
  bulletRow: { marginBottom: 2 },
  bulletText: { fontSize: 14, color: '#4A4A5A', lineHeight: 24 },

  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginTop: 16,
  },
});
