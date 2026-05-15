// Community post composer — MEVE-193. Uploads to 'community-posts' bucket (public read).
import React, { useCallback, useEffect, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import {
  MainStackParamList,
  PostType,
  ProductTag,
  FaceAnalysisResult,
} from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'CreatePost'>;

const PINK = '#FF6B9D';
const BLUE = '#2D3A6B';
const BUCKET = 'community-posts';
const MAX_CONTENT = 500;
const MAX_PRODUCTS = 5;

const POST_TYPES: { key: PostType; label: string; emoji: string }[] = [
  { key: 'normal', label: '인증샷', emoji: '📸' },
  { key: 'question', label: '고민상담', emoji: '💬' },
  { key: 'before_after', label: '비포애프터', emoji: '✨' },
];

const PLACEHOLDERS: Record<PostType, string> = {
  normal: '어떤 메이크업/스킨케어 했는지 알려주세요 💕',
  question: '피부나 메이크업 고민을 나눠봐요 🌿',
  before_after: '어떻게 변화했는지 알려주세요 ✨',
};

function normalizePersonalColor(input: string | null): string | null {
  if (!input) return null;
  const t = input.replace(/\s+/g, '');
  if (t.includes('여름') && t.includes('쿨톤')) return '여름 쿨톤';
  if (t.includes('겨울') && t.includes('쿨톤')) return '겨울 쿨톤';
  if (t.includes('봄') && t.includes('웜톤')) return '봄 웜톤';
  if (t.includes('가을') && t.includes('웜톤')) return '가을 웜톤';
  return input;
}

function oliveyoungUrl(q: string) {
  return `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodeURIComponent(q)}`;
}

interface AutoTags {
  event_type: string | null;
  dday_count: number | null;
  skin_type: string | null;
  personal_color: string | null;
  vibe: string | null;
  face_shape: string | null;
}

type TagKey = keyof AutoTags;

export function CreatePostScreen() {
  const navigation = useNavigation<Nav>();

  const [postType, setPostType] = useState<PostType>('normal');
  const [photos, setPhotos] = useState<string[]>([]); // 인증샷 (up to 4)
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [questionPhoto, setQuestionPhoto] = useState<string | null>(null); // optional for 고민상담

  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tags, setTags] = useState<AutoTags>({
    event_type: null,
    dday_count: null,
    skin_type: null,
    personal_color: null,
    vibe: null,
    face_shape: null,
  });
  const [enabled, setEnabled] = useState<Record<TagKey, boolean>>({
    event_type: true,
    dday_count: true,
    skin_type: true,
    personal_color: true,
    vibe: true,
    face_shape: true,
  });

  const [productInput, setProductInput] = useState('');
  const [productTags, setProductTags] = useState<ProductTag[]>([]);

  // ── Load auto-tags on mount ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let skinType: string | null = null;
        if (user) {
          const { data } = await supabase
            .from('user_profiles')
            .select('skin_type')
            .eq('id', user.id)
            .single();
          skinType = data?.skin_type ?? null;
        }

        const pairs = await AsyncStorage.multiGet([
          'meve_personal_color',
          'meve_vibe',
          'meve_face_analysis',
          'meve_event_type',
          'meve_event_date',
        ]);
        const m = Object.fromEntries(pairs) as Record<string, string | null>;
        const personalColor = normalizePersonalColor(m['meve_personal_color']);
        const vibe = m['meve_vibe'];

        let faceShape: string | null = null;
        if (m['meve_face_analysis']) {
          try {
            const parsed = JSON.parse(m['meve_face_analysis']) as FaceAnalysisResult;
            faceShape = parsed.faceShape ?? null;
          } catch {}
        }

        const eventType = m['meve_event_type'];
        let ddayCount: number | null = null;
        if (m['meve_event_date']) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const target = new Date(m['meve_event_date']);
          target.setHours(0, 0, 0, 0);
          ddayCount = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
        }

        setTags({
          event_type: eventType,
          dday_count: ddayCount,
          skin_type: skinType,
          personal_color: personalColor,
          vibe,
          face_shape: faceShape,
        });
      } catch {}
    })();
  }, []);

  const pickImage = useCallback(async (): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진을 선택하려면 갤러리 접근 권한이 필요해요.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) return result.assets[0].uri;
    return null;
  }, []);

  const addPhoto = async () => {
    if (photos.length >= 4) return;
    const uri = await pickImage();
    if (uri) setPhotos((prev) => [...prev, uri]);
  };
  const removePhoto = (i: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const pickBefore = async () => {
    const uri = await pickImage();
    if (uri) setBeforePhoto(uri);
  };
  const pickAfter = async () => {
    const uri = await pickImage();
    if (uri) setAfterPhoto(uri);
  };
  const pickQuestionPhoto = async () => {
    if (questionPhoto) {
      setQuestionPhoto(null);
      return;
    }
    const uri = await pickImage();
    if (uri) setQuestionPhoto(uri);
  };

  const uploadToBucket = async (
    uri: string,
    userId: string,
    ts: string,
    filename: string
  ): Promise<string> => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const path = `${userId}/${ts}_${filename}.jpg`;
    const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, byteArray, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const toggleTag = (k: TagKey) => {
    setEnabled((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const addProductTag = () => {
    const name = productInput.trim();
    if (!name) return;
    if (productTags.length >= MAX_PRODUCTS) {
      Alert.alert('제한', `최대 ${MAX_PRODUCTS}개까지 태그할 수 있어요.`);
      return;
    }
    setProductTags((prev) => [...prev, { name, oliveyoung_url: oliveyoungUrl(name) }]);
    setProductInput('');
  };
  const removeProduct = (i: number) => {
    setProductTags((prev) => prev.filter((_, idx) => idx !== i));
  };

  const validate = (): string | null => {
    if (postType === 'normal' && photos.length === 0)
      return '최소 1장의 사진을 올려주세요.';
    if (postType === 'before_after' && (!beforePhoto || !afterPhoto))
      return 'BEFORE와 AFTER 사진 모두 필요해요.';
    if (content.trim().length === 0)
      return '내용을 입력해주세요.';
    return null;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const err = validate();
    if (err) {
      Alert.alert('잠시만요', err);
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      const displayName = profile?.display_name ?? null;

      const ts = `${Date.now()}`;
      let imageUrls: string[] = [];
      let beforeUrl: string | null = null;
      let afterUrl: string | null = null;

      if (postType === 'normal') {
        for (let i = 0; i < photos.length; i++) {
          const url = await uploadToBucket(photos[i], user.id, ts, `p${i}`);
          imageUrls.push(url);
        }
      } else if (postType === 'before_after') {
        if (beforePhoto)
          beforeUrl = await uploadToBucket(beforePhoto, user.id, ts, 'before');
        if (afterPhoto)
          afterUrl = await uploadToBucket(afterPhoto, user.id, ts, 'after');
      } else if (postType === 'question' && questionPhoto) {
        const url = await uploadToBucket(questionPhoto, user.id, ts, 'q');
        imageUrls = [url];
      }

      const payload = {
        user_id: user.id,
        display_name: displayName,
        content: content.trim(),
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
        before_photo_url: beforeUrl,
        after_photo_url: afterUrl,
        post_type: postType,
        is_public: isPublic,
        event_type: enabled.event_type ? tags.event_type : null,
        skin_type: enabled.skin_type ? tags.skin_type : null,
        personal_color: enabled.personal_color ? tags.personal_color : null,
        vibe: enabled.vibe ? tags.vibe : null,
        face_shape: enabled.face_shape ? tags.face_shape : null,
        dday_count: enabled.dday_count ? tags.dday_count : null,
        product_tags: productTags,
      };

      const { error } = await supabase.from('posts').insert(payload);
      if (error) throw error;
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('등록 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderTagPill = (k: TagKey, label: string) => {
    const isOn = enabled[k];
    return (
      <TouchableOpacity
        key={k}
        style={[styles.tagPill, isOn ? styles.tagPillOn : styles.tagPillOff]}
        onPress={() => toggleTag(k)}
        activeOpacity={0.75}
      >
        <Text
          style={[
            styles.tagPillText,
            isOn ? styles.tagPillTextOn : styles.tagPillTextOff,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>게시글 만들기</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          hitSlop={8}
        >
          {submitting ? (
            <ActivityIndicator color={PINK} />
          ) : (
            <Text style={styles.submitTopBtn}>등록</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Post type tabs */}
          <View style={styles.typeRow}>
            {POST_TYPES.map((t) => {
              const active = postType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeTab, active && styles.typeTabActive]}
                  onPress={() => setPostType(t.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.typeTabText, active && styles.typeTabTextActive]}
                  >
                    {t.label} {t.emoji}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Photo section */}
          {postType === 'normal' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>사진 (최대 4장)</Text>
              <View style={styles.photoGrid}>
                {photos.map((uri, i) => (
                  <View key={uri + i} style={styles.photoSlot}>
                    <Image source={{ uri }} style={styles.photoImg} />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.length < 4 && (
                  <TouchableOpacity
                    style={styles.addSlot}
                    onPress={addPhoto}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="add" size={28} color={PINK} />
                    <Text style={styles.addSlotText}>추가</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {postType === 'before_after' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>비포 / 애프터</Text>
              <View style={styles.baRow}>
                <TouchableOpacity
                  style={styles.baSlot}
                  onPress={pickBefore}
                  activeOpacity={0.85}
                >
                  {beforePhoto ? (
                    <Image source={{ uri: beforePhoto }} style={styles.baImg} />
                  ) : (
                    <View style={styles.baEmpty}>
                      <Ionicons name="image-outline" size={32} color="#8A8A9A" />
                      <Text style={styles.baEmptyLabel}>BEFORE</Text>
                    </View>
                  )}
                  <View style={[styles.baTag, { backgroundColor: '#8A8A9A' }]}>
                    <Text style={styles.baTagText}>BEFORE</Text>
                  </View>
                  {beforePhoto && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => setBeforePhoto(null)}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.baSlot}
                  onPress={pickAfter}
                  activeOpacity={0.85}
                >
                  {afterPhoto ? (
                    <Image source={{ uri: afterPhoto }} style={styles.baImg} />
                  ) : (
                    <View style={styles.baEmpty}>
                      <Ionicons name="image-outline" size={32} color={PINK} />
                      <Text style={[styles.baEmptyLabel, { color: PINK }]}>AFTER</Text>
                    </View>
                  )}
                  <View style={[styles.baTag, { backgroundColor: PINK }]}>
                    <Text style={styles.baTagText}>AFTER</Text>
                  </View>
                  {afterPhoto && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => setAfterPhoto(null)}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {postType === 'question' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>사진 (선택)</Text>
              <TouchableOpacity
                style={styles.questionPhotoSlot}
                onPress={pickQuestionPhoto}
                activeOpacity={0.85}
              >
                {questionPhoto ? (
                  <>
                    <Image source={{ uri: questionPhoto }} style={styles.photoImg} />
                    <View style={styles.removeBtn}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name="image-outline" size={28} color={PINK} />
                    <Text style={styles.addSlotText}>사진 추가</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Text input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>내용</Text>
            <TextInput
              style={styles.input}
              value={content}
              onChangeText={(t) => t.length <= MAX_CONTENT && setContent(t)}
              placeholder={PLACEHOLDERS[postType]}
              placeholderTextColor="#B8AFB5"
              multiline
              maxLength={MAX_CONTENT}
            />
            <Text style={styles.counter}>
              {content.length} / {MAX_CONTENT}
            </Text>
          </View>

          {/* Auto tags */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>내 태그</Text>
            <Text style={styles.sectionHint}>탭해서 공개/비공개 설정</Text>
            <View style={styles.tagRow}>
              {tags.event_type &&
                renderTagPill('event_type', `이벤트: ${tags.event_type}`)}
              {tags.dday_count != null &&
                renderTagPill('dday_count', `D-${tags.dday_count}`)}
              {tags.skin_type && renderTagPill('skin_type', tags.skin_type)}
              {tags.personal_color &&
                renderTagPill('personal_color', tags.personal_color)}
              {tags.vibe && renderTagPill('vibe', tags.vibe)}
              {tags.face_shape && renderTagPill('face_shape', tags.face_shape)}
              {!tags.event_type &&
                !tags.skin_type &&
                !tags.personal_color &&
                !tags.vibe &&
                !tags.face_shape && (
                  <Text style={styles.noTagText}>
                    아직 저장된 프로필 태그가 없어요
                  </Text>
                )}
            </View>
          </View>

          {/* Product tags */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>사용한 제품 태그하기 (선택)</Text>
            <View style={styles.productInputRow}>
              <TextInput
                style={[styles.input, styles.productInput]}
                value={productInput}
                onChangeText={setProductInput}
                placeholder="제품명을 입력해 주세요"
                placeholderTextColor="#B8AFB5"
                returnKeyType="done"
                onSubmitEditing={addProductTag}
              />
              <TouchableOpacity
                style={styles.productAddBtn}
                onPress={addProductTag}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.productChipRow}>
              {productTags.map((p, i) => (
                <View key={`${p.name}-${i}`} style={styles.productChip}>
                  <Text style={styles.productChipText} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <TouchableOpacity onPress={() => removeProduct(i)} hitSlop={6}>
                    <Ionicons name="close" size={14} color={PINK} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Public toggle */}
          <View style={[styles.section, styles.publicRow]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>전체 공개</Text>
              <Text style={styles.sectionHint}>
                꺼두면 내 프로필에서만 볼 수 있어요
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ true: PINK, false: '#E2D5DC' }}
              thumbColor="#fff"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>게시글 올리기</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  submitTopBtn: { fontSize: 14, fontWeight: '700', color: PINK },

  content: { padding: 20, paddingBottom: 60, gap: 16 },

  typeRow: {
    flexDirection: 'row',
    backgroundColor: '#F0E6EC',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeTabActive: { backgroundColor: '#fff' },
  typeTabText: { fontSize: 12, fontWeight: '600', color: '#8A8A9A' },
  typeTabTextActive: { color: PINK },

  section: { gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1F' },
  sectionHint: { fontSize: 11, color: '#8A8A9A' },

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

  baRow: { flexDirection: 'row', gap: 8 },
  baSlot: {
    flex: 1,
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F0E6EC',
  },
  baImg: { width: '100%', height: '100%' },
  baEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F9F0F5',
  },
  baEmptyLabel: { fontSize: 12, fontWeight: '700', color: '#8A8A9A' },
  baTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  baTagText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  questionPhotoSlot: {
    width: 140,
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFC4D6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0E6EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A1F',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: '#8A8A9A' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
  },
  tagPillOn: { backgroundColor: '#FFF0F5', borderColor: '#FFC4D6' },
  tagPillOff: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  tagPillText: { fontSize: 12, fontWeight: '600' },
  tagPillTextOn: { color: PINK },
  tagPillTextOff: { color: '#B8B0B5', textDecorationLine: 'line-through' },
  noTagText: { fontSize: 12, color: '#8A8A9A' },

  productInputRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  productInput: { flex: 1, minHeight: 44 },
  productAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  productChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5F9',
    borderWidth: 1,
    borderColor: '#FFC4D6',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 180,
  },
  productChipText: { fontSize: 12, color: PINK, fontWeight: '600' },

  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },

  submitBtn: {
    marginTop: 12,
    backgroundColor: PINK,
    borderRadius: 50,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
