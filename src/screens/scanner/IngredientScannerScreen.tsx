import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'IngredientScanner'>;

export function IngredientScannerScreen() {
  const navigation = useNavigation<Nav>();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'camera' | 'search'>('camera');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Guide box dimensions
  const boxWidth = width * 0.8;
  const boxHeight = boxWidth * 0.6;

  // ── Camera capture ──────────────────────────────────────────────────────────

  const handleCapture = async () => {
    if (isCapturing || !cameraRef.current) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });
      if (!photo.base64) throw new Error('base64 없음');
      navigation.navigate('IngredientResult', { imageBase64: photo.base64 });
    } catch {
      setIsCapturing(false);
    }
  };

  // ── Text search ─────────────────────────────────────────────────────────────

  const handleTextSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const skinProfile = await AsyncStorage.getItem('meve_last_scan');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `You are a Korean skincare ingredient expert.
The user entered: "${searchQuery}"
This could be a product name or ingredient list.
User skin profile: ${skinProfile || 'unknown'}

Analyze the ingredients and return ONLY valid JSON no markdown:
{
  "productName": "제품명 or null",
  "overallScore": 0-100,
  "summary": "한 줄 요약 (한국어)",
  "ingredients": [
    {"name": "성분명", "status": "safe|caution|avoid", "reason": "이유 (한국어)"}
  ]
}
All text in Korean.`,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);

      const content = data.choices[0].message.content.trim();
      const jsonMatch = content.match(/[{[][\s\S]*[}\]]/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패');

      const result = JSON.parse(jsonMatch[0]);
      navigation.navigate('IngredientResult', { result });
    } catch (e: any) {
      Alert.alert('분석 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  // ── Tab bar (shared) ────────────────────────────────────────────────────────

  const renderTabBar = (variant: 'light' | 'dark' = 'light') => {
    const isLight = variant === 'light';
    return (
      <View style={[styles.tabBar, !isLight && styles.tabBarDark]}>
        <TouchableOpacity
          onPress={() => setActiveTab('camera')}
          style={[styles.tab, activeTab === 'camera' && (isLight ? styles.tabActive : styles.tabActiveDark)]}
        >
          <Text style={[styles.tabText, activeTab === 'camera' && styles.tabTextActive]}>
            카메라 스캔
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('search')}
          style={[styles.tab, activeTab === 'search' && (isLight ? styles.tabActive : styles.tabActiveDark)]}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
            직접 검색
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Search tab UI ───────────────────────────────────────────────────────────

  if (activeTab === 'search') {
    return (
      <SafeAreaView style={styles.searchContainer} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.searchHeaderTitle}>성분 스캐너</Text>
          <View style={{ width: 24 }} />
        </View>

        {renderTabBar('light')}

        <ScrollView
          style={styles.searchScroll}
          contentContainerStyle={styles.searchContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.searchLabel}>제품명 또는 성분을 입력해주세요</Text>
          <Text style={styles.searchHint}>
            예) 세라마이드, 나이아신아마이드, 또는 "라네즈 수분 크림"
          </Text>

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="제품명 또는 성분명 입력..."
            placeholderTextColor="#ccc"
            multiline
            numberOfLines={4}
            style={styles.searchInput}
          />

          <TouchableOpacity
            onPress={handleTextSearch}
            disabled={!searchQuery.trim() || isSearching}
            style={[
              styles.searchBtn,
              (!searchQuery.trim() || isSearching) && styles.searchBtnDisabled,
            ]}
            activeOpacity={0.85}
          >
            {isSearching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.searchBtnText}>분석하기</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Camera tab — no permission ──────────────────────────────────────────────

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="camera-outline" size={48} color={Colors.accent} />
        <Text style={styles.permissionTitle}>카메라 접근이 필요해요</Text>
        <Text style={styles.permissionDesc}>
          제품 성분표를 스캔하려면{'\n'}카메라 권한을 허용해 주세요.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>권한 허용하기</Text>
        </TouchableOpacity>
        {/* Allow switching to search even without camera */}
        <TouchableOpacity style={styles.altBtn} onPress={() => setActiveTab('search')}>
          <Text style={styles.altBtnText}>직접 검색으로 분석하기 →</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Camera tab — camera view ────────────────────────────────────────────────

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>성분 스캐너</Text>
        <View style={{ width: 24 }} />
      </SafeAreaView>

      {/* Tab bar over camera */}
      <View style={styles.cameraTabWrap}>
        {renderTabBar('dark')}
      </View>

      {/* Overlay with cutout */}
      <View style={styles.overlayWrapper} pointerEvents="none">
        <View style={[styles.dimBlock, { height: (height - boxHeight) / 2 - 60 }]} />
        <View style={{ flexDirection: 'row', height: boxHeight }}>
          <View style={styles.dimBlock} />
          <View style={{ width: boxWidth, height: boxHeight }} />
          <View style={styles.dimBlock} />
        </View>
        <View style={[styles.dimBlock, { flex: 1 }]} />
      </View>

      {/* Guide box border */}
      <View
        pointerEvents="none"
        style={[
          styles.guideBox,
          {
            width: boxWidth,
            height: boxHeight,
            top: (height - boxHeight) / 2 - 60,
          },
        ]}
      />

      {/* Guide text */}
      <View style={[styles.guideTextWrap, { top: (height - boxHeight) / 2 - 90 }]}>
        <Text style={styles.guideText}>성분표를 박스 안에 맞춰주세요</Text>
      </View>

      {/* Capturing overlay */}
      {isCapturing && (
        <View style={styles.analyzingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.analyzingText}>촬영 중...</Text>
        </View>
      )}

      {/* Bottom capture bar */}
      {!isCapturing && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={handleCapture}
            activeOpacity={0.85}
          >
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#000' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#F0E6EC',
    borderRadius: 12,
    padding: 4,
  },
  tabBarDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabActiveDark: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: Colors.accent,
  },

  // Search tab
  searchContainer: {
    flex: 1,
    backgroundColor: '#FDF6F9',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  searchScroll: { flex: 1 },
  searchContent: {
    padding: 16,
    paddingTop: 20,
  },
  searchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2D2D',
    marginBottom: 8,
  },
  searchHint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
    lineHeight: 19,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    fontSize: 14,
    color: '#2D2D2D',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  searchBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  searchBtnDisabled: {
    backgroundColor: '#eee',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Permission
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  backBtn: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: { ...Typography.h2, textAlign: 'center' },
  permissionDesc: { ...Typography.bodySecondary, textAlign: 'center', lineHeight: 22 },
  permissionBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
  },
  permissionBtnText: { ...Typography.cta, color: Colors.surface },
  altBtn: { marginTop: Spacing.sm },
  altBtnText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraTabWrap: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    zIndex: 12,
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },

  // Overlay
  overlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  dimBlock: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  guideBox: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 2.5,
    borderColor: Colors.accent,
    borderRadius: 12,
    zIndex: 2,
  },
  guideTextWrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 3,
  },
  guideText: {
    ...Typography.caption,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.sm,
    fontSize: 13,
    fontWeight: '500',
  },

  // Analyzing
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  analyzingText: { ...Typography.body, color: '#fff' },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Spacing.xl,
    zIndex: 10,
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  captureBtnInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
  },
});
