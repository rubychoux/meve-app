/**
 * TopBar — meve v1.5 공통 상단바.
 *
 * 모든 BottomTab 화면 (Home / SKIN / Scan / LOOK / eve) 위에 배치.
 * 좌측 "meve" 워드마크 + 우측 알림 / AI 코치 / 마이페이지 아이콘.
 *
 * 호출자가 SafeAreaView (edges=['top'])로 감싼 안에 렌더링한다고 가정 —
 * TopBar 자체는 안전영역 인셋을 처리하지 않음.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types';

type Nav = NavigationProp<MainStackParamList>;

export function TopBar() {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.topBar}>
      <Text style={styles.wordmark}>meve</Text>
      <View style={styles.icons}>
        <TouchableOpacity
          hitSlop={8}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color="#2D3A6B" />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={8}
          onPress={() =>
            navigation.navigate('RoutineCoachChat', { context: 'home' })
          }
        >
          <Ionicons name="sparkles-outline" size={22} color="#2D3A6B" />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={8}
          onPress={() => navigation.navigate('MyPage')}
        >
          <Ionicons name="person-outline" size={22} color="#2D3A6B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  wordmark: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
    color: '#2D3A6B',
    fontWeight: '300',
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
