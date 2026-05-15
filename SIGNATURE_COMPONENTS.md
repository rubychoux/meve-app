# meve Signature Components Spec v1.0

**작성일:** 2026-05-13
**상태:** Claude Code 구현 baseline
**경로:** `meve-app/src/components/signature/`
**의존성:** `expo-linear-gradient`, `react-native-reanimated@3`, `expo-blur`, `react-native-svg`

이 문서는 meve의 *시그니처 컴포넌트* 6개를 어떻게 RN으로 만들지 정의합니다. 모든 화면이 이 컴포넌트들을 *조합해서* 만들어집니다. 한 번 만들면 *모든 화면이 자동으로 시그니처 톤 유지*.

---

## 1. `<DNACard />` — 시그니처 컴포넌트

타입별 그라데이션 + Glow Pulse + Shimmer Sweep + 시머 점들. 홈/스캔/DNA 결과/프로필 카드 모두에서 사용.

### Props

```ts
interface DNACardProps {
  /** 8 타입 코드 (그라데이션 결정) */
  typeCode: BeautyTypeCode; // 'GCS', 'MCS' 등
  /** 사이즈 변형 */
  size: 'mini' | 'compressed' | 'full';
  // mini       : 홈 미니 (높이 ~80px, 한 줄 정보)
  // compressed : 프로필 카드 헤더 (높이 ~120px)
  // full       : DNA 결과 화면 (aspect-ratio 3/4)
  
  /** 사용자 정보 */
  typeName: string;     // "Icy Glow"
  typeKr: string;       // "아이시 글로우"
  
  /** 옵션 */
  showShareButton?: boolean;  // mini에서 share 아이콘
  showDate?: string;          // "since 5.8"
  onPress?: () => void;
  onShare?: () => void;
}
```

### 구조

```
┌────────────────────────────────────────┐
│ [LinearGradient bg = type.gradient]    │
│                                        │
│  · 시머 점 4-5개 (pos absolute, 다른 │
│    delay로 깜빡임)                    │
│                                        │
│  · ShimmerSweep 컴포넌트 (좌→우 띠)   │
│                                        │
│  · SVG noise overlay (fractalNoise,   │
│    opacity 0.35, blend overlay)       │
│                                        │
│  · Content (위 layer):                │
│    - 상단: "GCS" (mono) + "meve"      │
│           (Fraunces Italic small)     │
│    - 중앙/하단: typeName               │
│           (Fraunces Italic Hero)      │
│           + typeKr (Pretendard Cap)   │
│                                        │
│  · GlowPulse outer shadow              │
└────────────────────────────────────────┘
```

### 사이즈별 스펙

| 사이즈 | 높이 | radius | title size | layout |
|--------|------|--------|------------|--------|
| mini | 80px | 20 | 28px Fraunces | row (text + share) |
| compressed | 120px | 24 | 26px Fraunces | row (text + chevron) |
| full | aspect 3/4 | 28 | 46px Fraunces | column (top meta + bottom title) |

### 컬러 (typeCode 기반)
- 그라데이션: `colors.types[typeCode].gradient`
- 텍스트 컬러: `colors.types[typeCode].text`

### 모션
- **Glow Pulse**: shadowOpacity 0 → 0.35 → 0 (3.5s 사이클)
- **Shimmer Sweep**: 흰 띠 좌→우 (3.5s 사이클)
- **시머 점**: 4-5개 위치, 각자 다른 delay (0, 1.2s, 2.5s, 0.8s)
- **시머 점 애니메이션**: opacity 0.3→1.0, scale 0.8→1.2 (4s 사이클)

### SVG Noise
- React Native에선 SVG filter `<feTurbulence>` 사용
- `react-native-svg`로 구현
- baseFrequency 0.9, numOctaves 2, opacity 0.08, blend "overlay"

---

## 2. `<GradientPill />` — CTA pill 버튼

시그니처 그라데이션 + Liquid Light + Shimmer Sweep + Glow Shadow. 메인 CTA에 사용.

### Props

```ts
interface GradientPillProps {
  label: string;          // "시작", "이대로 따라하기"
  onPress: () => void;
  
  /** 변형 */
  size?: 'sm' | 'md' | 'lg';  // sm=42px, md=52px, lg=58px (기본 md)
  fullWidth?: boolean;          // flex: 1 사용
  
  /** 우측 아이콘 (보통 → arrow) */
  iconRight?: 'arrow-right' | 'external-link' | 'arrow-down' | null;
  
  disabled?: boolean;
}
```

### 구조

```
┌──────────────────────────────────────┐
│ [LinearGradient 시그니처]            │
│  · Liquid Light animation (8s)       │
│  · ShimmerSweep band (4s)            │
│  · Label (Mystic Navy) + icon        │
└──────────────────────────────────────┘
  ↓ box-shadow (CTA glow)
```

### 스펙
- border-radius: 100 (full pill)
- bg: LinearGradient `colors.signatureGradient` (135°)
- text: `colors.mysticNavy`, typography.ctaPill
- shadow: `colors.ctaGlowShadow`
- animation: Liquid Light (gradient position) + Shimmer Sweep (overlay band)

### 사이즈
- sm: height 42, padding 14h
- md: height 52, padding 18h
- lg: height 58, padding 20h

---

## 3. `<GlassCard />` — Glass Morphism 카드

시그니처 화면 (DNA 결과, 스플래시 등) 전용. 일상 화면은 `<View />` solid card 사용.

### Props

```ts
interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
}
```

### 구조

```tsx
<BlurView intensity={20} tint="light" style={{
  backgroundColor: 'rgba(255,255,255,0.55)',
  borderColor: 'rgba(255,255,255,0.8)',
  borderWidth: 0.5,
  borderRadius: 20,
  padding: 16,
  ...style,
}}>
  {children}
</BlurView>
```

### 주의
- iOS BlurView 잘 작동, Android는 *살짝 약함*
- Android에서 안 보이면 backgroundColor opacity 올림 (0.75 정도)
- 일상 화면에서 이거 X — 솔리드 흰 카드 (`<View>` + bg pureWhite + border hairline)

---

## 4. `<PearlIcon />` — 진주 시그니처 아이콘

진주 + 시그니처 그라데이션 fill + 미세한 시머 점. 스캔 탭, 프로필 행, 기록 카드 등에서 사용.

### Props

```ts
interface PearlIconProps {
  variant: 
    // 스캔 탭 6개
    | 'trouble'      // 진주 + 트러블 점들
    | 'makeup'       // 두 진주 겹침 (블렌딩)
    | 'inspo'        // 액자 안의 진주
    | 'ingredient'   // 중앙 + 위성 4개 (분자)
    | 'face'         // 큰 타원 진주 + 미세 features
    | 'color'        // 세 컬러 진주 (베니다이어그램)
    // SKIN 프로필 행 3개
    | 'skinType'     // 진주 (네이비)
    | 'concern'      // 트러블 점들 (rose plum)
    | 'base'         // 글로우 진주 (라벤더)
    // LOOK 프로필 행 5개
    | 'faceShape'    // 타원
    | 'eyes'         // 눈
    | 'nose'         // 코
    | 'lips'         // 입술
    | 'brows'        // 눈썹
    // 메이크업 팁 행
    | 'shading'      // 쉐딩 (타원 + 음영)
    | 'eyeMakeup'    // 아이 메이크업
    | 'lipColor'     // 립 컬러
    | 'browTip'      // 눈썹 팁
    // 기록 카드
    | 'journey'      // 차트 라인
    | 'analysis'     // 막대 그래프
    | 'product';     // 제품 박스
  
  size?: number;  // 기본 44
  withFloat?: boolean;  // floatY 미세 모션
}
```

### 구조

각 variant마다 *고유한 SVG paths*. 공통:
- 그라데이션 fill (variant 따라 색)
- SVG `<filter>` noise overlay (펄 텍스처)
- 시머 점 1-2개 (작은 흰 원, 진주 하이라이트)
- 옵션: floatY 모션 (위아래 미세하게 떠다님, 4s)

### 컬러 매핑 (variant별)
- trouble: pinkLavender + rose 점들
- makeup: rosePlum (두 원 overlap)
- inspo: skyLavender + 액자 stroke
- ingredient: lavenderSky + 위성 진주들
- face: skyLavender + 미세 features
- color: 핑크 + 라벤더 + 스카이 세 원
- skinType: skyLavender solid 진주
- concern: pinkLavender + rose 점들
- base: lavenderSky + 글로우 점
- ... (전체 variant별 컬러 정의 필요)

---

## 5. `<ShimmerSweep />` — 모션 컴포넌트

흰 띠가 좌→우로 가로지르는 시머 효과. 카드 안에 absolute 배치.

### Props

```ts
interface ShimmerSweepProps {
  duration?: number;      // 기본 3500ms
  delay?: number;         // 시작 delay
  color?: string;         // 기본 'rgba(255,255,255,0.5)'
  width?: string;         // 기본 '30%'
}
```

### 구현 (react-native-reanimated)

```tsx
const translateX = useSharedValue(-150);

useEffect(() => {
  translateX.value = withRepeat(
    withTiming(250, { duration }),
    -1,
    false
  );
}, []);

const style = useAnimatedStyle(() => ({
  transform: [
    { translateX: `${translateX.value}%` },
    { skewX: '-15deg' },
  ],
}));

return (
  <Animated.View style={[
    {
      position: 'absolute',
      top: '-10%',
      left: 0,
      width: width || '30%',
      height: '120%',
      backgroundColor: 'transparent',
    },
    style,
  ]}>
    <LinearGradient
      colors={['transparent', color, 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    />
  </Animated.View>
);
```

---

## 6. `<GlowPulse />` — 모션 컴포넌트

DNA 카드 등 시그니처 컴포넌트 외부에 shadow opacity로 *숨쉬는* 글로우 효과.

### Props

```ts
interface GlowPulseProps {
  children: ReactNode;
  duration?: number;       // 기본 3500ms
  maxOpacity?: number;     // 기본 0.35
  shadowColor?: string;    // 기본 핑크
  shadowRadius?: number;   // 기본 30
}
```

### 구현

```tsx
const opacity = useSharedValue(0);

useEffect(() => {
  opacity.value = withRepeat(
    withSequence(
      withTiming(maxOpacity, { duration: duration / 2 }),
      withTiming(0, { duration: duration / 2 })
    ),
    -1,
    false
  );
}, []);

const style = useAnimatedStyle(() => ({
  shadowOpacity: opacity.value,
}));

return (
  <Animated.View style={[
    {
      shadowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowRadius,
      elevation: 8, // Android
    },
    style,
  ]}>
    {children}
  </Animated.View>
);
```

---

## 보조 컴포넌트 (필수는 아니지만 자주 사용)

### `<ShimmerDot />` — 떠있는 시머 점

```ts
interface ShimmerDotProps {
  top: string;       // 'top: 22%'
  left: string;      // 'left: 32%'
  size?: number;     // 2-4px
  delay?: number;
  color?: string;
}
```

opacity 0.3→1.0, scale 0.8→1.2 (4s 사이클, delay 다양).

### `<SignatureWashBg />` — 시그니처 화면 배경

DNA 결과 등 시그니처 화면 전체 배경. Liquid Light wash + 시머 점 3-5개.

```tsx
<SignatureWashBg>
  {/* 화면 콘텐츠 */}
</SignatureWashBg>
```

### `<GradientStrip />` — 카드 좌측 그라데이션 strip

홈 팁 카드 좌측 3px strip (이전 위젯에서 `tip-card::before`).

---

## 폴더 구조

```
meve-app/src/components/signature/
├── DNACard.tsx
├── GradientPill.tsx
├── GlassCard.tsx
├── PearlIcon.tsx            (variant 라우터)
├── pearl-variants/          (각 variant별 SVG)
│   ├── TroublePearl.tsx
│   ├── MakeupPearl.tsx
│   ├── ...
├── ShimmerSweep.tsx
├── GlowPulse.tsx
├── ShimmerDot.tsx
├── SignatureWashBg.tsx
├── GradientStrip.tsx
└── index.ts                 (re-export all)
```

---

## 구현 순서 (Claude Code 작업)

### Day 1 (셋업 + 시그니처 컴포넌트 3개)
1. Theme tokens 4파일 `meve-app/src/theme/`에 복사
2. Fraunces Italic 폰트 추가 — `expo-font` 로드 (assets/fonts/)
3. `<ShimmerSweep />` 만들고 시뮬레이터 테스트
4. `<GlowPulse />` 만들고 시뮬레이터 테스트
5. `<DNACard />` 만들고 다양한 사이즈 테스트

### Day 2 (모든 시그니처 컴포넌트)
6. `<GradientPill />` 다양한 사이즈
7. `<GlassCard />` + iOS/Android 테스트
8. `<ShimmerDot />` + `<SignatureWashBg />`
9. `<PearlIcon />` variant 5-6개 우선 (트러블, 메이크업, 인스포, 성분, 얼굴, 컬러)

### Day 3 이후 (화면별 변환)
10. 화면별 위젯 코드 → RN 변환 (시그니처 컴포넌트 조합으로 만듦)

---

## 핵심 원칙

1. **컬러는 *항상 theme에서 import*** — hardcode 절대 X
2. **타이포는 *항상 typography 토큰에서*** — fontSize 직접 지정 X
3. **검정 #1A1A1F CTA 절대 X** — Mystic Navy 또는 그라데이션 사용
4. **한글에 Fraunces 절대 X** — Pretendard만
5. **모션은 시그니처 화면에만** — 일상 화면은 Glow Pulse + Shimmer Sweep만 (Liquid Light X)
