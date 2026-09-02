# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

[Navara](https://github.com/reearth/navara) 3D GIS 엔진을 검증하는 테스트 프로젝트입니다.
Navara의 강점인 **빛(light)과 비주얼라이제이션**을 최대한 끌어내는 것이 목표이며, 두 개의 데모를 만듭니다.

| 데모 | 내용 | 활용할 Navara 특성 | 상태 |
|------|------|--------------------|------|
| 일출 분석 | 관측 지점별 일출 가시성·방향·시각 분석 | 태양 위치 계산, 대기 산란, 지형 샘플링, PersonViewPlugin | 동작 (지점 선택, 태양시 슬라이더, 지형 차폐 판정, 현장 관람) |
| 불꽃놀이 분석 | 발사 지점 2곳의 야간 불꽃, 관측지 가시성 판정, 해당 지점에서 관람 | InstancedMesh, SelectiveBloom, 지형 샘플링, PersonViewPlugin | 동작 (지점별 시뮬레이션 + 지점별 가시성 + 캐릭터 배치) |
| 탐방 | 지도에서 지점을 골라 캐릭터를 배치하고 걸어다님 | PersonViewPlugin, 지형 collision, 피킹 | 동작 (클릭 배치 + 3인칭/1인칭 조작). **분석과 별개 축** |

세 데모는 `analysis/occlusion.ts`의 지형 차폐 계산을 공유한다 — "특정 방위의 지형이
목표보다 높이 솟았는가"라는 동일한 문제이기 때문이다. 불꽃놀이와 탐방은
`PersonViewPlugin`도 공유한다(App에서 하나만 만들어 내려보낸다).

**모드는 두 축이다.** 분석(일출/불꽃놀이)은 서로 배타적인 탭이고, 탐방은 그와 무관하게
켜고 끄는 토글이다 — 분석 패널을 띄워둔 채 현장을 걸어다닐 수 있다. UI에서도 두 그룹을
구분선으로 나누고, 패널은 `.panel-stack`에 세로로 쌓는다.

탐방 패널에서는 두 분석의 관측지로 바로 이동할 수 있다. 목록은 `Demos`가 양쪽
constants에서 모아 `destinations`로 넘기므로, `WalkDemo`는 어느 분석에서 온 지점인지
알 필요가 없다.

배경지도와 하늘(구름)은 데모와 무관한 씬 전체 설정이라 `Demos`가 상태를 들고 공유한다.

남은 과제: 일몰/박명 시각, 능선 프로파일 시각화, 지도 클릭으로 임의 지점 분석
(현재 일출은 목록 선택, 탐방은 클릭), 불꽃 폭발의 주변 조명(아래 11번 참고).

**중요: 이 리포지토리는 Navara를 *사용하는* 쪽입니다.** Navara 리포지토리의 README에 나오는
`cargo make dev`, `cargo make prepare`, `wasm-bindgen-cli` 설치 등은 **엔진 자체를 빌드**하는 명령이므로
이 프로젝트에는 해당하지 않습니다. 여기서는 npm 패키지로 배포된 Navara를 소비합니다.
(엔진 소스를 직접 수정·디버깅해야 하는 상황이 오기 전까지 Rust 툴체인은 불필요합니다.)

## Navara 개요

### 4-tier API

Navara는 기능을 4계층으로 제공하며, 필요한 만큼만 아래로 내려가는 것이 설계 의도입니다.
**가능한 한 위쪽 티어를 쓰고, 아래 티어는 필요할 때만 내려갑니다.**

1. **Declarative** — source/layer를 평범한 config 객체로 선언 (basemap, terrain, vector, 3D Tiles).
   mesh·effect·light도 동일하게 선언형으로 다룸.
2. **Plugin** — 완성된 기능 번들 (photorealistic scene, first-person walking, DOM 오버레이, attribution UI).
   직접 플러그인을 패키징해 공유 가능.
3. **API** — 속성 기반 피처 스타일링(`FeatureEvaluator`), 피처 피킹, **지형 샘플링**, 카메라 제어,
   맵 엔진 없이도 쓸 수 있는 측지/ECEF 수학 유틸리티.
4. **Shader** — 렌더링 엔진 전체 접근. 씬 그래프와 렌더 파이프라인에 대해 커스텀
   mesh/effect/light descriptor와 셰이더 작성.

### 내부 구조

렌더러 독립적인 **headless GIS core**입니다. 데이터 파싱·지오메트리 생성 등 재사용 가능한 GIS 로직은
**Rust / WebAssembly**에 있고, 그리기는 CG 렌더링 전문 라이브러리(현재 **Three.js**)에 위임합니다.
렌더링 레이어를 교체 가능하게 유지하는 것이 향후 다른 렌더러/플랫폼 확장의 근거입니다.

실무적 함의: **WASM과 Web Worker가 런타임에 포함**됩니다(`@navaramap/worker`).
번들러 설정에서 WASM 로딩과 워커 처리를 반드시 확인해야 하며, 이 부분이 초기 셋업의 주된 함정입니다.

### 패키지 (npm scope: `@navaramap`, 확인 시점 v0.1.1)

- **`@navaramap/three`** — Three.js 바인딩이자 **메인 진입점**. 보통 이것만 직접 설치.
  - 전이 의존: `@navaramap/core`, `engine`, `engine-api`, `three-api`, `three-csm`, `font`, `worker`
- `@navaramap/three-react` — React 바인딩
- `@navaramap/three-plugins`, `@navaramap/three-default-plugin`, `@navaramap/three-default-descs`

**peerDependencies (직접 설치해야 함):** `three >=0.183.0`, `postprocessing >=6.38.0`

### 두 데모에 직결되는 내장 의존성

`@navaramap/three`가 이미 아래를 품고 있습니다. **직접 구현하기 전에 이들이 노출하는 API를 먼저 확인하세요.**

- **`astronomy-engine`** — 태양/천체 위치 계산. *일출 분석의 핵심.* 별도 라이브러리 도입 불필요.
- **`@takram/three-atmosphere`** — 대기 산란. 일출의 하늘 색·태양광 표현.
- **`@takram/three-clouds`** — 구름
- **`@takram/three-geospatial-effects`** — 지리공간 포스트프로세싱 이펙트. *불꽃놀이 발광(bloom) 계열에 관련.*
- `@navaramap/three-csm` — Cascaded Shadow Maps. *지형 그림자 → 일출 가시성 판정에 관련.*

## Commands

| 목적 | 명령 |
|------|------|
| 설치 | `pnpm install` |
| 개발 서버 | `pnpm dev` |
| 빌드 | `pnpm build` (타입체크 후 vite build) |
| 타입체크 | `pnpm typecheck` |
| 빌드 미리보기 | `pnpm preview` |

린터·테스트 러너는 아직 도입하지 않았습니다. 테스트를 추가한다면 엔진에 의존하지 않는
`src/demos/sunrise/sun.ts`(구조적 타입만 사용), `src/demos/fireworks/particles.ts`,
`src/analysis/occlusion.ts`의 순수 함수들이 첫 대상으로 적합합니다.

## Stack

Vite + React 19 + TypeScript. 스택 선택은 Navara 본체와 맞춘 것입니다(pnpm).

## Structure

```
src/
  App.tsx          ViewProvider 설정 (canvas, plugins, shadow, animation)
  Demos.tsx        데모 전환 상태 — ViewProvider 내부에 위치
  constants.ts     서울 좌표, 초기 카메라
  scene/           BaseLayers(베이스맵+지형), basemaps.ts(배경지도 정의),
                   PhotorealScene(하늘/태양/AA 번들), Clouds.tsx(볼류메트릭 구름),
                   personView.ts(캐릭터 플러그인 생성)
  analysis/        occlusion.ts — 지형 차폐/가시선. 두 데모가 공유
  demos/sunrise/   SunriseAnalysis.tsx + sun.ts(시각 탐색) + constants.ts(관측 후보지)
  demos/fireworks/ FireworksAnalysis.tsx + FireworksScene.tsx(렌더) +
                   particles.ts(순수 시뮬레이션 — 폭발 형태 6종, 잔광, 분열) +
                   constants.ts(발사 지점·관측 후보지)
  demos/walk/      WalkDemo.tsx — 클릭 지점 또는 분석 지점 목록으로 캐릭터 배치·조작
  ui/              Panel, SceneControls(배경지도·구름 — 데모 공통)
```

## 구현 시 주의점 (실제로 부딪힌 것들)

1. **초기화 순서**: 플러그인은 `view.init()` 전에, source/layer/effect는 그 후에 등록해야
   합니다. `ViewProvider`가 `plugins` prop으로 전자를, init 완료 후에만 children을
   렌더링하여 후자를 보장합니다. `addDefaultPhotorealScene()`은 반드시 children 쪽에서
   호출합니다.

2. **StrictMode를 쓰지 않습니다**. `@navaramap/three-react` v0.1.1의 `ViewProvider`는
   `dispose`가 미구현(소스에 TODO)이라 이중 마운트 시 ThreeView를 재생성하지 못하고
   "You need to recreate ThreeView." 경고를 냅니다. 상위 버전에서 해결되면 되돌리세요.

3. **데모 전환 상태는 `ViewProvider` 안쪽에 둡니다**(`Demos.tsx`). 밖에 두면 Provider가
   리렌더되고, 초기화 effect의 의존성인 옵션 객체 신원이 매번 바뀌어 경고가 반복됩니다.

   **person view의 카메라 반납은 `Demos` 한 곳에서만 합니다.** 분석을 바꾸거나 탐방을
   끄면 `stop()`하고, 탐방 중에는 분석을 바꿔도 건드리지 않습니다. 각 패널이 자기
   언마운트에서 `stop()`하면 탐방과 분석이 서로의 카메라를 뺏는 경합이 생깁니다
   (패널의 "관람 종료" 버튼은 사용자가 직접 멈추는 별개 경로라 그대로 둡니다).

   같은 이유로 `WalkDemo`는 **켜지는 것만으로 카메라를 옮기지 않습니다.** 사용자가
   지도를 클릭한 시점부터 시점을 가져갑니다.

4. **지형은 Re:Earth Terrain(quantized-mesh)** 을 씁니다. 고른 이유는
   **워터마스크(`requestWaterMask`)를 제공하기 때문**입니다 — 수면을 반사 재질로
   처리하려면 이 확장이 필요한데 raster-dem 계열(Terrarium/AWS)에는 없습니다.
   렌더와 분석이 같은 지형을 봐야 하므로 소스는 하나만 두고
   `sampleTerrainMostDetailed`도 이것을 샘플링합니다(maxZoom 14).

   덤으로 정확도도 좋아졌습니다: 안산 봉수대 268 → 297m(실제 295.9m), 용마산 337 →
   351m(실제 348m). 도심 건물 혼입도 줄어 서울시청 일출 지연이 +17분 → +6분이 됐습니다.
   (Navara 문서 예제의 `JAPAN_GSI_ELEVATION_DECODER`는 일본만 덮어 한국에서는 못 씁니다.)

   베이스맵은 `scene/basemaps.ts`에 정의하고 UI에서 전환합니다(위성 / S2 / 일반).
   기본값은 **Esri World Imagery**(위성)이고, 키가 필요 없고 CORS가 열려 있습니다.

   **S2 = EOX Sentinel-2 cloudless 2024**(WMTS). 구름 없는 합성 영상이라 색이 균일하고
   야간 씬에 깔끔합니다. 다만 (a) Sentinel-2 지상 해상도가 10m라 `maxZoom`이 15이고
   그 이상은 확대만 됩니다, (b) **무료 서비스라 속도 제한이 있습니다** — 타일을 많이
   한꺼번에 요청하면 지연되거나 503이 돌아옵니다(실측: 24장 버스트가 9초, 엔진의
   피라미드 로딩 중 일부 503). 화면은 결국 채워지지만 초기 로딩이 Esri보다 느립니다.
   URL이 쿼리스트링 형태(`?...&TileMatrix={z}&TileCol={x}&TileRow={y}`)여도 정상
   동작합니다.
   **URL 순서가 `{z}/{y}/{x}`로 흔한 `{z}/{x}/{y}`와 뒤바뀌어 있으니** 주의하세요.
   서울 기준 z19까지 실제 영상이 오고 z20은 빈 타일입니다.

   전환은 **소스를 다시 등록하지 않고 레이어가 참조하는 소스 id만 바꿉니다.**
   소스는 등록만으로 타일을 받지 않고 레이어가 참조할 때 받으므로, 후보를 전부
   미리 등록해 두면 됩니다(`SourceRef`는 핸들뿐 아니라 id 문자열도 받습니다).
   attribution은 `add`/`remove`가 구조적 매칭이라 effect cleanup으로 정확히
   교체됩니다.

5. **three는 단일 인스턴스여야 합니다.** `vite.config.ts`의 `resolve.dedupe`로 고정합니다.
   `optimizeDeps.exclude`로 Navara 패키지를 제외하면 오히려 three가 이중 로드됩니다.

6. **첫 화면이 15~20초간 비어 보이는 것은 정상입니다.** WASM(약 4.6MB) + 대기 산란
   텍스처 + 타일을 받는 시간입니다. 흰 지면만 보인다고 설정 오류로 단정하지 마세요.

7. **태양시 ≠ KST.** `setSolarTime`/`getSolarTime`은 경도 기준 진태양시입니다. 서울은
   KST 표준자오선보다 서쪽이라 약 32분 늦습니다. 사용자에게 보여줄 시각은
   `atmosphere.date`를 `Asia/Seoul`로 포맷하세요.

8. **`atmosphere.sunDirection`은 렌더 프레임에서만 갱신됩니다.** `setSolarTime`으로
   시각을 바꿔도 방위각은 직전 프레임 값에 고정되고 고도만 바뀝니다. 프레임 없이
   도는 동기 탐색 루프에서 쓰면 **조용히 틀린 결과**가 나옵니다(에러도 경고도 없음).
   방위각이 필요하면 `astronomy-engine`으로 `atmosphere.date`에서 직접 계산하세요
   (`occlusion.ts`의 `sunAzimuthDeg`). 엔진 자체가 쓰는 라이브러리라 값이 일치하며,
   중복 설치를 피하려고 버전을 2.1.19로 맞춰 직접 의존성에 넣었습니다.

9. **`sampleTerrainMostDetailed`의 비용은 좌표 수가 아니라 콜드 타일 페치 수입니다.**
   측정값: 동일한 500개 좌표가 콜드 23초 → 캐시 54ms. 넓은 범위를 훑을 때는
   `options.level`로 낮은 줌을 고정하세요. 차폐 판정은 level 12(약 30m/px)로 충분하며
   1.7초에 끝납니다. maxZoom인 14를 쓰면 타일 수가 수십 배로 늘어 수 분이 걸립니다.

10. **전역 DEM은 도심에서 건물이 일부 섞입니다.** Terrarium(SRTM 계열)일 때 특히
    심해서 서울시청 일출이 +17분 지연으로 나왔습니다. Re:Earth Terrain으로 바꾼 뒤
    +6분으로 줄었지만 완전히 사라지지는 않습니다. 근거리 차폐가 지형이 아니라 건물일
    수 있다는 점은 여전히 감안하세요.

11. **인스턴스별 발광은 불가능합니다.** `SphereChildConfig.color`는 diffuse에만
    곱해지는데, 야간 씬에는 비출 광원이 없어 아무 효과가 없습니다. 실제로 보이는 것은
    `emissiveColor`/`emissiveIntensity`인데 둘 다 메시 단위 공유입니다.

    그래서 `FireworksScene`은 **색 × 밝기 단계 조합마다 메시를 하나씩** 만들고
    (6색 × 3단계 = 18개), 입자가 나이 들면 그 프레임의 인스턴스를 더 어두운 메시로
    옮깁니다. 이렇게 해야 크기 축소가 아니라 실제 감광으로 소멸을 표현할 수 있습니다.
    메시 수는 늘지만 전부 인스턴싱이라 draw call만 늘고 인스턴스 총량은 그대로입니다.

12. **기본 Descriptor에 PointLight가 없습니다** (`DefaultLightDescription`은 SunLight /
    SkyLightProbe / AmbientLight / LightProbe뿐). 그래서 폭발 지점에서 뻗어나가는
    **방향성** 조명은 만들 수 없고, `FireworksScene`은 **AmbientLight의 색·세기를 매
    프레임 조절해** 근사합니다 — 터질 때 야경 전체가 그 색으로 번쩍이는, 실제로 가장
    눈에 띄는 부분입니다. 방향성이 꼭 필요하면 Shader 티어에서 커스텀 라이트
    Descriptor를 쓰거나 `LightProbe`의 SH 계수를 직접 채워야 합니다.

    조명 세기는 **기저광과 섬광을 따로 합산**해야 합니다. 한 덩어리로 더하면 살아있는
    입자 수백 개의 기저값이 커서 상한에 상시 붙고(실측 67% 프레임) 정작 터지는 순간의
    번쩍임이 묻힙니다. 분리 후에는 기저 0.08~0.14, 섬광 0.39로 약 4배 폭이 납니다.

    `LightConfig`는 전부 선택 속성인 weak type이라 `{ ambient: ... }`만 넘기면
    "no properties in common" 타입 에러가 납니다. `id`를 함께 주세요.

13. **`preRender`는 렌더 직전에만 emit됩니다.** 연속 애니메이션에는 `ViewProvider`에
    `animation`이 필요합니다(없으면 변화가 있을 때만 렌더).

    그리고 **숨겨진 탭에서는 requestAnimationFrame이 0회/초**라 프레임 자체가 돌지
    않습니다(`document.visibilityState`로 확인). 프레임이 없으면 애니메이션뿐 아니라
    **카메라 행렬도 갱신되지 않아 화면 좌표 → 지도 좌표 피킹이 축퇴된 값을 돌려주고**
    (`click` 이벤트의 `map`이 남극으로 나옴), `camera.positionGeographic`은
    "Invariant failed"로 던집니다. 브라우저 자동화 테스트에서 이런 증상이 보이면
    코드가 아니라 이것부터 의심하세요. 검증은 시뮬레이션을 수동으로 step시키거나
    좌표를 직접 주입한 뒤 스크린샷으로 한 프레임을 유도하는 식으로 우회합니다.

14. **Navara의 `Color`는 three의 Color가 아닙니다.** `@navaramap/three`가 자체 Color를
    export하며(sRGB/선형 변환이 명시적) 인자 있는 생성자가 없습니다.
    `new Color().setStyle("#ff5964")` 형태로 만드세요. three의 Color를 넘기면 타입 에러가
    납니다.

15. **개별 Descriptor 타입이 필요하면 `@navaramap/three-default-descs`를 직접
    의존성에 추가해야 합니다.** `@navaramap/three-default-plugin`이 전이 의존으로 갖고
    있지만 pnpm에서는 직접 import할 수 없습니다.

16. **`PersonViewPlugin`은 `view.init()` 전에 등록해야 하지만 배치는 이후에 합니다.**
    App에서 생성해 `ViewProvider`의 `plugins`로 넘기고, 실제 위치는 `teleport()` +
    `start()`로 정합니다(`startLng`/`startLat`는 생성자 전용이라 나중에 못 바꿉니다).
    `stop()`은 카메라와 키 입력만 반납하며 **모델은 놓인 자리에 그대로 남습니다** —
    다른 데모로 전환해도 캐릭터는 사라지지 않습니다.

    캐릭터 모델은 init 단계에서 받아오므로 **모델 URL이 죽으면 view 초기화 자체가 실패해
    앱 전체가 뜨지 않습니다.** 현재는 Khronos glTF Sample Assets의 Fox를
    raw.githubusercontent.com에서 직접 받습니다(CORS `*`). 운영에 쓸 때는 로컬 자산으로
    옮기세요.

17. **캐릭터 배치 시 조준각은 분석값이 아니라 캐릭터 눈높이에서 다시 계산합니다.**
    collision이 `ground`라 캐릭터는 지형 표면에 붙으므로, 관측 높이를 크게 잡은 지점
    (남산 N서울타워 전망대 = 지형 + 135m)은 분석 관측점과 높이가 다릅니다. 실제로
    표의 고도각은 −0.4°(전망대에서 내려다봄)인데 캐릭터 기준으로는 +0.98°(올려다봄)가
    나옵니다. `sightTarget()`으로 다시 계산해 `setFpvPitch(-elevation)`에 넘깁니다
    (fpvPitch는 양수가 아래를 향하므로 부호를 뒤집습니다).

18. **화면 클릭 → 지도 좌표는 `click` 이벤트의 `event.map`(ECEF)입니다.** 엔진은
    `clientX/clientY`에서 캔버스 rect를 빼 계산합니다. 이 값은 **타원체 표면** 교점이라
    지형 고도가 아니므로, 캐릭터를 지면에 놓으려면 위경도로 변환한 뒤
    (`vector3ToGeodetic`) `sampleTerrainMostDetailed`로 표고를 따로 구해야 합니다.

19. **관측 지점 좌표는 이름만 보고 넣지 말고 표고·능선 고도를 확인하세요.**
    아차산 해맞이광장을 눈대중 좌표로 넣었더니 능선 아래라 동쪽 능선 고도가 18°,
    일출 지연이 +89분으로 나왔습니다(실제로는 동쪽이 트인 해맞이 명소). 용마산도
    표고 167m(정상은 348m), 하늘공원도 70m(정상 약 100m)로 사면을 찍고 있었습니다.
    `sampleTerrainMostDetailed`로 주변을 격자 샘플링해 정상을 찾는 편이 확실합니다.
    하늘공원은 이 오차 때문에 옆 노을공원 언덕에 가려 "가림"으로 잘못 나왔습니다 —
    좌표가 조금만 어긋나도 판정이 뒤집힙니다.

20. **관측점이 주변보다 높으면 능선 고도가 음수가 되고, 그때 일출은 수평선 기준보다
    이릅니다.** `findSunriseOverTerrain`이 처음에는 수평선 일출 시각부터 앞으로만
    훑어서 이 경우를 놓치고 "능선에 계속 가림"으로 잘못 보고했습니다(안산 봉수대,
    능선 −0.07°). 지금은 `searchBackHours`만큼 이전부터 탐색하며, 지연이 음수로도
    나올 수 있으므로 표기 시 부호를 처리해야 합니다.

21. **구름은 `addDefaultPhotorealScene()`에 포함되지 않습니다.** `CloudsConfig`
    이펙트를 따로 추가해야 하며(`scene/Clouds.tsx`), 구름 양은 `clouds.coverage`
    (0~1)입니다. 품질은 `qualityPreset`: `low | medium | high | ultra`.

    **구름을 비추는 광원은 태양뿐입니다.** 밤에는 순흑으로 렌더되어, 별을 켜기 전에는
    검은 하늘과 구분되지 않다가 별이 생기면 "구름이 사라지고 그 자리만 별이 없는" 것처럼
    보입니다(구름은 그대로 있고 하늘을 가리고 있을 뿐 — coverage 95%로 올리면 별이 거의
    다 사라집니다). `Clouds`는 해가 지면 `skyLightScale`·`groundBounceScale`을 올려
    달빛·도시광을 받은 회색으로 보이게 합니다.

    레이마칭이라 프레임 비용이 큽니다. coverage가 0이면 세기만 0으로 두지 말고
    **이펙트를 언마운트**해 패스 자체를 파이프라인에서 빼세요. 그리고 화면은
    **여러 프레임에 걸쳐 수렴**합니다(블루노이즈 시간 누적) — 한 프레임만 렌더되는
    상황(숨겨진 탭 스크린샷 등)에서는 얼룩덜룩하게 보이는 것이 정상입니다.
    텍스처(`local_weather.png`, `shape.bin`, `stbn.bin` 등 약 4MB)는 이펙트를 처음
    켤 때 받아옵니다.

22. **밤하늘의 별·달은 노출을 올려야 보입니다.** 엔진 기본 `toneMappingExposure`는 1이라
    밤이 거의 검게 나옵니다. `PhotorealScene`이 **태양 고도에 따라 노출을 자동으로**
    옮깁니다(낮 1 → 천문박명 이하에서 `nightExposure`). 별은 `stars.intensity`를 크게
    올려야 하고(기본값으로는 노출을 올려도 거의 안 보임), 달은 기본으로 켜져 있고 위상도
    날짜에 맞춰 정확히 그려지지만 시직경이 약 0.5°라 `moonScale`을 키워야 눈에 띕니다.

    **야간 노출은 씬마다 달라야 합니다.** 불꽃놀이처럼 발광체가 많은 씬에 별을 위한 높은
    노출(25)을 쓰면 폭발이 전부 하얗게 포화됩니다(실측: 4에서 이미 형태가 뭉개짐).
    그래서 `nightExposure`를 prop으로 두고 불꽃놀이만 1.8을 씁니다.

23. **물 반사는 두 조각이 다 있어야 합니다.** 수면 자체는 **지형 소스의 워터마스크**가
    만들고(quantized-mesh + `requestWaterMask: true`), 비칠 상은 **SSR 이펙트**
    (`{ ssr: {} }`)가 그립니다. 하나만 있으면 물이 밋밋하거나(마스크만) 비칠 것이
    없습니다(SSR만). 지형 재질(`TerrainMaterial`)에는 물 관련 옵션이 없습니다 —
    마스크가 있으면 엔진이 알아서 반사 재질로 처리합니다.

    **SSR은 고고도 광역 시점에서 화면 전체를 어둡게 만듭니다.** 수면 가까이(수백 m)에서는
    정상이지만, 12km 상공에서는 지형은 물론 하늘까지 어두운 남색으로 덮입니다. 그래서
    **기본값을 off**로 두었습니다 — 수면을 볼 때만 켜세요. 화면이 갑자기 어두워지면
    이것부터 의심하면 됩니다. 원인 미규명이며, `maxRayDistance`/`blendMode`/
    `coneTracingMaxDistance` 조정이나 고도 기반 자동 해제가 후속 과제입니다.

## 알려진 이슈

- 콘솔에 `THREE.WARNING: Multiple instances of Three.js being imported.`가 남아 있습니다.
  `resolve.dedupe` 적용 후에도 사라지지 않으며, 렌더링에는 지장이 없는 것으로 확인했습니다.
  원인 미규명 — 셰이더/머티리얼 관련 이상이 생기면 이것부터 의심하세요.

## Environment

- 개발 환경은 **Windows**입니다. 셸 명령은 PowerShell 문법 또는 크로스 플랫폼 호환 형태로 제시하세요.
- 경로 구분자와 줄바꿈(CRLF/LF) 차이에 주의합니다.

## References

- 리포지토리: https://github.com/reearth/navara (Apache-2.0 / MIT 듀얼 라이선스)
- 문서: https://navara.world/docs/
- 예제: https://navara.world/examples/ — 데모 구현 전 유사 예제를 먼저 확인할 것

## Repository state

- `.gitignore`는 Node/TypeScript 기준으로 작성되어 있습니다.
- `.bkit/`은 bkit 플러그인의 **로컬 도구 상태**이며 전체가 gitignore 대상입니다.
  머신 종속 절대경로를 담고 세션마다 재작성되므로 커밋하지 마세요.
  주의: 현재 내용은 **다른 프로젝트**(`forest-digital-platform-frontend`)에서 넘어온 이력이라
  이 리포지토리와 무관합니다. bkit이 세션 시작 시 엉뚱한 이전 작업(`viewshed`) 재개를 제안할 수 있으니 무시하세요.
