import type { DefaultPlugin } from "@navaramap/three-default-plugin";
import type { PersonViewPlugin } from "@navaramap/three-plugins";
import { useViewContext } from "@navaramap/three-react";
import { useEffect, useState } from "react";

import { FireworksAnalysis } from "./demos/fireworks/FireworksAnalysis";
import { SunriseAnalysis } from "./demos/sunrise/SunriseAnalysis";
import { WalkDemo } from "./demos/walk/WalkDemo";
import { BaseLayers } from "./scene/BaseLayers";
import { Clouds, type CloudQuality } from "./scene/Clouds";
import { PhotorealScene } from "./scene/PhotorealScene";
import { SkyControls } from "./ui/SkyControls";

const DEMOS = [
  { id: "sunrise", label: "일출" },
  { id: "fireworks", label: "불꽃놀이" },
  { id: "walk", label: "탐방" },
] as const;

type DemoId = (typeof DEMOS)[number]["id"];

type Props = {
  defaultPlugin: DefaultPlugin;
  personView: PersonViewPlugin;
};

/**
 * ViewProvider 내부에서 데모 전환 상태를 갖는다.
 *
 * 이 상태를 App에 두면 ViewProvider가 리렌더되고, ViewProvider의 초기화
 * effect가 옵션 객체 신원 변화로 재실행되면서 경고를 출력한다. 상태를
 * Provider 안쪽에 두어 그 경로를 막는다.
 */
export function Demos({ defaultPlugin, personView }: Props) {
  const [demo, setDemo] = useState<DemoId>("sunrise");
  // 하늘은 데모와 무관한 씬 전체 설정이라 여기서 들고 공유한다.
  const [cloudCoverage, setCloudCoverage] = useState(0.3);
  const [cloudQuality, setCloudQuality] = useState<CloudQuality>("medium");
  const { view } = useViewContext();

  // 개발 중 콘솔에서 엔진 API를 직접 두드려 보기 위한 핸들.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window as unknown as Record<string, unknown>, {
      view,
      personView,
    });
  }, [view, personView]);

  return (
    <>
      <PhotorealScene plugin={defaultPlugin} />
      <BaseLayers />
      <Clouds coverage={cloudCoverage} quality={cloudQuality} />

      <nav className="tabs">
        {DEMOS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={demo === id}
            onClick={() => setDemo(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <SkyControls
        coverage={cloudCoverage}
        onCoverageChange={setCloudCoverage}
        quality={cloudQuality}
        onQualityChange={setCloudQuality}
      />

      {demo === "sunrise" && <SunriseAnalysis personView={personView} />}
      {demo === "fireworks" && <FireworksAnalysis personView={personView} />}
      {demo === "walk" && <WalkDemo personView={personView} />}
    </>
  );
}
