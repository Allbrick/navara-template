import type { DefaultPlugin } from "@navaramap/three-default-plugin";
import { useViewContext } from "@navaramap/three-react";
import { useEffect } from "react";

import { SEOUL } from "../constants";

/**
 * 별 밝기. 기본값으로는 노출을 올려도 거의 보이지 않는다.
 * Navara 예제는 노출 40에 intensity 100을 쓰는데, 여기서는 노출을 그보다
 * 낮게 잡으므로 세기를 더 올려 균형을 맞춘다.
 */
const STAR_INTENSITY = 140;
const STAR_POINT_SIZE = 1.1;

/**
 * 달 크기 배율. 실제 달의 시직경은 약 0.5°라 기본값(1)으로는 화면에서 점에
 * 가깝다. 눈에 들어오도록 과장한 값이며, 사실성이 중요하면 1로 되돌리세요.
 */
const MOON_SCALE = 2.5;
const MOON_INTENSITY = 2;

/** 낮의 톤매핑 노출. 엔진 기본값과 같다. */
const DAY_EXPOSURE = 1;
/** 태양 고도가 이 값 아래로 내려가면 완전한 밤으로 본다 (천문박명). */
const NIGHT_ELEVATION_DEG = -12;

/**
 * 태양 고도에 따른 노출.
 *
 * 밤하늘의 별은 노출을 크게 올려야 보이지만, 같은 노출을 낮에 쓰면 화면이
 * 하얗게 날아간다. 그래서 카메라처럼 태양 고도에 맞춰 노출을 옮긴다.
 */
export function exposureFor(sunElevationDeg: number, nightExposure: number) {
  const t = Math.min(1, Math.max(0, -sunElevationDeg / -NIGHT_ELEVATION_DEG));
  // 제곱을 씌워 박명 구간에서는 천천히, 완전히 어두워질 때 크게 올라가게 한다.
  return DAY_EXPOSURE + (nightExposure - DAY_EXPOSURE) * t * t;
}

type Props = {
  plugin: DefaultPlugin;
  /**
   * 완전한 밤일 때의 노출. 별이 잘 보이려면 크게, 발광체(불꽃 등)가 있는
   * 씬에서는 작게 잡는다.
   */
  nightExposure?: number;
};

/**
 * 하늘 / 별 / 태양광 / 대기 원근 / 톤매핑 / AA 번들을 한 번에 등록하고,
 * 밤하늘이 실제로 보이도록 별·달·노출을 손본다.
 *
 * `addDefaultPhotorealScene()`는 반드시 `view.init()` 이후에 호출해야 한다.
 * ViewProvider는 init이 끝난 뒤에야 children을 렌더링하므로, 이 컴포넌트가
 * ViewProvider 안에 있는 한 순서는 보장된다.
 */
export function PhotorealScene({ plugin, nightExposure = 25 }: Props) {
  const { view } = useViewContext();

  useEffect(() => {
    const scene = plugin.addDefaultPhotorealScene();

    // 달은 기본으로 켜져 있고 위상도 날짜에 맞춰 정확히 그려지지만, 기본
    // 크기로는 눈에 띄지 않아 키운다.
    scene.sky.update({
      sky: { moon: true, moonScale: MOON_SCALE, moonIntensity: MOON_INTENSITY },
    });
    scene.stars.update({
      stars: { intensity: STAR_INTENSITY, pointSize: STAR_POINT_SIZE },
    });

    if (import.meta.env.DEV) {
      (window as unknown as { photoreal?: unknown }).photoreal = scene;
    }

    return () => {
      // 핸들 역순 정리. 반환된 핸들 중 lensFlare는 환경에 따라 없을 수 있다.
      scene.antialiasing.delete();
      scene.toneMapping.delete();
      scene.lensFlare?.delete();
      scene.aerialPerspective.delete();
      scene.sun.delete();
      scene.skyLightProbe.delete();
      scene.stars.delete();
      scene.sky.delete();
    };
  }, [plugin]);

  // 시각이 바뀔 때만 노출을 다시 계산한다. 매 프레임 천문 계산을 돌릴 이유가 없다.
  useEffect(() => {
    const { atmosphere } = view;
    let lastDateMs = Number.NaN;

    const onFrame = () => {
      const ms = atmosphere.date.getTime();
      if (ms === lastDateMs) return;
      lastDateMs = ms;
      view.toneMappingExposure = exposureFor(
        atmosphere.getSunElevation(SEOUL),
        nightExposure,
      );
    };

    view.on("preRender", onFrame);
    return () => {
      view.off("preRender", onFrame);
      view.toneMappingExposure = DAY_EXPOSURE;
    };
  }, [view, nightExposure]);

  return null;
}
