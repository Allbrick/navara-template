import { vector3ToGeodetic, type MapPointerEvent } from "@navaramap/three";
import type { PersonViewPlugin, PersonViewState } from "@navaramap/three-plugins";
import { useViewContext } from "@navaramap/three-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Vector3 } from "three";

import { TERRAIN_SOURCE_ID } from "../../constants";
import { CHARACTER_LIST, type CharacterId } from "../../scene/characters";
import { Panel } from "../../ui/Panel";

/** 탐방 중 바로 이동할 수 있는 지점. 분석 데모들의 관측지를 모아 받는다. */
export type Destination = {
  id: string;
  /** 목록에서 묶어 보여줄 그룹 이름 */
  group: string;
  name: string;
  lng: number;
  lat: number;
};

type Props = {
  personView: PersonViewPlugin;
  destinations: Destination[];
  characterId: CharacterId;
  onCharacterChange: (id: CharacterId) => void;
};

const CONTROLS: [string, string][] = [
  ["W / S", "전진 / 후진"],
  ["A / D", "좌회전 / 우회전"],
  ["Shift", "달리기"],
  ["V", "3인칭 ↔ 1인칭"],
  ["마우스 드래그", "시점 회전"],
];

/**
 * 지점 선택 → 캐릭터 배치 → 조작.
 *
 * 지도를 클릭하거나 목록에서 분석 지점을 고르면 그 지점의 지형 표고를 샘플링해
 * 캐릭터를 텔레포트시키고 시점을 3인칭으로 넘긴다.
 *
 * 분석 데모와 독립적으로 켜고 끈다. 켜는 것만으로는 카메라를 건드리지 않고,
 * 사용자가 지점을 정한 시점부터 시점을 가져간다 — 분석에서 맞춰 둔 시점을
 * 탐방을 켰다는 이유만으로 잃지 않게 하기 위해서다.
 */
export function WalkDemo({
  personView,
  destinations,
  characterId,
  onCharacterChange,
}: Props) {
  const { view } = useViewContext();

  const [state, setState] = useState<PersonViewState | null>(null);
  const [placed, setPlaced] = useState(false);
  const [active, setActive] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [freeCamera, setFreeCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 마우스 드래그로 시점을 돌린다. off면 Alt를 누른 채로만 가능하다.
  // 캐릭터를 바꾸면 플러그인 인스턴스가 달라지므로 다시 적용해야 한다.
  useEffect(() => {
    personView.setAllowCameraControl(freeCamera);
  }, [personView, freeCamera]);

  /** 지형 표고를 받아 그 위에 캐릭터를 세운다. 클릭과 목록 이동이 공유한다. */
  const placeAt = useCallback(
    async (position: { lat: number; lng: number }) => {
      setPlacing(true);
      setError(null);
      try {
        const [sampled] = await view.sampleTerrainMostDetailed(
          TERRAIN_SOURCE_ID,
          [position],
        );
        if (sampled.height === undefined) {
          setError("이 지점의 지형 표고를 얻지 못했습니다. 다른 곳을 골라보세요.");
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
    },
    [view, personView],
  );

  // 클릭 지점에 캐릭터를 배치한다.
  useEffect(() => {
    const onClick = (event: MapPointerEvent) => {
      // event.map은 지구 표면의 ECEF 좌표다. 위경도로 바꾼 뒤 그 지점의
      // 지형 표고를 따로 샘플링해 고도를 정한다.
      const geodetic = vector3ToGeodetic(
        new Vector3(event.map.x, event.map.y, event.map.z),
      );
      void placeAt({ lat: geodetic.lat, lng: geodetic.lng });
    };

    view.on("click", onClick);
    return () => view.off("click", onClick);
  }, [view, placeAt]);

  useEffect(() => personView.onStateChange(setState), [personView]);

  const toggleActive = useCallback(() => {
    if (active) {
      personView.stop();
      setActive(false);
    } else {
      personView.start();
      setActive(true);
    }
  }, [active, personView]);

  /** 그룹 순서를 유지한 채 목록을 묶는다. */
  const grouped = useMemo(() => {
    const groups = new Map<string, Destination[]>();
    for (const d of destinations) {
      const list = groups.get(d.group);
      if (list) list.push(d);
      else groups.set(d.group, [d]);
    }
    return [...groups.entries()];
  }, [destinations]);

  return (
    <Panel title="지점 선택 · 캐릭터 조작">
      <p className="note">
        {placed
          ? "다른 곳을 클릭하면 그 지점으로 옮겨갑니다."
          : "지도를 클릭하면 그 지점에 캐릭터가 배치되고 3인칭 시점으로 바뀝니다."}
        {placing && " 배치 중…"}
      </p>

      <div className="field">
        <span>캐릭터</span>
        <div className="segmented">
          {CHARACTER_LIST.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.description}
              aria-pressed={characterId === c.id}
              onClick={() => onCharacterChange(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <label>
        분석 지점으로 이동
        <select
          value=""
          disabled={placing}
          onChange={(e) => {
            const target = destinations.find((d) => d.id === e.target.value);
            if (target) void placeAt({ lat: target.lat, lng: target.lng });
          }}
        >
          <option value="">지점 선택…</option>
          {grouped.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

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

      <label className="field checkbox">
        <input
          type="checkbox"
          checked={freeCamera}
          onChange={(e) => setFreeCamera(e.target.checked)}
        />
        <span>마우스로 시점 회전</span>
      </label>

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
        지형에 붙어 걷습니다(collision: ground). 캐릭터를 바꾸면 있던 자리에서
        그대로 이어집니다.
      </p>
    </Panel>
  );
}
