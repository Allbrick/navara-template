import type { PersonViewPlugin } from "@navaramap/three-plugins";
import { useViewContext } from "@navaramap/three-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  interpolateHorizon,
  sampleHorizonProfile,
  SAMPLE_LEVEL,
  sunAzimuthDeg,
  type HorizonProfile,
  type TerrainSampler,
} from "../../analysis/occlusion";
import {
  DISPLAY_TIME_ZONE,
  EYE_HEIGHT_M,
  TERRAIN_SOURCE_ID,
} from "../../constants";
import { Panel } from "../../ui/Panel";
import { SUNRISE_VIEWPOINTS } from "./constants";
import {
  findSunriseOverTerrain,
  findSunriseSolarTime,
  formatClockTime,
  formatSolarTime,
} from "./sun";

/** 태양이 일출 후 이동하는 방위각 범위를 덮는다. */
const AZIMUTH_WINDOW_START = -4;
const AZIMUTH_WINDOW_END = 28;
const AZIMUTH_STEP = 2;

type Analysis = {
  /** 관측자 발밑 지형 표고 (m) */
  groundHeightM: number;
  profile: HorizonProfile;
  /** 수평선 기준 일출 (태양시) */
  flatSunrise: number;
  /** 지형 능선을 넘는 실제 일출 (태양시). 못 찾으면 null */
  terrainSunrise: number | null;
};

type Props = {
  personView: PersonViewPlugin;
};

/**
 * 일출 분석 데모.
 *
 * 태양 위치는 Navara 내장 astronomy-engine을 `view.atmosphere`가 감싼 것을
 * 그대로 쓰고, 지형 차폐는 `view.sampleTerrainMostDetailed`로 능선을 샘플링해
 * 판정한다. 관측 지점을 바꾸면 능선 프로파일이 달라지므로 분석을 초기화한다.
 */
export function SunriseAnalysis({ personView }: Props) {
  const { view } = useViewContext();

  const [viewpointId, setViewpointId] = useState(SUNRISE_VIEWPOINTS[0].id);
  const [solarTime, setSolarTime] = useState(6);
  const [elevation, setElevation] = useState(0);
  const [azimuth, setAzimuth] = useState(0);
  const [clockTime, setClockTime] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewpoint = useMemo(
    () =>
      SUNRISE_VIEWPOINTS.find((v) => v.id === viewpointId) ??
      SUNRISE_VIEWPOINTS[0],
    [viewpointId],
  );

  // 지점이 바뀌면 이전 지점의 능선 프로파일은 무의미하다.
  useEffect(() => {
    setAnalysis(null);
    setError(null);
    setWatching(false);
    personView.stop();

    // 해가 뜨는 동쪽을 바라보도록 지점 서쪽 상공에 카메라를 둔다.
    view.setCamera({
      lng: viewpoint.lng - 0.025,
      lat: viewpoint.lat,
      height: 2000,
      heading: 90,
      pitch: -15,
      roll: 0,
    });
  }, [view, personView, viewpoint]);

  // 슬라이더 값 → 태양시. atmosphere.date가 바뀌면 하늘·태양광·그림자가 함께 갱신된다.
  useEffect(() => {
    const { atmosphere } = view;
    const location = { lat: viewpoint.lat, lng: viewpoint.lng };

    atmosphere.setSolarTime({ lng: location.lng }, solarTime);
    setElevation(atmosphere.getSunElevation(location));
    setClockTime(formatClockTime(atmosphere.date, DISPLAY_TIME_ZONE));
    setAzimuth(
      sunAzimuthDeg(atmosphere.date, {
        ...location,
        height: analysis?.groundHeightM ?? 0,
      }),
    );
  }, [view, solarTime, viewpoint, analysis]);

  const analyze = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { atmosphere } = view;
      const location = { lat: viewpoint.lat, lng: viewpoint.lng };

      const sample: TerrainSampler = async (positions) => {
        const results = await view.sampleTerrainMostDetailed(
          TERRAIN_SOURCE_ID,
          positions,
          { level: SAMPLE_LEVEL },
        );
        return results.map((r) => r.height);
      };

      // 1. 관측자 발밑 표고.
      const [ground] = await sample([location]);
      if (ground === undefined) {
        setError("관측 지점의 지형 표고를 얻지 못했습니다.");
        return;
      }
      const observer = { ...location, height: ground + EYE_HEIGHT_M };

      // 2. 수평선 기준 일출 시각과 그때의 태양 방위각.
      const flatSunrise = findSunriseSolarTime(atmosphere, location);
      if (flatSunrise === null) {
        setError("이 날짜에는 일출이 없습니다.");
        return;
      }

      const originalDate = atmosphere.date;
      atmosphere.setSolarTime({ lng: location.lng }, flatSunrise);
      const sunriseAzimuth = sunAzimuthDeg(atmosphere.date, observer);
      atmosphere.date = originalDate;

      // 3. 일출 방위각 주변의 지평선 프로파일을 한 번에 샘플링.
      const azimuths: number[] = [];
      for (
        let offset = AZIMUTH_WINDOW_START;
        offset <= AZIMUTH_WINDOW_END;
        offset += AZIMUTH_STEP
      ) {
        azimuths.push(sunriseAzimuth + offset);
      }
      const profile = await sampleHorizonProfile(observer, azimuths, sample);
      if (profile.size === 0) {
        setError("지형 표고 샘플링에 실패했습니다.");
        return;
      }

      // 4. 능선을 넘는 시각을 탐색.
      const terrainSunrise = findSunriseOverTerrain(
        atmosphere,
        location,
        () => sunAzimuthDeg(atmosphere.date, observer),
        (az) => interpolateHorizon(profile, az),
        flatSunrise,
      );

      setAnalysis({
        groundHeightM: ground,
        profile,
        flatSunrise,
        terrainSunrise,
      });
      setSolarTime(terrainSunrise ?? flatSunrise);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [view, viewpoint]);

  /** 관측 지점에 캐릭터를 세우고 해가 뜨는 방향을 바라보게 한다. */
  const watchHere = useCallback(() => {
    if (!analysis) return;

    personView.teleport({
      lng: viewpoint.lng,
      lat: viewpoint.lat,
      alt: analysis.groundHeightM,
      heading: azimuth,
    });
    personView.setViewMode("fpv");
    // fpvPitch는 양수가 아래를 향한다. 능선 위를 보도록 부호를 뒤집는다.
    const horizon = interpolateHorizon(analysis.profile, azimuth) ?? 0;
    personView.setFpvPitch(-Math.max(horizon, elevation));
    personView.start();
    setWatching(true);
  }, [analysis, azimuth, elevation, personView, viewpoint]);

  const release = useCallback(() => {
    personView.stop();
    setWatching(false);
  }, [personView]);

  // 다른 데모로 넘어갈 때 카메라를 view에 돌려준다.
  useEffect(() => () => personView.stop(), [personView]);

  const horizon = analysis ? interpolateHorizon(analysis.profile, azimuth) : null;
  const ridge = analysis?.profile.get(
    [...analysis.profile.keys()].reduce((closest, key) =>
      Math.abs(key - azimuth) < Math.abs(closest - azimuth) ? key : closest,
    ),
  );
  const occluded = horizon !== null && elevation < horizon;

  return (
    <Panel title="일출 분석 — 서울">
      <label>
        관측 지점
        <select
          value={viewpointId}
          onChange={(e) => setViewpointId(e.target.value)}
        >
          {SUNRISE_VIEWPOINTS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        태양시 {formatSolarTime(solarTime)}
        <input
          type="range"
          min={0}
          max={24}
          step={0.05}
          value={solarTime}
          onChange={(e) => setSolarTime(Number(e.target.value))}
        />
      </label>

      <dl>
        <dt>한국 시각</dt>
        <dd>{clockTime}</dd>
        <dt>태양 고도</dt>
        <dd>{elevation.toFixed(2)}°</dd>
        <dt>태양 방위</dt>
        <dd>{azimuth.toFixed(1)}°</dd>
        {horizon !== null && (
          <>
            <dt>능선 고도</dt>
            <dd>
              {horizon.toFixed(2)}°
              {ridge && <small> · {(ridge.distanceM / 1000).toFixed(1)}km</small>}
            </dd>
            <dt>가시 여부</dt>
            <dd className={occluded ? "bad" : "good"}>
              {occluded ? "지형에 가림" : "보임"}
            </dd>
          </>
        )}
      </dl>

      <button type="button" onClick={analyze} disabled={busy}>
        {busy ? "지형 샘플링 중…" : "지형 차폐 분석"}
      </button>

      {error && <p className="note bad">{error}</p>}

      {analysis && (
        <>
          <dl>
            <dt>수평선 일출</dt>
            <dd>{formatSolarTime(analysis.flatSunrise)}</dd>
            <dt>지형 반영</dt>
            <dd>
              {analysis.terrainSunrise === null
                ? "능선에 계속 가림"
                : (() => {
                    const deltaMin = Math.round(
                      (analysis.terrainSunrise - analysis.flatSunrise) * 60,
                    );
                    const sign = deltaMin > 0 ? "+" : "";
                    return `${formatSolarTime(analysis.terrainSunrise)} (${sign}${deltaMin}분)`;
                  })()}
            </dd>
            <dt>관측점 표고</dt>
            <dd>{analysis.groundHeightM.toFixed(0)}m</dd>
          </dl>

          <button type="button" onClick={watching ? release : watchHere}>
            {watching ? "관람 종료 (지도 탐색)" : "이 지점에서 일출 보기"}
          </button>
        </>
      )}

      <p className="note">
        태양시는 경도 기준이라 KST와 다릅니다. 능선 고도는 관측자에서 태양
        방위로 30km까지 훑어 구한 겉보기 최대 고도각입니다. 표고 데이터가
        SRTM 계열이라 도심에서는 건물이 포함된 표면모델로 동작합니다 — 근거리
        차폐는 지형이 아니라 건물일 수 있습니다.
      </p>
    </Panel>
  );
}
