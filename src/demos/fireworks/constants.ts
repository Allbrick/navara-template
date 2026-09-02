/**
 * 서울세계불꽃축제(여의도 한강공원)를 상정한 값들.
 *
 * 좌표와 고도는 대략치입니다. 실제 행사 데이터가 있으면 이 값만 바꾸면 되고,
 * 분석 로직은 그대로 동작합니다.
 */

/** 발사 지점 — 여의도 앞 한강 수상 바지선 부근 */
export const LAUNCH_SITE = {
  lng: 126.935,
  lat: 37.5245,
} as const;

/** 수면 표고 (m). 한강 수면은 해발 0에 가깝다. */
export const LAUNCH_BASE_HEIGHT_M = 5;

/** shell이 터지는 고도 (지표 기준 m) */
export const BURST_HEIGHT_M = 350;

/** 관측 후보지. 여의도 불꽃축제의 실제 인기 관람 지점들. */
export type Viewpoint = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** 지형 표고 위에 더할 관측 높이 (m). 전망대·건물이면 크게 잡는다. */
  eyeOffsetM: number;
};

export const VIEWPOINTS: Viewpoint[] = [
  { id: "yeouido", name: "여의도 한강공원", lng: 126.9345, lat: 37.5285, eyeOffsetM: 1.7 },
  { id: "nodeul", name: "노들섬", lng: 126.9585, lat: 37.5175, eyeOffsetM: 1.7 },
  { id: "ichon", name: "이촌 한강공원", lng: 126.9695, lat: 37.5175, eyeOffsetM: 1.7 },
  { id: "seonyudo", name: "선유도공원", lng: 126.8975, lat: 37.5443, eyeOffsetM: 1.7 },
  { id: "haneul", name: "하늘공원", lng: 126.8785, lat: 37.571, eyeOffsetM: 1.7 },
  { id: "eungbong", name: "응봉산 팔각정", lng: 127.0296, lat: 37.5477, eyeOffsetM: 1.7 },
  { id: "namsan", name: "남산 N서울타워 전망대", lng: 126.9882, lat: 37.5512, eyeOffsetM: 135 },
];

/** 불꽃 메시를 선택적 블룸에 묶기 위한 effect id. */
export const BLOOM_EFFECT_ID = "fireworks-bloom";
