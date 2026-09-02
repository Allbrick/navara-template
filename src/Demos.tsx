import type { DefaultPlugin } from "@navaramap/three-default-plugin";
import { useViewContext } from "@navaramap/three-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FireworksAnalysis } from "./demos/fireworks/FireworksAnalysis";
import { SunriseAnalysis } from "./demos/sunrise/SunriseAnalysis";
import { LAUNCH_SITES, VIEWPOINTS } from "./demos/fireworks/constants";
import { SUNRISE_VIEWPOINTS } from "./demos/sunrise/constants";
import { WalkDemo, type Destination } from "./demos/walk/WalkDemo";
import { BaseLayers } from "./scene/BaseLayers";
import type { BasemapId } from "./scene/basemaps";
import { Clouds, type CloudQuality } from "./scene/Clouds";
import {
  CHARACTERS,
  DEFAULT_CHARACTER,
  type CharacterId,
} from "./scene/characters";
import {
  applyModelOffset,
  hideModelNodes,
  setModelVisible,
  type PersonViews,
} from "./scene/personView";
import { PhotorealScene } from "./scene/PhotorealScene";
import { WaterReflection } from "./scene/WaterReflection";
import { SceneControls } from "./ui/SceneControls";

/** 서로 배타적인 분석 데모. 한 번에 하나만 활성화된다. */
const ANALYSES = [
  { id: "sunrise", label: "일출" },
  { id: "fireworks", label: "불꽃놀이" },
] as const;

type AnalysisId = (typeof ANALYSES)[number]["id"];

type Props = {
  defaultPlugin: DefaultPlugin;
  personViews: PersonViews;
};

/**
 * ViewProvider 내부에서 모드 상태를 갖는다.
 *
 * 이 상태를 App에 두면 ViewProvider가 리렌더되고, ViewProvider의 초기화
 * effect가 옵션 객체 신원 변화로 재실행되면서 경고를 출력한다. 상태를
 * Provider 안쪽에 두어 그 경로를 막는다.
 *
 * 모드는 두 축이다. **분석**(일출/불꽃놀이)은 서로 배타적이고, **탐방**은 그와
 * 무관하게 켜고 끈다 — 분석 패널을 띄워둔 채로 현장을 걸어다닐 수 있다.
 */
export function Demos({ defaultPlugin, personViews }: Props) {
  const [characterId, setCharacterId] = useState<CharacterId>(DEFAULT_CHARACTER);
  const personView = personViews[characterId];
  const [analysis, setAnalysis] = useState<AnalysisId>("sunrise");
  const [walking, setWalking] = useState(false);

  // 배경지도·하늘은 데모와 무관한 씬 전체 설정이라 여기서 들고 공유한다.
  const [basemap, setBasemap] = useState<BasemapId>("satellite");
  const [cloudCoverage, setCloudCoverage] = useState(0.3);
  const [cloudQuality, setCloudQuality] = useState<CloudQuality>("medium");
  // 기본값 off. SSR은 고고도 광역 시점에서 화면 전체를 어둡게 만든다
  // (근접 수면 시점에서는 정상). WaterReflection 주석 참고.
  const [reflections, setReflections] = useState(false);
  const { view } = useViewContext();

  /**
   * 탐방 중 바로 이동할 수 있는 분석 지점들. 여기서 모아 넘기므로 WalkDemo는
   * 어느 분석에서 온 지점인지 몰라도 된다.
   */
  const destinations = useMemo<Destination[]>(
    () => [
      ...SUNRISE_VIEWPOINTS.map((v) => ({
        id: `sunrise-${v.id}`,
        group: "일출 관측지",
        name: v.name,
        lng: v.lng,
        lat: v.lat,
      })),
      ...VIEWPOINTS.map((v) => ({
        id: `fireworks-${v.id}`,
        group: "불꽃놀이 관측지",
        name: v.name,
        lng: v.lng,
        lat: v.lat,
      })),
      ...LAUNCH_SITES.map((site) => ({
        id: `fireworks-launch-${site.id}`,
        group: "불꽃놀이 관측지",
        name: site.name,
        lng: site.lng,
        lat: site.lat,
      })),
    ],
    [],
  );

  // 개발 중 콘솔에서 엔진 API를 직접 두드려 보기 위한 핸들.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window as unknown as Record<string, unknown>, {
      view,
      personView,
    });
  }, [view, personView]);

  /**
   * 카메라 반납은 여기서 일원화한다. 분석을 바꾸거나 탐방을 끄면 카메라를 view에
   * 돌려준다. 탐방 중에는 분석을 바꿔도 계속 걸어다닐 수 있어야 하므로 그대로 둔다.
   * (각 분석 패널의 "관람 종료" 버튼은 사용자가 직접 멈추는 별개 경로다.)
   */
  useEffect(() => {
    // 활성 캐릭터만이 아니라 전부 멈춘다. 전환 직후 이전 캐릭터가 카메라를
    // 붙들고 있는 상태가 남을 수 있기 때문이다.
    if (!walking) for (const pv of Object.values(personViews)) pv.stop();
  }, [analysis, walking, personViews]);

  /**
   * 캐릭터 전환. 모델을 바꿀 수 없으니 인스턴스를 갈아탄다 —
   * 이전 것의 상태를 읽어 새 것에 옮겨 심고 시작한다.
   */
  const previousCharacter = useRef(characterId);
  useEffect(() => {
    const from = previousCharacter.current;
    if (from === characterId) return;
    previousCharacter.current = characterId;
    if (!walking) return;

    const previous = personViews[from];
    const next = personViews[characterId];
    const state = previous.getState();

    previous.stop();
    next.teleport({
      lng: state.lng,
      lat: state.lat,
      alt: state.alt,
      heading: state.heading,
    });
    next.setViewMode(state.mode);
    next.start();
  }, [characterId, walking, personViews]);

  // 활성 캐릭터만 보이게 한다. stop()은 모델을 치우지 않아서, 이걸 안 하면
  // 캐릭터를 바꿨을 때 이전 모델이 그 자리에 그대로 서 있는다.
  useEffect(() => {
    const cancels = Object.entries(personViews).map(([id, pv]) =>
      setModelVisible(pv, id === characterId),
    );
    return () => cancels.forEach((cancel) => cancel());
  }, [characterId, personViews, walking]);

  // 모델에 딸려 온 불필요한 노드를 숨긴다 (human.glb의 바닥 평면 등).
  useEffect(
    () => hideModelNodes(personView, CHARACTERS[characterId].hiddenNodes),
    [personView, characterId, walking],
  );

  // 메시가 원점에서 벗어난 모델을 가운데로 맞춘다 (pink.glb 등).
  useEffect(
    () => applyModelOffset(personView, CHARACTERS[characterId].modelOffset),
    [personView, characterId, walking],
  );

  return (
    <>
      {/*
        같은 밤이라도 씬 성격에 따라 야간 노출을 달리 잡는다. 불꽃놀이는 발광체가
        많아 별을 위한 높은 노출을 쓰면 폭발이 전부 하얗게 포화된다(실측: 4에서
        이미 형태가 뭉개짐). 1.8이 폭발의 색·형태를 지키면서 어두운 하늘에 별이
        보이는 지점이다.
      */}
      <PhotorealScene
        plugin={defaultPlugin}
        nightExposure={analysis === "fireworks" ? 1.8 : 25}
      />
      <BaseLayers basemap={basemap} />
      <Clouds coverage={cloudCoverage} quality={cloudQuality} />
      <WaterReflection enabled={reflections} />

      <nav className="modes">
        <div className="tabs" role="group" aria-label="분석">
          {ANALYSES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={analysis === id}
              onClick={() => setAnalysis(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="tabs standalone">
          <button
            type="button"
            aria-pressed={walking}
            onClick={() => setWalking((on) => !on)}
          >
            탐방 {walking ? "종료" : "시작"}
          </button>
        </div>
      </nav>

      <SceneControls
        basemap={basemap}
        onBasemapChange={setBasemap}
        coverage={cloudCoverage}
        onCoverageChange={setCloudCoverage}
        quality={cloudQuality}
        onQualityChange={setCloudQuality}
        reflections={reflections}
        onReflectionsChange={setReflections}
      />

      <div className="panel-stack">
        {analysis === "sunrise" && <SunriseAnalysis personView={personView} />}
        {analysis === "fireworks" && (
          <FireworksAnalysis personView={personView} />
        )}
        {walking && (
          <WalkDemo
            personView={personView}
            destinations={destinations}
            characterId={characterId}
            onCharacterChange={setCharacterId}
          />
        )}
      </div>
    </>
  );
}
