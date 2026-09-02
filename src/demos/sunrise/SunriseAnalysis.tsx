import { useViewContext } from "@navaramap/three-react";
import { useCallback, useEffect, useState } from "react";

import {
  DISPLAY_TIME_ZONE,
  EYE_HEIGHT_M,
  SEOUL,
  TERRAIN_SOURCE_ID,
} from "../../constants";
import { Panel } from "../../ui/Panel";
import {
  interpolateHorizon,
  sampleHorizonProfile,
  SAMPLE_LEVEL,
  sunAzimuthDeg,
  type HorizonProfile,
  type TerrainSampler,
} from "../../analysis/occlusion";
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

/**
 * 일출 분석 데모.
 *
 * 태양 위치는 Navara 내장 astronomy-engine을 `view.atmosphere`가 감싼 것을
 * 그대로 쓰고, 지형 차폐는 `view.sampleTerrainMostDetailed`로 능선을 샘플링해
 * 판정한다.
 */
export function SunriseAnalysis() {
  const { view } = useViewContext();

  const [solarTime, setSolarTime] = useState(6);
  const [elevation, setElevation] = useState(0);
  const [azimuth, setAzimuth] = useState(0);
  const [clockTime, setClockTime] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 슬라이더 값 → 태양시. atmosphere.date가 바뀌면 하늘·태양광·그림자가 함께 갱신된다.
  useEffect(() => {
    const { atmosphere } = view;
    atmosphere.setSolarTime({ lng: SEOUL.lng }, solarTime);

    setElevation(atmosphere.getSunElevation(SEOUL));
    setClockTime(formatClockTime(atmosphere.date, DISPLAY_TIME_ZONE));
    setAzimuth(
      sunAzimuthDeg(atmosphere.date, {
        ...SEOUL,
        height: analysis?.groundHeightM ?? 0,
      }),
    );
  }, [view, solarTime, analysis]);

  const analyze = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { atmosphere } = view;

      const sample: TerrainSampler = async (positions) => {
        const results = await view.sampleTerrainMostDetailed(
          TERRAIN_SOURCE_ID,
          positions,
          { level: SAMPLE_LEVEL },
        );
        return results.map((r) => r.height);
      };

      // 1. 관측자 발밑 표고.
      const [ground] = await sample([SEOUL]);
      if (ground === undefined) {
        setError("관측 지점의 지형 표고를 얻지 못했습니다.");
        return;
      }
      const observer = { ...SEOUL, height: ground + EYE_HEIGHT_M };

      // 2. 수평선 기준 일출 시각과 그때의 태양 방위각.
      const flatSunrise = findSunriseSolarTime(atmosphere, SEOUL);
      if (flatSunrise === null) {
        setError("이 날짜에는 일출이 없습니다.");
        return;
      }

      const originalDate = atmosphere.date;
      atmosphere.setSolarTime({ lng: SEOUL.lng }, flatSunrise);
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
        SEOUL,
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
  }, [view]);

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
        <dl>
          <dt>수평선 일출</dt>
          <dd>{formatSolarTime(analysis.flatSunrise)}</dd>
          <dt>지형 반영</dt>
          <dd>
            {analysis.terrainSunrise === null
              ? "능선에 계속 가림"
              : `${formatSolarTime(analysis.terrainSunrise)} (+${Math.round(
                  (analysis.terrainSunrise - analysis.flatSunrise) * 60,
                )}분)`}
          </dd>
          <dt>관측점 표고</dt>
          <dd>{analysis.groundHeightM.toFixed(0)}m</dd>
        </dl>
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
