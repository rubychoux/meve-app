// MEVE-256 — Event lens. Pure helpers that flip copy/context to a D-day frame
// when an event is set, and to neutral daily-mode copy when it isn't.

/**
 * 이벤트가 있으면 이벤트 맥락 텍스트, 없으면 base 그대로.
 */
export function getEventContextText(
  base: string,
  eventType: string | null | undefined,
  daysLeft: number | null | undefined
): string {
  if (!eventType || daysLeft == null) return base;
  if (daysLeft <= 0) return `${eventType} 당일 ${base}`;
  return `${eventType} D-${daysLeft}을 위한 ${base}`;
}

/**
 * 이벤트 이모지. 미지정/미매칭 시 ✨ / 🌟 fallback.
 */
export function getEventEmoji(eventType: string | null | undefined): string {
  if (!eventType) return '✨';
  const emojiMap: Record<string, string> = {
    웨딩: '💍',
    졸업: '🎓',
    여행: '✈️',
    데이트: '💕',
    화보: '📸',
    촬영: '📸',
    생일: '🎂',
    면접: '🏢',
  };
  return emojiMap[eventType] ?? '🌟';
}

/**
 * 홈 인사 영역에서 쓰는 D-day 단계별 응원 메시지.
 */
export function getEventFocusMessage(
  eventType: string | null | undefined,
  daysLeft: number | null | undefined
): string {
  if (!eventType || daysLeft == null) return '오늘도 빛나는 하루예요 ✨';
  const emoji = getEventEmoji(eventType);
  if (daysLeft <= 0) return `${emoji} 오늘이 바로 그날이에요!`;
  if (daysLeft <= 3) {
    return `${emoji} ${eventType}까지 D-${daysLeft}, 집중 케어 시작해요!`;
  }
  if (daysLeft <= 7) {
    return `${emoji} ${eventType}까지 일주일, 피부 마무리 단계예요`;
  }
  if (daysLeft <= 30) {
    return `${emoji} ${eventType}까지 D-${daysLeft}, 지금부터 관리해요`;
  }
  return `${emoji} ${eventType}을 위한 준비를 시작해봐요`;
}
