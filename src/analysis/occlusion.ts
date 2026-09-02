import {
  geodeticSurfaceNormal,
  geodeticToVector3,
  vector3ToGeodetic,
  type LatLng,
  type LatLngHeight,
} from "@navaramap/three";
import { Body, Equator, Horizon, Observer } from "astronomy-engine";
import { Vector3 } from "three";

/**
 * 지형 차폐(skyline) 계산.
 *
 * 태양 고도만으로는 "수평선 위"까지만 알 수 있다. 실제로 해가 보이는지는
 * 그 방위각의 지형 능선이 태양보다 높은지에 달려 있다. 여기서는 관측자에서
 * 태양 방위각으로 지표를 따라 나아가며 지형 표고를 샘플링하고, 각 지점이
 * 관측자에게 몇 도 위로 보이는지를 구해 그 최댓값을 지평선 고도로 삼는다.
 *
 * 각도 계산은 전부 ECEF 3D 벡터로 한다. 지구 곡률이 자동으로 반영되므로
 * 별도의 곡률 보정항이 필요 없다. 다만 지형에 대한 대기 굴절은 무시한다
 * (태양 고도값 자체는 엔진이 굴절을 반영해 준다).
 */

/** 지형 표고 일괄 샘플러. 실패한 지점은 undefined. */
export type TerrainSampler = (
  positions: LatLng[],
) => Promise<(number | undefined)[]>;

export type HorizonPoint = {
  /** 능선의 겉보기 고도각 (도) */
  elevationDeg: number;
  /** 능선까지의 거리 (m) */
  distanceM: number;
};

/** 방위각(도) → 지평선 고도. `sampleHorizonProfile`의 결과. */
export type HorizonProfile = Map<number, HorizonPoint>;

const DEFAULT_MAX_DISTANCE_M = 30_000;

/**
 * 지형 샘플링에 사용할 고정 줌 레벨.
 *
 * `sampleTerrainMostDetailed`의 비용은 좌표 개수가 아니라 **콜드 타일 페치 수**가
 * 지배한다(측정: 같은 500개 좌표가 콜드 23초 → 캐시 54ms). 소스 maxZoom인 14는
 * 약 7.6m/px로, 20~30km 밖 능선의 고도각을 0.1° 단위로 판정하는 데는 과잉이면서
 * 타일 수만 수십 배로 늘린다. 12는 약 30m/px(SRTM 1초급)이고 타일이 약 7.7km를
 * 덮어, 렌더링 과정에서 이미 상주하는 경우가 많다.
 */
const SAMPLE_LEVEL = 12;

export { SAMPLE_LEVEL };

/**
 * 샘플 거리 목록. 가까운 곳은 촘촘히, 먼 곳은 성기게 잡는다.
 * 같은 각도 오차라도 가까운 지형이 시야에 미치는 영향이 훨씬 크기 때문이다.
 * 간격은 SAMPLE_LEVEL의 지상 해상도(약 30m)보다 잘게 잡을 이유가 없다.
 */
function sampleDistances(maxDistanceM: number): number[] {
  const distances: number[] = [];
  for (let d = 150; d < Math.min(5_000, maxDistanceM); d += 150) {
    distances.push(d);
  }
  for (let d = 5_000; d <= maxDistanceM; d += 400) {
    distances.push(d);
  }
  return distances;
}

/** 관측자 지점의 로컬 ENU 기저 벡터. */
function localFrame(observer: LatLngHeight) {
  const up = geodeticSurfaceNormal(observer).clone().normalize();
  // ECEF Z축은 북극 방향. Z × up 이 정확히 동쪽 접선이 된다.
  const east = new Vector3(0, 0, 1).cross(up).normalize();
  // ENU는 오른손 좌표계이므로 up × east = north.
  const north = up.clone().cross(east).normalize();
  return { up, east, north };
}

/**
 * 태양 방위각(도, 북=0 시계방향).
 *
 * 엔진의 `atmosphere.sunDirection`을 쓰지 않는 이유: 그 벡터는 렌더 프레임에서만
 * 갱신되므로, 프레임 없이 시각을 바꿔가며 도는 동기 탐색 루프에서는 직전 프레임
 * 값에 고정된다(고도는 바뀌는데 방위각만 멈춰 있어 조용히 틀린 결과가 나온다).
 * astronomy-engine은 Navara가 내부적으로 쓰는 것과 같은 라이브러리이고 날짜만
 * 있으면 계산되므로 프레임과 무관하다.
 */
export function sunAzimuthDeg(date: Date, observer: LatLngHeight): number {
  const obs = new Observer(observer.lat, observer.lng, observer.height);
  const equatorial = Equator(Body.Sun, date, obs, true, true);
  return Horizon(date, obs, equatorial.ra, equatorial.dec, "normal").azimuth;
}

/**
 * 여러 방위각의 지평선 고도를 한 번의 샘플링 요청으로 계산한다.
 *
 * 시간에 따라 태양 방위각이 움직이므로, 일출 시각을 반복 탐색하려면 방위각
 * 구간 전체의 프로파일을 미리 확보해 두는 편이 네트워크 왕복을 줄인다.
 */
export async function sampleHorizonProfile(
  observer: LatLngHeight,
  azimuthsDeg: number[],
  sample: TerrainSampler,
  maxDistanceM = DEFAULT_MAX_DISTANCE_M,
): Promise<HorizonProfile> {
  const distances = sampleDistances(maxDistanceM);
  const { up, east, north } = localFrame(observer);
  const origin = geodeticToVector3(observer);

  // 모든 방위각 × 모든 거리를 한 배열로 펼쳐 한 번에 샘플링한다.
  const positions: LatLng[] = [];
  for (const azimuth of azimuthsDeg) {
    const rad = (azimuth * Math.PI) / 180;
    const direction = north
      .clone()
      .multiplyScalar(Math.cos(rad))
      .add(east.clone().multiplyScalar(Math.sin(rad)))
      .normalize();

    for (const distance of distances) {
      const point = origin
        .clone()
        .add(direction.clone().multiplyScalar(distance));
      const geodetic = vector3ToGeodetic(point);
      positions.push({ lat: geodetic.lat, lng: geodetic.lng });
    }
  }

  const heights = await sample(positions);

  const profile: HorizonProfile = new Map();
  azimuthsDeg.forEach((azimuth, azimuthIndex) => {
    let best: HorizonPoint | null = null;

    distances.forEach((distance, distanceIndex) => {
      const height = heights[azimuthIndex * distances.length + distanceIndex];
      if (height === undefined) return;

      const position = positions[azimuthIndex * distances.length + distanceIndex];
      const target = geodeticToVector3({ ...position, height });
      const toTarget = target.clone().sub(origin).normalize();

      // up과의 내적이 곧 sin(고도각). 곡률은 ECEF 기하에 이미 포함된다.
      const elevationDeg =
        (Math.asin(Math.max(-1, Math.min(1, toTarget.dot(up)))) * 180) /
        Math.PI;

      if (!best || elevationDeg > best.elevationDeg) {
        best = { elevationDeg, distanceM: distance };
      }
    });

    if (best) profile.set(azimuth, best);
  });

  return profile;
}

/** 관측자에서 본 목표 지점의 방향. */
export type Sighting = {
  /** 방위각 (도, 북=0 시계방향) */
  azimuthDeg: number;
  /** 접평면 기준 수평 거리 (m) */
  groundDistanceM: number;
  /** 겉보기 고도각 (도) */
  elevationDeg: number;
};

/** 관측자에서 목표 지점을 봤을 때의 방위·거리·고도각. */
export function sightTarget(
  observer: LatLngHeight,
  target: LatLngHeight,
): Sighting {
  const { up, east, north } = localFrame(observer);
  const origin = geodeticToVector3(observer);
  const toTarget = geodeticToVector3(target).clone().sub(origin);

  // 수평 성분 = 전체 벡터에서 up 방향 성분을 뺀 것.
  const upComponent = toTarget.dot(up);
  const horizontal = toTarget.clone().sub(up.clone().multiplyScalar(upComponent));

  const direction = toTarget.clone().normalize();
  return {
    azimuthDeg:
      ((Math.atan2(horizontal.dot(east), horizontal.dot(north)) * 180) /
        Math.PI +
        360) %
      360,
    groundDistanceM: horizontal.length(),
    elevationDeg:
      (Math.asin(Math.max(-1, Math.min(1, direction.dot(up)))) * 180) /
      Math.PI,
  };
}

export type LineOfSight = Sighting & {
  /** 지형이 시선을 가리지 않으면 true. */
  clear: boolean;
  /** 시선을 가린 지점 중 가장 높이 솟은 것. */
  blockedBy?: { distanceM: number; elevationDeg: number };
};

/**
 * 관측자 → 목표 지점 사이의 가시선을 판정한다.
 *
 * 목표까지의 수평 거리 안에서 지형을 훑어, 목표의 겉보기 고도각보다 높이
 * 올라오는 지형이 있으면 가려진 것으로 본다. 고도각 비교이므로 지구 곡률은
 * ECEF 기하에 이미 포함된다.
 */
export async function checkLineOfSight(
  observer: LatLngHeight,
  target: LatLngHeight,
  sample: TerrainSampler,
): Promise<LineOfSight> {
  const sighting = sightTarget(observer, target);
  const { up, east, north } = localFrame(observer);
  const origin = geodeticToVector3(observer);

  const rad = (sighting.azimuthDeg * Math.PI) / 180;
  const direction = north
    .clone()
    .multiplyScalar(Math.cos(rad))
    .add(east.clone().multiplyScalar(Math.sin(rad)))
    .normalize();

  // 목표 지점 자체는 제외하고 그 앞까지만 훑는다.
  const distances = sampleDistances(sighting.groundDistanceM).filter(
    (d) => d < sighting.groundDistanceM - 50,
  );
  if (distances.length === 0) return { ...sighting, clear: true };

  const positions: LatLng[] = distances.map((distance) => {
    const point = origin.clone().add(direction.clone().multiplyScalar(distance));
    const geodetic = vector3ToGeodetic(point);
    return { lat: geodetic.lat, lng: geodetic.lng };
  });

  const heights = await sample(positions);

  let blockedBy: LineOfSight["blockedBy"];
  distances.forEach((distance, i) => {
    const height = heights[i];
    if (height === undefined) return;

    const point = geodeticToVector3({ ...positions[i], height });
    const toPoint = point.clone().sub(origin).normalize();
    const elevationDeg =
      (Math.asin(Math.max(-1, Math.min(1, toPoint.dot(up)))) * 180) / Math.PI;

    if (
      elevationDeg > sighting.elevationDeg &&
      (!blockedBy || elevationDeg > blockedBy.elevationDeg)
    ) {
      blockedBy = { distanceM: distance, elevationDeg };
    }
  });

  return { ...sighting, clear: blockedBy === undefined, blockedBy };
}

/**
 * 프로파일에 없는 방위각의 지평선 고도를 선형 보간한다.
 * 구간 밖이면 가장 가까운 끝값을 쓴다.
 */
export function interpolateHorizon(
  profile: HorizonProfile,
  azimuthDeg: number,
): number | null {
  const entries = [...profile.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return null;
  if (azimuthDeg <= entries[0][0]) return entries[0][1].elevationDeg;

  const last = entries[entries.length - 1];
  if (azimuthDeg >= last[0]) return last[1].elevationDeg;

  for (let i = 1; i < entries.length; i++) {
    const [azHi, hi] = entries[i];
    if (azimuthDeg > azHi) continue;

    const [azLo, lo] = entries[i - 1];
    const t = (azimuthDeg - azLo) / (azHi - azLo);
    return lo.elevationDeg + t * (hi.elevationDeg - lo.elevationDeg);
  }

  return last[1].elevationDeg;
}
