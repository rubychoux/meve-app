// ─── User & Auth ────────────────────────────────────────────────────────────

export type SkinType = '지성' | '건성' | '복합성' | '민감성';

export type SkinConcern =
  | '여드름/트러블'
  | '색소침착/잡티'
  | '모공'
  | '주름/탄력'
  | '건조함/수분부족'
  | '칙칙함/광채';

export type ExperienceLevel = 'beginner' | 'under1y' | '1to3y' | 'over3y';

export type SkinGoal =
  | 'clear_skin'
  | 'hydration'
  | 'pore_care'
  | 'brightening';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  skinType: SkinType | null;
  concerns: SkinConcern[];
  routineSteps: number | null;       // 0–10
  routineBrands: string[];           // 최대 3개
  experienceLevel: ExperienceLevel | null;
  goal: SkinGoal | null;
  isPremium: boolean;
  onboardingCompleted: boolean;
  skinDataConsent: boolean;          // PIPA: 피부 데이터 수집 동의
  createdAt: string;
}

// ─── Scans ───────────────────────────────────────────────────────────────────

export type IngredientFlag = 'safe' | 'caution' | 'avoid';
export type FlagType = '코메도제닉' | '자극성' | '향료' | '알코올';

export interface Ingredient {
  nameKo: string;
  nameEn: string;
  inciName?: string;
  flag: IngredientFlag;
  flagTypes: FlagType[];
  notes?: string;
}

export interface IngredientScanResult {
  id: string;
  userId: string;
  productName?: string;
  imageUrl?: string;
  compatibilityScore: 'safe' | 'caution' | 'avoid';
  compatibilityReason: string;
  flaggedIngredients: Ingredient[];
  safeIngredients: Ingredient[];
  createdAt: string;
}

export type FaceZone = '이마' | '볼' | '턱' | '코' | '턱 주변';
export type AcneType = '화농성' | '좁쌀' | '모낙염' | '혼합형';

export interface ZoneResult {
  zone: FaceZone;
  severity: 1 | 2 | 3 | 4 | 5;
  acneType?: AcneType;
}

export interface FaceScanResult {
  id: string;
  userId: string;
  imageUrl?: string;
  zones: ZoneResult[];
  overallAcneType: AcneType;
  overallSeverity: number;
  recommendations: string[];
  createdAt: string;
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export type DietTag = '고당' | '유제품' | '글루텐' | '음주' | '건강식';
export type CyclePhase = '생리기' | '배란기' | '황체기';
export type ProcedureType = '보톡스' | '레이저' | '필링' | '물광주사' | '기타';

export interface Supplement {
  name: string;
  dosage?: string;
}

export interface Procedure {
  id: string;
  userId: string;
  type: ProcedureType;
  clinic?: string;
  date: string;
  notes?: string;
  beforePhotoUrl?: string;
}

export interface DailyLog {
  id: string;
  userId: string;
  date: string;
  sleepHours?: number;
  stressLevel?: 1 | 2 | 3 | 4 | 5;
  dietNotes?: string;
  dietTags?: DietTag[];
  cycleDay?: number;
  cyclePhase?: CyclePhase;
  supplements?: Supplement[];
  procedures?: Procedure[];
  memo?: string;
}

// ─── Insights ────────────────────────────────────────────────────────────────

export type InsightConfidence = '분석 중' | '패턴 감지됨' | '높은 신뢰도';

export interface Insight {
  id: string;
  userId: string;
  patternText: string;
  supportingData?: object;
  confidence: InsightConfidence;
  isUseful?: boolean;
  isDismissed: boolean;
  generatedAt: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  AuthGate: undefined;
  EmailSignUp: undefined;
  OTPVerify: { email: string; name: string };
  Login: undefined;
};

export type SkinMode = 'wedding' | 'everyday' | 'graduation' | 'travel';

export type EventType = 'wedding' | 'date' | 'graduation' | 'travel' | 'other';

export type MainTabParamList = {
  Home: undefined;
  Skin: undefined;
  Look: undefined;
  Community: undefined;
  MyPage: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  ScanResult: { result: ScanAnalysisResult; isSaved?: boolean };
  EventFlow: undefined;
  Paywall: { source?: string } | undefined;
  ProfileEdit: undefined;
  NotificationSettings: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  FaceAnalysis: undefined;
  FaceAnalysisResult: { result: FaceAnalysisResult };
  TodaysLook: undefined;
  LookDetail: { look: LookRecommendation };
  InspoLook: undefined;
  InspoLookResult: { result: InspoLookResult; imageUri?: string; keyword?: string };
  InspoLookSaved: undefined;
  GlamSyncList: undefined;
  GlamSyncCreate: undefined;
  GlamSyncDetail: { syncId: string };
  LookPollList: undefined;
  LookPollCreate: undefined;
  LookPollDetail: { pollId: string };
  CreatePost: undefined;
  PostDetail: { postId: string };
  RoutineCoachChat: undefined;
  Notifications: undefined;
};

export type CommunityStackParamList = {
  CommunityFeed: undefined;
  CreatePost: undefined;
};

export type NotificationType = 'comment' | 'reply' | 'like';

export interface PostNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor?: { display_name: string | null; avatar_url: string | null } | null;
  post?: { content: string | null; image_urls: string[] | null } | null;
}

export type PostType = 'normal' | 'question' | 'before_after';

export interface ProductTag {
  name: string;
  oliveyoung_url: string;
}

export interface Post {
  id: string;
  user_id: string;
  display_name: string | null;
  content: string;
  image_url: string | null;
  image_urls: string[];
  before_photo_url: string | null;
  after_photo_url: string | null;
  post_type: PostType;
  is_public: boolean;
  event_type: string | null;
  skin_type: string | null;
  personal_color: string | null;
  vibe: string | null;
  face_shape: string | null;
  dday_count: number | null;
  product_tags: ProductTag[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  display_name: string | null;
  content: string;
  is_ai: boolean;
  parent_id: string | null;
  created_at: string;
  user_profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface GlamSync {
  id: string;
  host_id: string;
  event_name: string;
  event_date: string | null;
  final_glam_level: number | null;
  invite_code: string;
  created_at: string;
}

export interface GlamSyncMember {
  id: string;
  sync_id: string;
  user_id: string;
  proposed_level: number | null;
  checkin_photo_url: string | null;
  joined_at: string;
}

export interface LookPoll {
  id: string;
  user_id: string;
  question: string;
  photo_urls: string[];
  is_public: boolean;
  expires_at: string;
  created_at: string;
}

export interface LookPollVote {
  id: string;
  poll_id: string;
  voter_id: string;
  selected_index: number;
  comment: string | null;
  voted_at: string;
}

export interface InspoReferenceAnalysis {
  baseFinish: string;
  eyeStyle: string;
  lipColor: string;
  lipTexture: string;
  blushPosition: string;
  blushColor: string;
  overallVibe: string;
  keyPoints: string[];
}

export interface InspoStep {
  step: number;
  category: string;
  instruction: string;
  productHint: string;
}

export interface InspoPersonalizedGuide {
  adjustments: string;
  steps: InspoStep[];
  colorAdjustment: string;
}

export interface InspoLookResult {
  referenceAnalysis: InspoReferenceAnalysis;
  personalizedGuide: InspoPersonalizedGuide;
  summary: string;
}

export interface FaceAnalysisResult {
  faceShape: string;
  faceShapeReason?: string;
  personalColor: string;
  personalColorReason?: string;
  undertone: string;
  eyeShape: string;
  eyeTail: string;
  lipFullness: string;
  skinTone: string;
  skinToneHex?: string;
  foundationShade?: string;
  makeupRecommendation: {
    foundation: string;
    lip: string;
    eye: string;
    blush: string;
  };
  colorPalette: string[];
  avoidColors: string[];
  summary: string;
}

export interface LookProduct {
  category: string;
  name: string;
  tip: string;
}

export interface LookRecommendation {
  lookName: string;
  description: string;
  keyPoints: string[];
  products: LookProduct[];
  colorKeyword: string;
  difficulty: '쉬움' | '보통' | '어려움';
}

export type EventStackParamList = {
  EventSelect: undefined;
  EventSetup: { eventType: string };
};

export type ScanStackParamList = {
  ScanHub: undefined;
  IngredientCamera: undefined;
  IngredientResult: { scanId: string };
  FaceScanCamera: undefined;
  FaceScanResult: { scanId: string };
  ScanHistory: undefined;
};

export interface SkinZone {
  status: string;
  score: number;
}

export interface ScanAnalysisResult {
  overallScore: number;
  // New schema (2026 prompt)
  skinType?: string;
  hydrationLevel?: string;
  zones: {
    forehead: SkinZone | number;
    leftCheek: SkinZone | number;
    rightCheek: SkinZone | number;
    nose: SkinZone | number;
    chin: SkinZone | number;
  };
  concerns?: string[];
  strengths?: string[];
  ingredients?: {
    recommended: string[];
    avoid: string[];
  };
  routineAdvice?: {
    morning: string;
    evening: string;
  };
  summary?: string;
  // Legacy fields kept optional so rows saved under the old schema still type-check.
  skinCondition?: string;
  acneType?: string;
  severity?: number;
  keyFindings?: string[];
  recommendations?: string[];
  redness?: {
    detected: boolean;
    zones: string[];
    severity: number;
    description: string;
  };
}

export type AIScanStackParamList = {
  SkinHome: undefined;
  FaceScanner: undefined;
  IngredientScanner: undefined;
  IngredientResult: { imageBase64?: string; result?: any };
};