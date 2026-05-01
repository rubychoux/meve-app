// MEVE-244 — Event-specific personalized experience config.
// Keyed by Korean labels; the helper accepts both Korean and the legacy
// English keys ('wedding', 'date', etc.) used elsewhere in the codebase.

export type EventType = '웨딩' | '데이트' | '졸업' | '여행' | '촬영' | null;

export interface EventConfigPlanPhase {
  daysBeforeLabel: string;
  title: string;
  items: string[];
}

export interface EventConfigTreatmentTiming {
  daysRange: string;
  treatment: string;
  reason: string;
}

export interface EventConfig {
  emoji: string;
  label: string;
  badgeText: (daysLeft: number) => string;

  theme: {
    primary: string;
    secondary: string;
    gradientColors: string[];
    badgeBackground: string;
    badgeText: string;
  };

  coachTone: string;

  plan: EventConfigPlanPhase[];

  unsplashQuery: string;

  treatmentTiming: EventConfigTreatmentTiming[];

  homeTip: string;
}

export const EVENT_CONFIG: Record<string, EventConfig> = {
  웨딩: {
    emoji: '💍',
    label: '웨딩',
    badgeText: (d) => `💍 웨딩까지 D-${d}`,
    theme: {
      primary: '#C9A84C',
      secondary: '#F5ECD7',
      gradientColors: ['#FFFDF5', '#FFF8E7', '#F5ECD7'],
      badgeBackground: 'rgba(201,168,76,0.15)',
      badgeText: '#A07830',
    },
    coachTone:
      '당신의 인생에서 가장 빛나는 날을 준비하고 있어요. 차분하고 정성스럽게, 하나하나 꼼꼼히 챙겨드릴게요. 서두르지 않아도 돼요, 우리에게는 충분한 시간이 있어요.',
    plan: [
      {
        daysBeforeLabel: 'D-60 이전',
        title: '기초 케어 시작',
        items: [
          '레이저토닝 1회차 (색소 개선)',
          '히알루론산 세럼 루틴 고정',
          '자외선 차단제 매일 챙기기',
          '충분한 수면 + 수분 섭취',
        ],
      },
      {
        daysBeforeLabel: 'D-45~D-30',
        title: '집중 케어',
        items: [
          '레이저토닝 2~3회차',
          '리쥬란 힐러 (피부 재생)',
          '마스크팩 주 2~3회',
          '각질 관리 (주 1회)',
        ],
      },
      {
        daysBeforeLabel: 'D-14~D-7',
        title: '마무리 케어',
        items: [
          '물광주사 (광채 + 보습)',
          '스크럽/각질 제거 마감',
          '새 제품 테스트 금지',
          '진정 앰플 집중 사용',
        ],
      },
      {
        daysBeforeLabel: 'D-3~D-1',
        title: '최종 준비',
        items: [
          '마스크팩 매일',
          '수분크림 듬뿍',
          '음주 금지',
          '충분한 수면 (최소 8시간)',
          '립 각질 관리',
        ],
      },
      {
        daysBeforeLabel: 'D-day 당일',
        title: '웨딩 당일',
        items: [
          '메이크업 전 수분 미스트',
          '선크림 베이스 꼼꼼히',
          '여분 립 + 파우더 챙기기',
          '미니 스킨케어 키트 준비',
        ],
      },
    ],
    unsplashQuery: 'bridal makeup korean wedding beauty',
    treatmentTiming: [
      {
        daysRange: 'D-60~D-45',
        treatment: '레이저토닝',
        reason: '색소 개선, 여러 회 받을 시간 확보',
      },
      {
        daysRange: 'D-45~D-30',
        treatment: '리쥬란 힐러',
        reason: '피부 재생, 효과까지 4~6주',
      },
      {
        daysRange: 'D-14~D-10',
        treatment: '물광주사',
        reason: '즉각적인 광채, 지속 2~3주',
      },
      {
        daysRange: 'D-7 이후',
        treatment: '시술 금지',
        reason: '회복 시간 부족, 부작용 위험',
      },
    ],
    homeTip:
      '💍 웨딩 D-day까지 피부 속부터 채우는 게 핵심이에요. 오늘도 수분 챙기셨나요?',
  },

  데이트: {
    emoji: '💕',
    label: '데이트',
    badgeText: (d) => `💕 데이트까지 D-${d}`,
    theme: {
      primary: '#FF6B9D',
      secondary: '#FFE4EE',
      gradientColors: ['#FFF5F8', '#FFE4EE', '#FFD6E7'],
      badgeBackground: 'rgba(255,107,157,0.15)',
      badgeText: '#CC4477',
    },
    coachTone:
      '설레는 날이 다가오고 있네요! 발랄하고 자신감 넘치게 준비해봐요. 짧은 시간에도 충분히 빛날 수 있어요!',
    plan: [
      {
        daysBeforeLabel: 'D-7~D-5',
        title: '빠른 피부 SOS',
        items: [
          '비타민C 세럼 집중 사용',
          '수분 마스크팩 매일',
          '레티놀 등 자극 성분 잠시 중단',
          '충분한 수면',
        ],
      },
      {
        daysBeforeLabel: 'D-3~D-2',
        title: '집중 보습',
        items: [
          '수분크림 듬뿍 레이어링',
          '립 각질 제거 + 립밤',
          '눈가 아이크림 집중',
          '마스크팩 1회',
        ],
      },
      {
        daysBeforeLabel: 'D-1',
        title: '전날 준비',
        items: [
          '알코올 금지 (부기 주의)',
          '짠 음식 금지',
          '숙면',
          '메이크업 리허설',
        ],
      },
      {
        daysBeforeLabel: '당일',
        title: '데이트 당일',
        items: [
          '얼음 마사지로 모공 줄이기',
          '프라이머로 지속력 올리기',
          '향수는 손목 + 귀 뒤',
          '여분 립 챙기기',
        ],
      },
    ],
    unsplashQuery: 'romantic date makeup korean beauty dewy',
    treatmentTiming: [
      {
        daysRange: 'D-14~D-7',
        treatment: '물광주사',
        reason: '즉각적인 광채 효과',
      },
      {
        daysRange: 'D-5 이내',
        treatment: '시술 금지',
        reason: '붓기/멍 회복 시간 부족',
      },
    ],
    homeTip: '💕 설레는 날까지 얼마 안 남았어요! 오늘 수분 마스크팩 하나 챙겨봐요.',
  },

  졸업: {
    emoji: '🎓',
    label: '졸업',
    badgeText: (d) => `🎓 졸업까지 D-${d}`,
    theme: {
      primary: '#9B59B6',
      secondary: '#EDE0F5',
      gradientColors: ['#FAF5FF', '#EDE0F5', '#E0C8F0'],
      badgeBackground: 'rgba(155,89,182,0.15)',
      badgeText: '#7D3C98',
    },
    coachTone:
      '정말 뿌듯한 날이 다가오고 있네요! 그 빛나는 순간을 사진으로 남길 수 있도록 함께 준비해봐요. 당신은 이미 충분히 아름다워요.',
    plan: [
      {
        daysBeforeLabel: 'D-30~D-14',
        title: '피부 톤 정리',
        items: [
          '비타민C 세럼으로 칙칙함 개선',
          '자외선 차단 철저히',
          '각질 관리 주 1회',
        ],
      },
      {
        daysBeforeLabel: 'D-7~D-3',
        title: '집중 케어',
        items: [
          '수분 마스크팩 3일 연속',
          '눈가 집중 케어 (수면 충분히)',
          '플래시 번짐 방지 프라이머 테스트',
        ],
      },
      {
        daysBeforeLabel: '당일',
        title: '졸업식 당일',
        items: [
          '메이크업 2시간 전 스킨케어',
          '세팅 스프레이로 지속력',
          '야외 사진용 선크림 꼼꼼히',
          '여분 파우더 + 립 챙기기',
        ],
      },
    ],
    unsplashQuery: 'graduation natural makeup korean fresh beauty',
    treatmentTiming: [
      {
        daysRange: 'D-30~D-14',
        treatment: '레이저토닝',
        reason: '피부 톤 균일하게',
      },
      {
        daysRange: 'D-10~D-7',
        treatment: '물광주사',
        reason: '사진에서 빛나는 피부',
      },
    ],
    homeTip:
      '🎓 졸업 사진은 평생 남아요. 오늘의 피부 케어가 그날의 빛남을 만들어요.',
  },

  여행: {
    emoji: '✈️',
    label: '여행',
    badgeText: (d) => `✈️ 여행까지 D-${d}`,
    theme: {
      primary: '#00BCD4',
      secondary: '#E0F7FA',
      gradientColors: ['#F0FFFE', '#E0F7FA', '#B2EBF2'],
      badgeBackground: 'rgba(0,188,212,0.15)',
      badgeText: '#00838F',
    },
    coachTone:
      '여행지에서도 빛나는 당신을 만들어볼게요! 신나고 설레는 마음으로 함께 준비해봐요. 여행지에서도 피부 걱정 없이 즐기실 수 있어요.',
    plan: [
      {
        daysBeforeLabel: 'D-14~D-7',
        title: '여행 전 피부 강화',
        items: [
          '장벽 강화 크림 시작',
          '자외선 차단 습관 만들기',
          '여행용 미니어처 준비',
        ],
      },
      {
        daysBeforeLabel: '기내',
        title: '기내 스킨케어',
        items: [
          '기내 수분 미스트 자주',
          '립밤 필수',
          '수분크림 두껍게',
          '메이크업 없이 편하게',
        ],
      },
      {
        daysBeforeLabel: '현지',
        title: '여행지 케어',
        items: [
          '선크림 2~3시간마다 덧바르기',
          '클렌징 꼼꼼히',
          '수분 섭취 충분히',
          '현지 자외선 지수 체크',
        ],
      },
    ],
    unsplashQuery: 'travel makeup minimal fresh korean beauty outdoor',
    treatmentTiming: [
      {
        daysRange: 'D-21~D-14',
        treatment: '물광주사',
        reason: '여행 중 수분 유지',
      },
      {
        daysRange: 'D-7 이내',
        treatment: '시술 금지',
        reason: '자외선 노출 + 회복 어려움',
      },
    ],
    homeTip:
      '✈️ 여행지 자외선은 생각보다 강해요. 선크림 2개 챙기는 거 잊지 마세요!',
  },

  촬영: {
    emoji: '📸',
    label: '촬영',
    badgeText: (d) => `📸 촬영까지 D-${d}`,
    theme: {
      primary: '#455A64',
      secondary: '#ECEFF1',
      gradientColors: ['#FAFAFA', '#ECEFF1', '#E0E4E7'],
      badgeBackground: 'rgba(69,90,100,0.12)',
      badgeText: '#37474F',
    },
    coachTone:
      '카메라 앞에서 가장 빛나는 당신을 만들어드릴게요. 프로답게, 자신감 있게 준비해봐요.',
    plan: [
      {
        daysBeforeLabel: 'D-14~D-7',
        title: '피부 정돈',
        items: [
          '각질 관리로 매끄러운 베이스',
          '수분 집중 케어',
          '트러블 응급 처치',
        ],
      },
      {
        daysBeforeLabel: 'D-3~D-1',
        title: '촬영 준비',
        items: [
          '메이크업 리허설 (카메라로 직접 확인)',
          '플래시 번짐 방지 확인',
          '수분크림 충분히',
          '충분한 수면',
        ],
      },
      {
        daysBeforeLabel: '당일',
        title: '촬영 당일',
        items: [
          'HD 파우더로 피부 정돈',
          '프라이머 필수',
          '세팅 스프레이',
          '조명 타입 확인 (형광등/자연광/스튜디오)',
        ],
      },
    ],
    unsplashQuery: 'studio makeup photoshoot korean beauty polished',
    treatmentTiming: [
      {
        daysRange: 'D-21~D-14',
        treatment: '레이저토닝',
        reason: '피부 톤 균일, HD 카메라 대비',
      },
      {
        daysRange: 'D-7',
        treatment: '물광주사',
        reason: '자연스러운 빛남',
      },
    ],
    homeTip:
      '📸 HD 카메라는 피부를 그대로 담아요. 베이스 피부 케어가 제일 중요해요.',
  },
};

// Legacy English keys used elsewhere in the codebase map to Korean labels.
const ENGLISH_TO_KOREAN: Record<string, string> = {
  wedding: '웨딩',
  date: '데이트',
  graduation: '졸업',
  travel: '여행',
  photoshoot: '촬영',
  shoot: '촬영',
};

export function getEventConfig(eventType: string | null | undefined): EventConfig | null {
  if (!eventType) return null;
  const key = ENGLISH_TO_KOREAN[eventType] ?? eventType;
  return EVENT_CONFIG[key] ?? null;
}

export function getEventPlan(
  eventType: string | null | undefined
): EventConfigPlanPhase[] {
  const config = getEventConfig(eventType);
  return config?.plan ?? [];
}

// Parses a plan phase label into an inclusive D-day range.
// Returns null for non-day labels (예: '기내', '현지') — those are situational.
export function parsePhaseRange(
  label: string
): { from: number; to: number } | null {
  if (label.includes('당일') || label.includes('D-day')) return { from: 0, to: 0 };
  if (label.includes('전날')) return { from: 1, to: 1 };

  const rangeMatch = label.match(/D-(\d+)\s*~\s*D-(\d+)/);
  if (rangeMatch) {
    return { from: Number(rangeMatch[1]), to: Number(rangeMatch[2]) };
  }

  const beforeMatch = label.match(/D-(\d+)\s*이전/);
  if (beforeMatch) return { from: Number(beforeMatch[1]), to: 9999 };

  const innerMatch = label.match(/D-(\d+)\s*이내/);
  if (innerMatch) return { from: 0, to: Number(innerMatch[1]) };

  const afterMatch = label.match(/D-(\d+)\s*이후/);
  if (afterMatch) return { from: 0, to: Number(afterMatch[1]) };

  const singleMatch = label.match(/D-(\d+)/);
  if (singleMatch) {
    return { from: Number(singleMatch[1]), to: Number(singleMatch[1]) };
  }

  return null;
}

export type PhaseStatus = 'past' | 'current' | 'future' | 'informational';

export function phaseStatus(label: string, daysLeft: number): PhaseStatus {
  const range = parsePhaseRange(label);
  if (!range) return 'informational';
  if (daysLeft > range.from) return 'future';
  if (daysLeft < range.to) return 'past';
  return 'current';
}
