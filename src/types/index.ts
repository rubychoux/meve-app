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

export type LifestyleDietTag =
  | '자극적인 음식'
  | '기름진 음식'
  | '단 음식'
  | '균형잡힌 식사'
  | '채소 충분';
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
  waterIntakeCups?: number;
  stressLevel?: 1 | 2 | 3 | 4 | 5;
  dietTags?: LifestyleDietTag[];
  notes?: string;
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
};

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
  DailyLog: undefined;
  FaceScanner: undefined;
  IngredientScanner: undefined;
  IngredientResult: { imageBase64?: string; result?: any };
};