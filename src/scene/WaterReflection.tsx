import type { SSREffectDesc } from "@navaramap/three-default-descs";
import { EffectDesc } from "@navaramap/three-react";
import { useMemo } from "react";

type Props = {
  enabled: boolean;
};

/**
 * 화면 공간 반사(SSR).
 *
 * 물 표면 자체는 **지형 소스의 워터마스크**가 만든다 — quantized-mesh 소스에
 * `requestWaterMask: true`를 주면 엔진이 수면을 반사 재질로 처리한다. SSR은
 * 거기에 실제로 비칠 상을 그려 넣는 역할이다. 둘 중 하나만 있으면 물이
 * 밋밋하거나(마스크만) 비칠 곳이 없다(SSR만).
 *
 * **고고도 광역 시점에서는 화면 전체가 어두워진다.** 수면 가까이(수백 m)에서는
 * 정상적으로 보이지만, 12km 상공에서 내려다보면 지형은 물론 하늘까지 어두운
 * 남색으로 덮인다. 화면 공간에 비칠 것이 거의 없는 시점에서 합성 결과가 무너지는
 * 것으로 보이며, 원인은 아직 규명하지 못했다. 그래서 **기본값을 off**로 두고
 * 수면을 볼 때만 켜도록 했다.
 *
 * 조절할 여지는 있다 — `maxRayDistance`, `blendMode`, `coneTracingMaxDistance`
 * 등이 SSROptions에 있으므로, 고도에 따라 조정하거나 일정 고도 이상에서 자동으로
 * 끄는 방식도 가능하다.
 *
 * 레이마칭 기반이라 비용도 있으므로 어느 쪽이든 끌 수 있게 해 둔다.
 */
export function WaterReflection({ enabled }: Props) {
  const config = useMemo(() => ({ id: "ssr", ssr: {} }), []);

  if (!enabled) return null;

  return <EffectDesc<SSREffectDesc> config={config} />;
}
