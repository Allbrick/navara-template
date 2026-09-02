import { vector3ToGeodetic, type MapPointerEvent } from "@navaramap/three";
import type { PersonViewPlugin, PersonViewState } from "@navaramap/three-plugins";
import { useViewContext } from "@navaramap/three-react";
import { useCallback, useEffect, useState } from "react";

import { INITIAL_CAMERA, TERRAIN_SOURCE_ID } from "../../constants";
import { Panel } from "../../ui/Panel";
import { Vector3 } from "three";

type Props = {
  personView: PersonViewPlugin;
};

const CONTROLS: [string, string][] = [
  ["W / S", "전진 / 후진"],
  ["A / D", "좌회전 / 우회전"],
  ["Shift", "달리기"],
  ["V", "3인칭 ↔ 1인칭"],
  ["Alt (누른 채)", "자유 카메라"],
];

/**
 * 지점 선택 → 캐릭터 배치 → 조작 데모.
 *
 * 지도를 클릭하면 그 지점의 지형 표고를 샘플링해 캐릭터를 텔레포트시키고
 * 시점을 3인칭으로 넘긴다. 클릭할 때마다 다시 배치되므로 지점을 바꿔가며
 * 돌아다닐 수 있다.
 */
export function WalkDemo({ personView }: Props) {
  const { view } = useViewContext();

  const [state, setState] = useState<PersonViewState | null>(null);
  const [placed, setPlaced] = useState(false);
  const [active, setActive] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 배치 전에는 지점을 고르기 좋게 광역 조망에서 시작한다.
  useEffect(() => {
    view.setCamera(INITIAL_CAMERA);
  }, [view]);

  // 클릭 지점에 캐릭터를 배치한다.
  useEffect(() => {
    const onClick = async (event: MapPointerEvent) => {
      // event.map은 지구 표면의 ECEF 좌표다. 위경도로 바꾼 뒤 그 지점의
      // 지형 표고를 따로 샘플링해 고도를 정한다.
      const geodetic = vector3ToGeodetic(
        new Vector3(event.map.x, event.map.y, event.map.z),
      );
      const position = { lat: geodetic.lat, lng: geodetic.lng };

      setPlacing(true);
      setError(null);
      try {
        const [sampled] = await view.sampleTerrainMostDetailed(
          TERRAIN_SOURCE_ID,
          [position],
        );
        if (sampled.height === undefined) {
          setError("이 지점의 지형 표고를 얻지 못했습니다. 다른 곳을 눌러보세요.");
          return;
        }

        personView.teleport({ ...position, alt: sampled.height });
        personView.start();
        setPlaced(true);
        setActive(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPlacing(false);
      }
    };

    view.on("click", onClick);
    return () => view.off("click", onClick);
  }, [view, personView]);

  useEffect(() => personView.onStateChange(setState), [personView]);

  // 다른 데모로 넘어갈 때 카메라를 view에 돌려준다.
  useEffect(() => () => personView.stop(), [personView]);

  const toggleActive = useCallback(() => {
    if (active) {
      personView.stop();
      setActive(false);
    } else {
      personView.start();
      setActive(true);
    }
  }, [active, personView]);

  return (
    <Panel title="지점 선택 · 캐릭터 조작">
      {!placed ? (
        <p className="note">
          지도를 클릭하면 그 지점에 캐릭터가 배치되고 3인칭 시점으로 바뀝니다.
          {placing && " 배치 중…"}
        </p>
      ) : (
        <p className="note">
          다른 곳을 클릭하면 그 지점으로 옮겨갑니다.
          {placing && " 배치 중…"}
        </p>
      )}

      {error && <p className="note bad">{error}</p>}

      {state && (
        <dl>
          <dt>위치</dt>
          <dd>
            {state.lat.toFixed(5)}, {state.lng.toFixed(5)}
          </dd>
          <dt>고도</dt>
          <dd>{state.alt.toFixed(1)}m</dd>
          <dt>방위</dt>
          <dd>{state.heading.toFixed(0)}°</dd>
          <dt>속도</dt>
          <dd>{state.speed.toFixed(1)}m/s</dd>
          <dt>시점</dt>
          <dd>{state.mode === "tpv" ? "3인칭" : "1인칭"}</dd>
          <dt>동작</dt>
          <dd>{state.animationState ?? "—"}</dd>
        </dl>
      )}

      {placed && (
        <>
          <button type="button" onClick={toggleActive}>
            {active ? "조작 해제 (지도 탐색)" : "조작 재개"}
          </button>
          <button
            type="button"
            onClick={() => personView.toggleViewMode()}
            disabled={!active}
          >
            시점 전환
          </button>
        </>
      )}

      <table className="results">
        <tbody>
          {CONTROLS.map(([key, action]) => (
            <tr key={key}>
              <td>{key}</td>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="note">
        지형에 붙어 걷습니다(collision: ground). 캐릭터 모델은 Khronos glTF
        Sample Assets의 Fox입니다.
      </p>
    </Panel>
  );
}
