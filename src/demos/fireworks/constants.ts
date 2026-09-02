/**
 * 서울세계불꽃축제(여의도 한강공원)를 상정한 값들.
 *
 * 발사 지점 좌표는 실제 값이고, 나머지(폭발 고도·관측 후보지)는 대략치입니다.
 */

export type LaunchSite = {
  id: string;
  /** 표에서 쓰는 짧은 이름 */
  label: string;
  name: string;
  lng: number;
  lat: number;
};

/** 발사 지점 두 곳. 약 520m 떨어져 있다. */
export const LAUNCH_SITES: LaunchSite[] = [
  {
    id: "a",
    label: "A",
    name: "발사 지점 A",
    lng: 126.939615,
    lat: 37.526083,
  },
  {
    id: "b",
    label: "B",
    name: "발사 지점 B",
    lng: 126.943527,
    lat: 37.522569,
  },
];

/** 두 발사 지점의 중점. 전체를 조망하는 카메라 기준으로 쓴다. */
export const LAUNCH_CENTER = {
  lng: (LAUNCH_SITES[0].lng + LAUNCH_SITES[1].lng) / 2,
  lat: (LAUNCH_SITES[0].lat + LAUNCH_SITES[1].lat) / 2,
};

/** 수면 표고 (m). 한강 수면은 해발 0에 가깝다. */
export const LAUNCH_BASE_HEIGHT_M = 5;

/** shell이 터지는 고도 (지표 기준 m) */
export const BURST_HEIGHT_M = 350;

/** 폭발 지점 (해발 기준). 가시성 판정의 목표점. */
export const BURST_POINTS = LAUNCH_SITES.map((site) => ({
  site,
  lng: site.lng,
  lat: site.lat,
  height: LAUNCH_BASE_HEIGHT_M + BURST_HEIGHT_M,
}));

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
  { id: "haneul", name: "하늘공원", lng: 126.8765, lat: 37.573, eyeOffsetM: 1.7 },
  { id: "eungbong", name: "응봉산 팔각정", lng: 127.0296, lat: 37.5477, eyeOffsetM: 1.7 },
  { id: "namsan", name: "남산 N서울타워 전망대", lng: 126.9882, lat: 37.5512, eyeOffsetM: 135 },
];

/** 불꽃 메시를 선택적 블룸에 묶기 위한 effect id. */
export const BLOOM_EFFECT_ID = "fireworks-bloom";
