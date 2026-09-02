import type {
  CloudsEffectDesc,
  CloudsUpdate,
} from "@navaramap/three-default-descs";
import { EffectDesc, useViewContext } from "@navaramap/three-react";
import { useEffect, useMemo, useRef } from "react";

import { SEOUL } from "../constants";

export type CloudQuality = "low" | "medium" | "high" | "ultra";

type Props = {
  /** 구름 양 (0 = 맑음, 1 = 완전히 덮임) */
  coverage: number;
  quality: CloudQuality;
};

/**
 * 구름을 비추는 광원은 태양뿐이라, 밤에는 순흑으로 렌더되어 하늘을 검게
 * 도려낸 것처럼 보인다(별이 그 자리에서만 사라진다). 실제 밤 구름은 달빛과
 * 도시광을 받아 회색으로 보이므로, 해가 지면 하늘광·지면 반사광 기여를
 * 끌어올려 형태가 남게 한다.
 */
const DAY_SKY_LIGHT = 1;
const NIGHT_SKY_LIGHT = 14;
const DAY_GROUND_BOUNCE = 1;
const NIGHT_GROUND_BOUNCE = 6;

/** 태양 고도가 이 값 아래면 완전한 밤으로 본다 (천문박명). */
const NIGHT_ELEVATION_DEG = -12;

/** 0 = 낮, 1 = 완전한 밤. */
function nightFactor(sunElevationDeg: number): number {
  return Math.min(1, Math.max(0, -sunElevationDeg / -NIGHT_ELEVATION_DEG));
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 볼류메트릭 구름.
 *
 * `addDefaultPhotorealScene()`에는 포함되지 않으므로 따로 추가한다.
 * 레이마칭 기반이라 프레임 비용이 큰 편이다 — coverage가 0이면 세기만 0으로
 * 두지 않고 **이펙트 자체를 언마운트**해 패스를 파이프라인에서 제거한다.
 */
export function Clouds({ coverage, quality }: Props) {
  const { view } = useViewContext();
  const handleRef = useRef<{ update: (u: CloudsUpdate) => void } | null>(null);

  const config = useMemo(
    () => ({
      id: "clouds",
      clouds: {
        coverage,
        qualityPreset: quality,
        // 구름 그림자는 지형까지 어둡게 만들지만 비용이 크다. 필요하면 켜세요.
        shadows: false,
        haze: true,
        skyLightScale: DAY_SKY_LIGHT,
        groundBounceScale: DAY_GROUND_BOUNCE,
      },
    }),
    [coverage, quality],
  );

  // 밤낮에 따라 조명 기여를 옮긴다. 시각이 바뀔 때만 계산하면 충분하다.
  useEffect(() => {
    if (coverage <= 0) return;
    const { atmosphere } = view;
    let lastDateMs = Number.NaN;

    const onFrame = () => {
      const ms = atmosphere.date.getTime();
      if (ms === lastDateMs) return;
      lastDateMs = ms;

      const t = nightFactor(atmosphere.getSunElevation(SEOUL));
      handleRef.current?.update({
        clouds: {
          skyLightScale: lerp(DAY_SKY_LIGHT, NIGHT_SKY_LIGHT, t),
          groundBounceScale: lerp(DAY_GROUND_BOUNCE, NIGHT_GROUND_BOUNCE, t),
        },
      });
    };

    view.on("preRender", onFrame);
    return () => view.off("preRender", onFrame);
  }, [view, coverage]);

  if (coverage <= 0) return null;

  return (
    // 제네릭을 CloudsEffectDesc로 고정해야 update가 clouds 필드를 받는다.
    // 기본 EffectDesc의 update 타입은 visible만 있는 BaseDescConfigUpdate다.
    <EffectDesc<CloudsEffectDesc>
      config={config}
      onReady={(handle: { update: (u: CloudsUpdate) => void }) => {
        handleRef.current = handle;
        return () => {
          handleRef.current = null;
        };
      }}
    />
  );
}
