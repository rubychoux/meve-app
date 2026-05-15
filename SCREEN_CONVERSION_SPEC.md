# meve V1 — Screen Conversion Spec (위젯 → RN)

> **목적**: 위젯으로 만든 12개 화면을 React Native로 변환할 때 *각 화면의 구조 + 사용 컴포넌트 + 카피*를 정확히 짚는 명세.

> **참고 문서:**
> - Linear MEVE-266 (디자인 시스템 v1.5 → RN 변환)
> - Linear 디자인 가이드 v1.5 (slug `c55bb293d0d5`)
> - 정보구조 v3 (slug `c5493f62757e`)
> - 창업 신념 (slug `c1a3c6617518`)
> - Theme 토큰: `colors.ts`, `typography.ts`, `spacing.ts`, `motion.ts`
> - 컴포넌트: `SIGNATURE_COMPONENTS.md`

---

## 작업 우선순위

### Phase 1 (시그니처 모먼트 — Day 3)
1. Splash
2. Onboarding 1-4
3. DNA 결과 화면

### Phase 2 (일상 화면 — Day 4)
4. 홈
5. SKIN 탭
6. LOOK 탭
7. 스캔 탭

### Phase 3 (디테일 화면 — Day 5)
8. 인스포 룩 분석 결과
9. 제품 디테일 페이지

### Phase 4 (Launch 후 — Soft Beta)
10. eve 탭
11. 마이페이지
12. AI 코치 채팅
13. 프로필 상세 페이지 (피부/얼굴)

---

## 공통 규칙 (모든 화면)

1. **배경**:
   - 시그니처 화면 (Splash, Onboarding, 분석 로딩, DNA 결과): `<SignatureWashBg />` (wash + Liquid Light + 시머 점)
   - 일상 화면 (홈, SKIN, LOOK, 스캔, eve, 마이, 제품 디테일): `colors.blushSnow` solid background

2. **카드**:
   - 시그니처 화면: `<GlassCard />`
   - 일상 화면: `<View>` + bg `colors.pureWhite` + border `colors.hairline` 0.5px

3. **CTA**:
   - 시그니처 화면: `<GradientPill />`
   - 일상 화면 메인 액션: `<GradientPill />` (강조)
   - 일상 secondary: Mystic Navy solid 14-16 radius

4. **상단**:
   - 시그니처 화면: 우상단 "건너뛰기" 또는 nav 없음
   - 일상 화면: `meve` 로고 (Fraunces Italic) + 🔔 + ✨ + 👤

5. **타이포 사용**:
   - 영문 큰 글씨 → Fraunces Italic (`typography.displayHero`, `displayMid`, `displayBrand`)
   - 영문 작은 라벨 → Fraunces Italic (`typography.displaySection`, `displaySmall`)
   - 한글 → Pretendard (`typography.headerTitle`, `cardTitle`, `body`, etc.)
   - **한글 + Fraunces 조합 절대 X**

---

## 화면 1: Splash

**파일**: `src/screens/Splash.tsx`
**Navigation**: 앱 진입 시 1.5-2초 후 자동 → Welcome 또는 (인증된 경우) Home

```
<SignatureWashBg>            // 메인 wash + 시머 점 6개
  <PearlReveal duration={1500}>
    <Text style={typography.displayHero}>meve</Text>
    <Text style={typography.displaySmall}>moment · me + eve</Text>
  </PearlReveal>
</SignatureWashBg>
```

- "meve": Mystic Navy `#2D3A6B`, 64pt
- "moment · me + eve": rgba(45,58,107,0.55), letter-spacing 0.25em, uppercase 톤
- 1.5초 후 fade-out → Welcome

---

## 화면 2-5: Onboarding 1-4

**파일**: `src/screens/Onboarding/index.tsx` (단일 화면 + page index state)
**Navigation**: Splash → Welcome → ... → DNA Scan

### 공통 구조

```
<SignatureWashBg variant="soft">       // wash 약간 옅게
  <StatusBar />
  <TopNav>
    <SkipButton onPress={skipToScan} />  // 우상단
  </TopNav>
  
  <Content>
    {/* 화면별 콘텐츠 */}
  </Content>
  
  <BottomArea>
    <PageDots active={currentPage} total={4} />
    <GradientPill 
      label={isLast ? "시작하기" : "다음"} 
      iconRight="arrow-right"
      onPress={isLast ? startScan : nextPage} 
    />
  </BottomArea>
</SignatureWashBg>
```

### Onboarding 1 — Welcome

**카피**:
- "meve" — Fraunces Italic 60pt, Mystic Navy, 중앙
- "나다운 아름다움," — Pretendard Light 17pt, ink
- "가장 정확하게" — Pretendard Light 17pt, ink

**레이아웃**: 중앙 정렬 (no visual). 텍스트만.

### Onboarding 2 — Beauty DNA

**카피**:
- 상단 eyebrow: "Beauty DNA" (Fraunces Italic 13pt, Mystic Navy 0.7 alpha)
- 메인: "셀카 한 장으로<br>나만의 뷰티 타입" (Pretendard Light 20pt)

**비주얼**: 8 타입 그리드 (asymmetric)
- *GCS Icy Glow* — 2x2 큰 카드 (좌상단), 그라데이션 + code + "Icy Glow" Fraunces Italic
- 나머지 7 카드 — 1x1 작은 카드, 각자 타입 그라데이션 + code + 이름
- 모든 카드 하단 어두운 그라데이션 오버레이 (텍스트 가독성)

```jsx
<DnaGrid>
  <DnaCard size="featured" typeCode="GCS" />  // 2x2
  <DnaCard size="small" typeCode="MCS" />
  <DnaCard size="small" typeCode="GWS" />
  <DnaCard size="small" typeCode="MCB" />
  <DnaCard size="small" typeCode="MWS" />
  <DnaCard size="small" typeCode="GCB" />
  <DnaCard size="small" typeCode="GWB" />
  <DnaCard size="small" typeCode="MWB" />
</DnaGrid>
```

### Onboarding 3 — D-day

**카피**:
- eyebrow: "D-day"
- 메인: "중요한 날 전에<br>필요한 모든 준비"

**비주얼**: Glass 카드 + Glow Pulse
```jsx
<GlassCard glowPulse>
  <Text style={typography.labelCap}>졸업식</Text>
  <Text style={typography.displayHero}>D − 25</Text>
  <Divider />
  <StageDots>
    <Stage dotState="done" label="D-30" />
    <Stage dotState="now" label="D-14" />   // 현재 단계 강조
    <Stage dotState="future" label="D-7" />
    <Stage dotState="future" label="D-1" />
  </StageDots>
</GlassCard>
```

### Onboarding 4 — Inspo Match

**카피**:
- eyebrow: "Inspo Match"
- 메인: "인스타에서 본 그 화장<br>나에게 맞는 제품으로"

**비주얼**: 인스포 사진 + 화살표 + 매칭 제품 3개

```jsx
<Stack>
  <InspoImage gradient />  // MCS 그라데이션 + shimmer
  <ArrowDown />
  <Row>
    <ProductMini swatch="lavender" match="96%" name="라벤더" />
    <ProductMini swatch="rose" match="95%" name="로즈 립" />
    <ProductMini swatch="glow" match="94%" name="베이스" />
  </Row>
</Stack>
```

**CTA**: "시작하기 →" (다음 X). DNA Scan 화면으로 navigation.

---

## 화면 6: DNA 결과

**파일**: `src/screens/DnaResult.tsx`
**Navigation**: DNA Scan 완료 후 진입

**구조**:
```
<SignatureWashBg>
  <TopNav>
    <BackButton />
  </TopNav>
  
  <DNACard size="full" typeCode={userType} />  // 시그니처 모먼트
  
  <ResultTags>쿨톤 · 글로우 · 소프트 · 건성</ResultTags>
  
  <SocialActions>
    <IconButton icon="camera" />
    <IconButton icon="chat" />
    <IconButton icon="download" />
    <IconButton icon="share" />
  </SocialActions>
  
  <GradientPill label="시작" iconRight="arrow-right" />
</SignatureWashBg>
```

- DNA 카드는 `size="full"` (aspect 3/4)
- 그라데이션 타입별 자동 (`colors.types[typeCode].gradient`)
- "Icy Glow" — Fraunces Hero, Mystic Navy
- 진주 점 4-5개, 시머 sweep, Glow Pulse 모두 활성

---

## 화면 7: 홈

**파일**: `src/screens/Home.tsx`
**위젯 참고**: `meve_all_screens_portfolio` #02

**구조**:
```
<Screen bgColor="blushSnow">
  <StatusBar />
  <TopBar>
    <Logo>meve</Logo>  // Fraunces displayBrand
    <Icons>
      <BellIcon notifDot />
      <AiCoachIcon />
      <AvatarIcon />
    </Icons>
  </TopBar>
  
  <DateRow>
    <Text>May 13, Wed</Text>  // Fraunces displaySmall
    <Text>졸업식 D-25</Text>  // Pretendard
  </DateRow>
  
  <ScrollView>
    {/* DNA 미니 카드 */}
    <DNACard size="mini" typeCode={userType} />
    
    {/* Today's Beauty 팁 */}
    <GradientStripCard>
      <Text>✨ Today, from meve</Text>
      <Text>아이시 글로우는 비타민C 세럼이 잘 맞아.</Text>
    </GradientStripCard>
    
    {/* D-day 케어 플랜 */}
    <DdayCard event="졸업식" daysLeft={25} stage={1} totalStages={3} />
    
    {/* SKIN + LOOK 미니 그리드 (2 columns) */}
    <Grid columns={2}>
      <MiniCard variant="skin" title="Skincare" subtitle="건성 · 5단계" />
      <MiniCard variant="look" title="Makeup" subtitle="쿨톤 · 글로우" />
    </Grid>
    
    {/* For You 가로 스크롤 */}
    <Section title="For You" subtitle="너에게 맞춘 제품">
      <HorizontalScroll>
        <ProductCard ... />
      </HorizontalScroll>
    </Section>
  </ScrollView>
  
  <TabBar active="home" />
</Screen>
```

---

## 화면 8: SKIN 탭

**파일**: `src/screens/SkinTab.tsx`
**위젯 참고**: portfolio #04

**핵심 컴포넌트**:
1. **피부 프로필 카드 (토글)** — 컴팩트 ↔ 펼침
   - 컴팩트: 타입명 + 한 줄 태그 (건성·모공·건조·글로우)
   - 펼침: 5 행 (피부타입, 피부 고민, 베이스, 컬러, 케어 우선순위) + 각자 진주 시그니처 아이콘 + "See full profile" 진입

2. **오늘의 루틴 카드 (메인)** — 5단계 진행 표시
   - "Today's routine" 헤더 + 5단계 카운트
   - 진행 dots (완료·다음·미진행)
   - "4단계 시작 →" CTA pill

3. **성분 카드** — 추천 성분 + 피해야 할 성분 + "자세히" 링크
4. **케어 플랜** — D-day 진입
5. **피부 기록 그리드** — 4x2 썸네일 (전후 사진)
6. **너에게 맞춘 스킨케어** — 카테고리 필터 (전체/세럼/크림/팩) + 2x2 그리드

---

## 화면 9: LOOK 탭

**파일**: `src/screens/LookTab.tsx`
**위젯 참고**: portfolio #05

SKIN과 *대칭 구조*, *Rose Plum 톤*:

1. **얼굴 프로필 카드 (토글)** — MCS 그라데이션 (E8C2CC→CFB5C2)
2. **너의 컬러 팔레트** — 6 swatch (Rose, Lavender, Sky, Pink, Mauve, MLBB)
3. **추구미 무드보드** — 현재 무드 + 변경 pill + 3개 무드 이미지
4. **오늘의 룩** — 그라데이션 이미지 + D-25 라벨
5. **맞춤 메이크업 팁** — 쉐딩/아이/립/눈썹 4 행 (각자 진주 아이콘)
6. **스타일 플랜** — AI 시술 추천 카드
7. **너에게 맞춘 메이크업** — 카테고리 필터 (전체/베이스/아이/립/치크/브로우) + 2x2 그리드

---

## 화면 10: 스캔 탭

**파일**: `src/screens/ScanTab.tsx`
**위젯 참고**: portfolio #03

**구조**:
- 헤더: "Scan / 뭘 스캔할까"
- **DNA 메인 카드** (시그니처 그라데이션, 큰): "뷰티 DNA 스캔 / 30초 · 셀카 한 장"
- "— or —" divider (Fraunces Italic)
- **6 서브 카드 그리드 (3x2)**:
  1. 트러블 (진주 + 핑크 점들)
  2. 메이크업 (두 진주 겹침, rose plum)
  3. 인스포 룩 (액자 + 진주)
  4. 성분 (분자 구조 — 중앙 + 4 위성)
  5. 얼굴 (큰 타원 진주)
  6. 컬러 (3 컬러 진주 — 핑크/라벤더/스카이)

각 카드: 진주 시그니처 아이콘 (44px) + 이름 (cardLabel)

---

## 화면 11: 인스포 룩 분석 결과

**파일**: `src/screens/InspoResult.tsx`
**위젯 참고**: 위젯 `meve_inspo_look_result_v2`

**구조**:
1. **상단 nav**: 뒤로 + "Inspo analysis" (Fraunces) + 북마크 + 공유
2. **인스포 이미지** (4:5 비율) + 시그니처 그라데이션 placeholder
   - 우상단 "94% 분석" pill
   - 하단 오버레이: "분석 결과 / 청순 글로우 룩 / 쿨톤 베이스..."
3. **AI 분석 노트** — 좌측 그라데이션 strip + "For you · 96% 매칭" + 텍스트
4. **5 요소별 카드** (베이스/아이/립/치크/눈썹):
   - 상단: 컬러 swatch + 요소 설명
   - 하단: 가로 스크롤 제품 3개 (매칭% + 매칭 근거 2줄)
5. **하단 CTA**: 좌측 저장 + 메인 "이대로 따라하기 →"

**Total 카드 없음** (사용자가 하나씩 사니까)

---

## 화면 12: 제품 디테일 페이지

**파일**: `src/screens/ProductDetail.tsx`
**위젯 참고**: 위젯 `meve_product_detail_v1`

**구조**:
1. **상단**: 플로팅 nav (반투명 흰 backdrop blur, 뒤로 + 북마크 + 공유)
2. **이미지 갤러리** (1:1, 5장 가로 스크롤, dot 인디케이터)
3. **제품 정보**: 브랜드 + 이름 + 별점 + 리뷰 수 + 가격 + 최저가
4. **Match 카드 (meve 시그니처)**:
   - 그라데이션 wash + shimmer
   - 큰 "96%" Fraunces Italic
   - 매칭 근거 3개 (✓ 쿨톤 · 아몬드눈 · 건성 만족도)
5. **AI 리뷰 요약**: 좌측 그라데이션 strip + "너와 비슷한 사람 173명 기준"
6. **리뷰 섹션**:
   - 필터 칩 (디폴트 "나와 비슷" 활성)
   - 개별 리뷰 카드 (작성자 DNA + 별점 + 텍스트 + 태그 + 매칭% pill)
7. **컬러 디테일 / Notes**: 비슷한 컬러 + 지속력 · 마감
8. **하단 CTA**: 좌측 + (루틴/룩 추가) + 메인 "구매하러 가기 →" (external link)

---

## 변환 시 주의 사항 (위젯 vs RN)

### CSS → RN 매핑

| CSS | RN |
|-----|-----|
| `background: linear-gradient(...)` | `<LinearGradient colors={[...]} start end>` from `expo-linear-gradient` |
| `backdrop-filter: blur(...)` | `<BlurView intensity={20} tint="light">` from `expo-blur` |
| `box-shadow` | `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius` (iOS) + `elevation` (Android) |
| `animation: ...` | `react-native-reanimated 3` (useSharedValue + useAnimatedStyle) |
| `<svg>` filter | `react-native-svg` `<Defs>` + `<Filter>` |
| `position: absolute` | `position: 'absolute'` |
| `box-sizing` | 자동 (border 포함) |
| `cursor: pointer` | `<Pressable>` 또는 `<TouchableOpacity>` |
| `text-transform: uppercase` | `textTransform: 'uppercase'` |
| `letter-spacing: 0.25em` | `letterSpacing: 3` (대략 fontSize × 0.25em) |

### 폰트 weight

위젯에서 `font-weight: 300` 같이 썼는데, RN에선 *폰트 파일별 weight 매핑*:
- Fraunces-LightItalic = weight 300
- Fraunces-Italic = weight 400
- Pretendard-Thin = weight 200
- Pretendard-Light = weight 300
- ...

`typography.ts` 토큰에 이미 정의됨. 직접 weight 지정 X.

### 모션 성능

- Liquid Light (background-position animation)는 RN에서 *expo-linear-gradient* + position 또는 *Skia*로 구현
- Glow Pulse는 *shadowOpacity* animation
- Shimmer는 *translateX* + skew transform
- *60fps 유지*가 우선. 안 되면 *간소화*.

### iOS vs Android 차이

- **BlurView**: iOS 잘 작동, Android 약함 → background opacity 올림
- **shadow**: iOS는 shadow*, Android는 elevation
- **letterSpacing**: 양 플랫폼 동일하지만 *폰트별 다르게 보임*. 시뮬레이터 테스트 필수.

---

## 끝나면 보고

각 화면 완성 후 *시뮬레이터 스크린샷*을 Choux한테 공유. 위젯과 비교해서 *차이 큰 부분* 짚어줘. *Choux가 retouch* 결정.

**우선순위**:
1. *시그니처 모먼트* (Splash, Onboarding, DNA 결과) — *첫 인상*이라 *디테일까지*
2. *일상 화면* (홈, SKIN, LOOK, 스캔) — *기능 작동*이 우선, *디자인은 후*
3. *디테일* (인스포 결과, 제품) — *데이터 연동* 우선

---

## Phase 4 화면 (Launch 후)

eve 탭, 마이페이지, AI 코치 채팅, 프로필 상세 페이지는 *Launch 후 디자인*. 지금 만들지 않음. Choux가 *위 12개 화면 끝나면* 다음 디자인 요청.
