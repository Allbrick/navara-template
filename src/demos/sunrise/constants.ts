/**
 * 일출 관측 후보지.
 *
 * 서울에서 해맞이 장소로 알려진 지점들. 기준 비교용으로 평지인 서울시청을 첫
 * 항목에 둡니다.
 *
 * 좌표는 지형 표고를 실제로 샘플링해 능선이 시야를 막지 않는 지점으로 맞췄습니다
 * (예: 아차산은 처음 찍은 좌표가 능선 아래라 동쪽 능선 고도가 18°까지 나왔습니다).
 * 지점을 추가할 때도 표고와 능선 고도를 확인하세요 — 이름만 맞고 좌표가 산 아래면
 * 해맞이 명소가 "일출 89분 지연"으로 나옵니다.
 */
export type SunriseViewpoint = {
  id: string;
  name: string;
  lng: number;
  lat: number;
};

export const SUNRISE_VIEWPOINTS: SunriseViewpoint[] = [
  { id: "cityhall", name: "서울시청 (평지 기준)", lng: 126.978, lat: 37.5665 },
  { id: "achasan", name: "아차산 해맞이광장", lng: 127.1073, lat: 37.5533 },
  { id: "eungbong", name: "응봉산 팔각정", lng: 127.0296, lat: 37.5477 },
  { id: "yongmasan", name: "용마산 정상", lng: 127.0955, lat: 37.5715 },
  { id: "namsan", name: "남산 N서울타워", lng: 126.9882, lat: 37.5512 },
  { id: "bugak", name: "북악스카이웨이 팔각정", lng: 126.981, lat: 37.601 },
  { id: "ansan", name: "안산 봉수대", lng: 126.946, lat: 37.5765 },
  { id: "haneul", name: "하늘공원", lng: 126.8785, lat: 37.571 },
];
