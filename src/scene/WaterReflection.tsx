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
 * 레이마칭 기반이라 비용이 있으므로 끌 수 있게 해 둔다.
 */
export function WaterReflection({ enabled }: Props) {
  const config = useMemo(() => ({ id: "ssr", ssr: {} }), []);

  if (!enabled) return null;

  return <EffectDesc<SSREffectDesc> config={config} />;
}
