import { useViewContext } from "@navaramap/three-react";
import { useEffect } from "react";

import { SEOUL } from "../../constants";
import { Panel } from "../../ui/Panel";

/** 불꽃놀이는 야간 씬이 전제다. 태양시를 자정 부근으로 고정한다. */
const NIGHT_SOLAR_TIME = 22;

/**
 * 불꽃놀이 분석 데모 — 아직 미구현.
 *
 * 현재는 야간 씬 전환까지만 한다. 실제 불꽃 구현 시 사용할 후보는
 * `@navaramap/three-default-descs`의 아래 Descriptor들이다.
 * (Declarative/Plugin 티어로 해결되지 않으면 Shader 티어로 내려간다.)
 *
 * - `SelectiveBloomEffectConfig` — 발광체만 선택적으로 블룸 처리
 * - `InstancedSphereMeshConfig` — 입자 다수를 인스턴싱으로 렌더
 * - `PointLight` 계열 Light Descriptor — 폭발 순간의 주변 조명
 * - `LensFlareConfig` — 강한 광원의 렌즈 플레어
 */
export function FireworksAnalysis() {
  const { view } = useViewContext();

  useEffect(() => {
    view.atmosphere.setSolarTime({ lng: SEOUL.lng }, NIGHT_SOLAR_TIME);
  }, [view]);

  return (
    <Panel title="불꽃놀이 분석 — 서울">
      <p className="note">
        미구현. 현재는 야간 씬으로 전환만 합니다.
      </p>
      <p className="note">
        구현 방향: SelectiveBloom으로 발광을 분리하고, 인스턴싱된 구체 메시로
        입자를, PointLight로 주변 조명을 표현합니다. 표현이 부족하면 Shader
        티어에서 커스텀 이펙트를 작성합니다.
      </p>
    </Panel>
  );
}
