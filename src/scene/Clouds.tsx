import { EffectDesc } from "@navaramap/three-react";
import { useMemo } from "react";

export type CloudQuality = "low" | "medium" | "high" | "ultra";

type Props = {
  /** 구름 양 (0 = 맑음, 1 = 완전히 덮임) */
  coverage: number;
  quality: CloudQuality;
};

/**
 * 볼류메트릭 구름.
 *
 * `addDefaultPhotorealScene()`에는 포함되지 않으므로 따로 추가한다.
 * 레이마칭 기반이라 프레임 비용이 큰 편이다 — coverage가 0이면 세기만 0으로
 * 두지 않고 **이펙트 자체를 언마운트**해 패스를 파이프라인에서 제거한다.
 */
export function Clouds({ coverage, quality }: Props) {
  const config = useMemo(
    () => ({
      id: "clouds",
      clouds: {
        coverage,
        qualityPreset: quality,
        // 구름 그림자는 지형까지 어둡게 만들지만 비용이 크다. 필요하면 켜세요.
        shadows: false,
        haze: true,
      },
    }),
    [coverage, quality],
  );

  if (coverage <= 0) return null;

  return <EffectDesc config={config} />;
}
