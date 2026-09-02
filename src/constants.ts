/** 분석 기준 지점: 서울시청 (WGS84) */
export const SEOUL = {
  lng: 126.978,
  lat: 37.5665,
} as const;

/**
 * DEM 소스에 부여하는 고정 id. `sampleTerrainMostDetailed`가 SourceRef로
 * 문자열 id를 받으므로, 소스 핸들을 컴포넌트 간에 전달할 필요가 없다.
 */
export const TERRAIN_SOURCE_ID = "terrain-dem";

/** 관측자 눈높이 (m). 지형고 위에 더한다. */
export const EYE_HEIGHT_M = 1.7;

/**
 * 화면 표시용 시간대. 태양시는 경도 기준이라 KST와 다르다.
 * 서울(126.98°)은 KST 표준자오선(135°)보다 서쪽이므로 태양시가 약 32분 늦다.
 */
export const DISPLAY_TIME_ZONE = "Asia/Seoul";

/**
 * 초기 카메라: 서울 남쪽 상공에서 북쪽 도심을 내려다본다.
 *
 * 고도를 너무 낮게 잡으면 저줌 타일이 확대되어 흐릿한 화면이 오래 남는다.
 * 광역 조망 고도에서 시작해 사용자가 줌인하며 타일이 정제되도록 한다.
 */
export const INITIAL_CAMERA = {
  lng: SEOUL.lng,
  lat: SEOUL.lat - 0.25,
  height: 18000,
  heading: 0,
  pitch: -35,
  roll: 0,
} as const;
