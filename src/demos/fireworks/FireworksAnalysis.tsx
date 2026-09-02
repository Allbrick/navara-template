import type { PersonViewPlugin } from "@navaramap/three-plugins";
import { useViewContext } from "@navaramap/three-react";
import { useCallback, useEffect, useState } from "react";

import {
  checkLineOfSight,
  SAMPLE_LEVEL,
  sightTarget,
  type LineOfSight,
  type TerrainSampler,
} from "../../analysis/occlusion";
import { TERRAIN_SOURCE_ID } from "../../constants";
import { Panel } from "../../ui/Panel";
import {
  BURST_HEIGHT_M,
  BURST_POINTS,
  LAUNCH_CENTER,
  VIEWPOINTS,
  type LaunchSite,
  type Viewpoint,
} from "./constants";
import { FireworksScene } from "./FireworksScene";

/** 불꽃놀이는 야간 씬이 전제다. */
const NIGHT_SOLAR_TIME = 20.5;

/** 한 관측지에서 본 발사 지점 하나에 대한 판정. */
type SiteResult = LineOfSight & { site: LaunchSite };

type Result = {
  viewpoint: Viewpoint;
  groundHeightM: number;
  /** 발사 지점별 판정. 가까운 순으로 정렬한다. */
  sites: SiteResult[];
};

type Props = {
  personView: PersonViewPlugin;
};

/**
 * 불꽃놀이 분석 데모.
 *
 * 여의도 상공 두 발사 지점의 폭발을 여러 관측 후보지에서 볼 수 있는지 판정한다.
 * 일출 분석의 지형 차폐 계산(`analysis/occlusion`)을 그대로 재사용한다 —
 * "특정 방위의 지형이 목표보다 높이 솟았는가"라는 문제가 동일하기 때문이다.
 *
 * 두 지점은 약 520m 떨어져 있어 먼 관측지에서는 거의 같이 보이지만, 가까운
 * 관측지에서는 거리·고도각이 눈에 띄게 다르고 한쪽만 가릴 수도 있다. 그래서
 * 지점별로 따로 판정하고, 표에는 가까운 쪽 기준값과 어느 쪽이 보이는지를 함께
 * 보여준다.
 */
export function FireworksAnalysis({ personView }: Props) {
  const { view } = useViewContext();

  const [results, setResults] = useState<Result[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 야간 씬으로 전환하고, 두 발사 지점이 함께 보이는 위치에서 시작한다.
  useEffect(() => {
    view.atmosphere.setSolarTime({ lng: LAUNCH_CENTER.lng }, NIGHT_SOLAR_TIME);
    view.setCamera({
      lng: LAUNCH_CENTER.lng,
      lat: LAUNCH_CENTER.lat - 0.022,
      height: 800,
      heading: 0,
      pitch: -8,
      roll: 0,
    });
  }, [view]);

  const analyze = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const sample: TerrainSampler = async (positions) => {
        const sampled = await view.sampleTerrainMostDetailed(
          TERRAIN_SOURCE_ID,
          positions,
          { level: SAMPLE_LEVEL },
        );
        return sampled.map((r) => r.height);
      };

      // 후보지 표고를 한 번에 받는다.
      const grounds = await sample(VIEWPOINTS);

      const collected: Result[] = [];
      for (const [i, viewpoint] of VIEWPOINTS.entries()) {
        const ground = grounds[i];
        if (ground === undefined) continue;

        const observer = {
          lng: viewpoint.lng,
          lat: viewpoint.lat,
          height: ground + viewpoint.eyeOffsetM,
        };

        const sites: SiteResult[] = [];
        for (const burst of BURST_POINTS) {
          const los = await checkLineOfSight(observer, burst, sample);
          sites.push({ ...los, site: burst.site });
        }
        sites.sort((a, b) => a.groundDistanceM - b.groundDistanceM);

        collected.push({ viewpoint, groundHeightM: ground, sites });
      }

      if (collected.length === 0) {
        setError("후보지 표고를 얻지 못했습니다.");
        return;
      }

      collected.sort(
        (a, b) => a.sites[0].groundDistanceM - b.sites[0].groundDistanceM,
      );
      setResults(collected);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [view]);

  /**
   * 해당 관측지에 캐릭터를 세우고 폭발 지점을 올려다보게 한다.
   *
   * 조준 대상은 보이는 지점 중 가까운 쪽, 둘 다 가려지면 그냥 가까운 쪽이다.
   * 방위·고도각은 표에 쓰인 분석값(관측 높이 기준)이 아니라 **캐릭터의 실제 눈높이**
   * 에서 다시 계산한다. collision이 ground라 캐릭터는 지형 표면에 붙으므로,
   * 남산 전망대처럼 eyeOffset이 큰 지점은 분석 관측점과 높이가 달라진다.
   */
  const goTo = useCallback(
    (result: Result) => {
      const { lng, lat } = result.viewpoint;
      const target = result.sites.find((s) => s.clear) ?? result.sites[0];
      const burst = BURST_POINTS.find((b) => b.site.id === target.site.id);
      if (!burst) return;

      const eye = {
        lng,
        lat,
        height: result.groundHeightM + personView.getFpvHeightOffset(),
      };
      const sighting = sightTarget(eye, burst);

      personView.teleport({
        lng,
        lat,
        alt: result.groundHeightM,
        heading: sighting.azimuthDeg,
      });
      personView.setViewMode("fpv");
      // fpvPitch는 양수가 아래를 향한다. 폭발은 위에 있으므로 부호를 뒤집는다.
      personView.setFpvPitch(-sighting.elevationDeg);
      personView.start();

      setSelected(result.viewpoint.id);
      setWatching(true);
    },
    [personView],
  );

  const release = useCallback(() => {
    personView.stop();
    setWatching(false);
  }, [personView]);

  return (
    <>
      <FireworksScene />

      <Panel title="불꽃놀이 분석 — 여의도">
        <p className="note">
          여의도 상공 {BURST_HEIGHT_M}m 폭발을 각 관측 후보지에서 볼 수 있는지
          지형 차폐로 판정합니다. 발사 지점은 A·B 두 곳입니다.
        </p>

        <button type="button" onClick={analyze} disabled={busy}>
          {busy ? "지형 샘플링 중…" : "관측지 가시성 분석"}
        </button>

        {error && <p className="note bad">{error}</p>}

        {results && (
          <table className="results">
            <thead>
              <tr>
                <th>관측지</th>
                <th>거리</th>
                <th>고도각</th>
                <th>가시</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const nearest = r.sites[0];
                // 판정은 거리순으로 하지만 표기는 A·B 고정 순서가 읽기 쉽다.
                const visible = r.sites
                  .filter((s) => s.clear)
                  .sort((a, b) => a.site.id.localeCompare(b.site.id));
                return (
                  <tr
                    key={r.viewpoint.id}
                    onClick={() => goTo(r)}
                    aria-selected={selected === r.viewpoint.id}
                  >
                    <td>{r.viewpoint.name}</td>
                    <td>{(nearest.groundDistanceM / 1000).toFixed(1)}km</td>
                    <td>{nearest.elevationDeg.toFixed(1)}°</td>
                    <td className={visible.length > 0 ? "good" : "bad"}>
                      {visible.length === 0
                        ? "가림"
                        : visible.map((s) => s.site.label).join("·")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {watching && (
          <button type="button" onClick={release}>
            관람 종료 (지도 탐색)
          </button>
        )}

        {results && (
          <p className="note">
            거리·고도각은 가까운 발사 지점 기준이고, 가시 칸은 실제로 보이는
            지점입니다(A·B / A / B / 가림). 행을 누르면 그 관측지에 캐릭터가 서서
            폭발 지점을 올려다봅니다. 표고가 SRTM 계열이라 도심 구간은 건물이
            포함된 표면모델로 동작합니다.
          </p>
        )}
      </Panel>
    </>
  );
}
