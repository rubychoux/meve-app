# Claude Code 프롬프트 — meve 디자인 시스템 v1.5 RN 구현

> **사용법**: 이 파일 전체를 Claude Code에 *한 번에* 복붙하세요. 
> 첨부할 파일: `meve-theme-v1.5/` 폴더 전체 (colors.ts, typography.ts, spacing.ts, motion.ts, index.ts, SIGNATURE_COMPONENTS.md)

---

## 너의 작업

meve 앱의 *디자인 시스템 v1.5*를 React Native로 구현해줘. 

위젯으로 만든 디자인을 *7개 화면*에 적용할 거고, 그 *기반*이 되는 *디자인 토큰 + 시그니처 컴포넌트*를 먼저 만든다. **이번 세션에서는 *Step 1-3*까지만 해.** 화면별 변환은 다음 세션이야.

**참고 문서:**
- Linear: MEVE-266 (디자인 시스템 v1.5 → React Native 코드 변환)
- 첨부된 `SIGNATURE_COMPONENTS.md` (시그니처 컴포넌트 6개 구현 명세)

---

## Step 1 — Theme Tokens 적용

첨부된 5개 파일을 `meve-app/src/theme/` 에 복사:

- `colors.ts` — v1.5 (blushSnow, mysticNavy, rosePlum, 시그니처 그라데이션, 8타입, functional)
- `typography.ts` — Pretendard + Fraunces Italic 토큰
- `spacing.ts` — spacing, radius, border
- `motion.ts` — Liquid Light, Glow Pulse, Shimmer 타이밍
- `index.ts` — single import

기존에 있던 v1.1 토큰 파일이 있다면 *백업 후* 새 파일로 교체. 

**확인**: 다음 import가 작동하는지 테스트:
```ts
import { colors, typography, spacing, radius, motion } from '@/theme';
```

---

## Step 2 — Fraunces 폰트 추가

1. Google Fonts에서 Fraunces 다운로드: https://fonts.google.com/specimen/Fraunces
   - **Light Italic (300)** — `Fraunces-LightItalic.ttf`
   - **Italic (400)** — `Fraunces-Italic.ttf`
   - 위 두 가지 *만* 받으면 됨. 다른 weight 필요 X.

2. `meve-app/assets/fonts/` 폴더에 두 파일 추가.

3. `App.tsx`의 `useFonts()` hook에 추가:
```ts
const [fontsLoaded] = useFonts({
  // ... 기존 Pretendard 폰트들
  'Fraunces-LightItalic': require('./assets/fonts/Fraunces-LightItalic.ttf'),
  'Fraunces-Italic': require('./assets/fonts/Fraunces-Italic.ttf'),
});
```

4. 시뮬레이터에서 *테스트 텍스트*로 폰트 로드 확인:
```tsx
<Text style={typography.displayHero}>Icy Glow</Text>
<Text style={typography.headerTitle}>스킨케어</Text>
```

→ "Icy Glow"는 *Fraunces Italic*, "스킨케어"는 *Pretendard*로 나와야 함.

---

## Step 3 — 시그니처 컴포넌트 구축

`meve-app/src/components/signature/` 폴더에 다음 순서로 만들어. 첨부된 `SIGNATURE_COMPONENTS.md`에 *각 컴포넌트 명세* 있음. 정확히 따라.

### 3.1. `<ShimmerSweep />` (모션 toolkit, 먼저!)
- 다른 컴포넌트가 이걸 사용함
- `react-native-reanimated 3` 사용
- 시뮬레이터에서 *흰 띠가 좌→우로 흐르는지* 확인

### 3.2. `<GlowPulse />` (모션 toolkit)
- `shadowOpacity` 애니메이션 (0 → 0.35 → 0)
- 시뮬레이터에서 *주변이 숨쉬듯 빛나는지* 확인

### 3.3. `<ShimmerDot />` (보조 컴포넌트)
- 작은 흰 점이 깜빡 (opacity + scale)
- 다양한 delay 가능하게 prop

### 3.4. `<DNACard />` (메인 시그니처 컴포넌트)
- `mini` / `compressed` / `full` 3가지 사이즈
- props: `typeCode`, `typeName`, `typeKr`, `size`, `onPress` 등
- 내부에 ShimmerSweep + GlowPulse + ShimmerDot 4-5개 조합
- 그라데이션은 `colors.types[typeCode].gradient`
- 텍스트는 `colors.types[typeCode].text`
- 시뮬레이터에서 3가지 사이즈 다 *위젯이랑 비교*

### 3.5. `<GradientPill />` (CTA 버튼)
- 시그니처 그라데이션 배경 (Liquid Light 모션)
- 내부 ShimmerSweep band
- shadow: `colors.ctaGlowShadow`
- sm/md/lg 3 사이즈
- 시뮬레이터에서 *진짜 부드럽게 흐르는지* 확인

### 3.6. `<GlassCard />`
- `expo-blur` BlurView 사용
- iOS와 Android *둘 다 테스트*
- Android에서 약하면 `backgroundColor` opacity 올려

---

## 핵심 규칙 (반드시 따라야 함)

1. **컬러 hardcode 절대 X** — 항상 `colors.xxx` import해서 사용
2. **fontSize 직접 지정 X** — 항상 `typography.xxx` style 사용
3. **검정 `#1A1A1F` CTA 절대 X** — Mystic Navy 또는 그라데이션
4. **한글에 Fraunces 절대 X** — Pretendard만
5. **TypeScript strict mode** — `any` 타입 피하기

---

## 의존성 (이미 설치되어 있어야 함)

```json
{
  "expo-linear-gradient": "*",
  "react-native-reanimated": "^3",
  "react-native-svg": "*",
  "expo-blur": "*",
  "expo-font": "*"
}
```

설치 안 되어 있으면 먼저 설치.

---

## 작업 끝나면

각 컴포넌트 시뮬레이터에서 테스트 후, *테스트 화면*을 하나 만들어서 *모든 시그니처 컴포넌트*를 한 번에 보여줘:

```
meve-app/src/screens/_DebugSignatureScreen.tsx
```

이 화면에:
- DNACard mini/compressed/full 3개
- GradientPill sm/md/lg 3개
- GlassCard 1개 (시그니처 wash 배경 위)
- ShimmerDot 5개 (다양한 위치)

이 화면을 시뮬레이터에서 보고 *위젯과 비교*. 차이점 있으면 디테일 조정.

---

## 작업 시간 예상

- Step 1-2 (Theme + 폰트): 1-2시간
- Step 3.1-3.3 (모션 toolkit): 1-2시간
- Step 3.4 (DNACard): 2-3시간 (가장 복잡)
- Step 3.5-3.6 (Pill + Glass): 1-2시간
- 디버그 화면 + 시뮬레이터 테스트: 1시간

**총 1-2일 작업**

---

## 끝난 후 보고

작업 완료되면 다음 형식으로 보고:

```
✅ Theme tokens 적용 완료
✅ Fraunces 폰트 로드 완료 (시뮬레이터 확인)
✅ 시그니처 컴포넌트 6개 구축 완료
   - ShimmerSweep ✓
   - GlowPulse ✓
   - ShimmerDot ✓
   - DNACard (3 sizes) ✓
   - GradientPill (3 sizes) ✓
   - GlassCard ✓
✅ DebugSignatureScreen 만들어서 시뮬레이터에서 모든 컴포넌트 확인

[발견한 이슈 또는 차이점]:
- (있다면 여기에 — 예: Android BlurView 약함, 어떤 컬러 약간 다름 등)
```

이걸 *Choux한테 그대로 보고*하면 다음 세션에서 화면별 변환 시작.

---

## 다음 세션 (이번엔 안 함)

화면별 RN 변환:
1. DNA 결과 화면
2. 홈 화면
3. 스캔 탭
4. SKIN 탭
5. LOOK 탭
6. 인스포 룩 분석 결과
7. 제품 디테일 페이지

이 화면들은 위 시그니처 컴포넌트 *조합*으로 만들어. *이번 세션*에선 *컴포넌트 만들기만* 집중.

---

## 질문 있으면

질문 있으면 *시작 전에* 물어봐. 진행 중에 *애매한 디테일*이 있으면 *내 판단으로 결정*하지 말고 *Choux한테 물어봐*. 

특히:
- 컬러 어떻게 보이는지
- 모션 속도 적당한지
- iOS vs Android 차이

이런 건 *시뮬레이터에서 *보면서* 판단*해야 함.

Now start.
