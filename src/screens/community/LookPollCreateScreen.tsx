// Create Supabase Storage bucket 'look-polls' with public read in the dashboard.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'LookPollCreate'>;

const PINK = '#FF6B9D';
const BUCKET = 'look-polls';

type ExpiryOption = 30 | 60 | 180; // minutes

function makeInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function LookPollCreateScreen() {
  const navigation = useNavigation<Nav>();

  const [photos, setPhotos] = useState<string[]>([]); // local URIs
  const [question, setQuestion] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryOption>(60);
  const [submitting, setSubmitting] = useState(false);

  const addPhoto = async () => {
    if (photos.length >= 4) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진을 선택하려면 갤러리 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadPhoto = async (
    uri: string,
    userId: string,
    pollPrefix: string,
    index: number
  ): Promise<string> => {
    console.log('uploadPhoto start, uri:', uri);
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('base64 read, length:', base64.length);
    const path = `${userId}/${pollPrefix}/${index}.jpg`;
    const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, byteArray, { contentType: 'image/jpeg', upsert: true });
    console.log('upload done, error:', error);
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (photos.length === 0) {
      Alert.alert('사진 필요', '최소 1장의 사진을 올려주세요.');
      return;
    }
    if (question.trim().length === 0) {
      Alert.alert('질문 필요', '투표 질문을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const pollPrefix = `${Date.now()}`;
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const url = await uploadPhoto(photos[i], user.id, pollPrefix, i);
        urls.push(url);
      }
      console.log('Upload success, urls:', urls);

      const expiresAt = new Date(Date.now() + expiry * 60_000).toISOString();
      const inviteCode = makeInviteCode();
      const { data: insertData, error } = await supabase.from('look_polls').insert({
        user_id: user.id,
        question: question.trim(),
        photo_urls: urls,
        is_public: isPublic,
        expires_at: expiresAt,
        invite_code: inviteCode,
      }).select();
      console.log('Insert result:', JSON.stringify(insertData), 'Error:', JSON.stringify(error));
      if (error) throw error;

      navigation.goBack();
    } catch (e: any) {
      Alert.alert('생성 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>투표 만들기</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.hero}>어떤 룩이 더 어울릴까요? 💄</Text>
        <Text style={styles.heroSub}>최대 4장까지 올릴 수 있어요</Text>

        <View style={styles.photoGrid}>
          {photos.map((uri, i) => (
            <View key={uri + i} style={styles.photoSlot}>
              <Image source={{ uri }} style={styles.photoImg} />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removePhoto(i)}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
              <View style={styles.photoLabel}>
                <Text style={styles.photoLabelText}>{String.fromCharCode(65 + i)}</Text>
              </View>
            </View>
          ))}
          {photos.length < 4 && (
            <TouchableOpacity style={styles.addSlot} onPress={addPhoto} activeOpacity={0.75}>
              <Ionicons name="add" size={28} color={PINK} />
              <Text style={styles.addSlotText}>사진 추가</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>투표 질문</Text>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="예: 이 립이랑 이 옷 어울려?"
          placeholderTextColor="#B8AFB5"
          maxLength={100}
          multiline
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>커뮤니티에 공개</Text>
            <Text style={styles.labelSub}>다른 유저들도 투표할 수 있어요</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ true: PINK, false: '#E2D5DC' }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.label}>마감 시간</Text>
        <View style={styles.segmentRow}>
          {[
            { val: 30 as ExpiryOption, label: '30분' },
            { val: 60 as ExpiryOption, label: '1시간' },
            { val: 180 as ExpiryOption, label: '3시간' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.val}
              style={[styles.segment, expiry === opt.val && styles.segmentActive]}
              onPress={() => setExpiry(opt.val)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.segmentText,
                  expiry === opt.val && styles.segmentTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.65 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>투표 만들기</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF5F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1F' },

  content: { padding: 20, paddingBottom: 60, gap: 10 },
  hero: { fontSize: 20, fontWeight: '800', color: '#1A1A1F' },
  heroSub: { fontSize: 12, color: '#8A8A9A', marginBottom: 6 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoSlot: {
    width: 94,
    height: 94,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: PINK,
  },
  photoLabelText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  addSlot: {
    width: 94,
    height: 94,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFC4D6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addSlotText: { fontSize: 11, color: PINK, fontWeight: '600' },

  label: { fontSize: 13, fontWeight: '600', color: '#1A1A1F', marginTop: 12 },
  labelSub: { fontSize: 11, color: '#8A8A9A', marginTop: 2 },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0E6EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: '#1A1A1F',
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 6,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },

  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0E6EC',
  },
  segmentActive: { backgroundColor: PINK, borderColor: PINK },
  segmentText: { fontSize: 13, color: '#1A1A1F' },
  segmentTextActive: { color: '#fff', fontWeight: '700' },

  submitBtn: {
    marginTop: 20,
    backgroundColor: PINK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
