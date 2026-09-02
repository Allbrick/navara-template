import { Color } from "@navaramap/three";
import type {
  InstancedSphereMeshDesc,
  SphereChildConfig,
} from "@navaramap/three-default-descs";
import { EffectDesc, MeshDesc, useViewContext } from "@navaramap/three-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  BLOOM_EFFECT_ID,
  BURST_HEIGHT_M,
  LAUNCH_BASE_HEIGHT_M,
  LAUNCH_SITE,
} from "./constants";
import { DEFAULT_SIM_CONFIG, FireworksSim } from "./particles";

/**
 * 불꽃 색상.
 *
 * 색마다 별도의 InstancedSphereMesh를 만든다. 인스턴스별 `color`는 diffuse에만
 * 곱해지는데 야간 씬에는 비출 광원이 없어 아무 효과가 없고, 실제로 보이는 것은
 * emissive다. 그런데 emissiveColor는 메시 단위 공유라 인스턴스별로 줄 수 없다.
 * 따라서 색 = 메시로 나누는 것이 이 API에서 색을 표현하는 유일한 방법이다.
 * draw call은 색 개수만큼(6)으로 늘지만 무시할 만하다.
 */
const PALETTE = [
  "#ff5964",
  "#ffb03a",
  "#7ee787",
  "#6ec6ff",
  "#c792ea",
  "#fff1c1",
];

/** 발광 세기. 너무 높이면 블룸이 포화돼 색이 전부 흰색으로 날아간다. */
const EMISSIVE_INTENSITY = 2.2;

/**
 * 불꽃 렌더링.
 *
 * Navara 기본 Descriptor에는 PointLight가 없어 폭발이 주변 지형을 비추지는
 * 않는다. 그 표현이 필요하면 Shader 티어에서 커스텀 라이트 Descriptor를
 * 작성해야 한다.
 */
export function FireworksScene() {
  const { view } = useViewContext();
  const simRef = useRef<FireworksSim | null>(null);
  const meshRefs = useRef<(InstancedSphereMeshDesc | null)[]>([]);
  const lastTimeRef = useRef<number | null>(null);

  const meshConfigs = useMemo(
    () =>
      PALETTE.map((hex) => ({
        geodetic: { ...LAUNCH_SITE, height: LAUNCH_BASE_HEIGHT_M },
        effectIds: [BLOOM_EFFECT_ID],
        spheres: {
          widthSegments: 8,
          heightSegments: 8,
          color: new Color().setStyle(hex),
          emissiveColor: new Color().setStyle(hex),
          emissiveIntensity: EMISSIVE_INTENSITY,
          children: [] as SphereChildConfig[],
        },
      })),
    [],
  );

  const bloomConfig = useMemo(
    () => ({
      id: BLOOM_EFFECT_ID,
      selectiveEffect: true as const,
      selectiveBloom: {
        strength: 1.1,
        radius: 0.55,
        threshold: 0.2,
      },
    }),
    [],
  );

  useEffect(() => {
    const sim = new FireworksSim({
      ...DEFAULT_SIM_CONFIG,
      burstHeightM: BURST_HEIGHT_M,
    });
    simRef.current = sim;
    if (import.meta.env.DEV) {
      (window as unknown as { fireworks?: unknown }).fireworks = sim;
    }

    // preRender는 렌더 직전에 발생한다. ViewProvider에 animation이 켜져 있어야
    // 매 프레임 돈다(없으면 변화가 있을 때만 렌더되어 애니메이션이 멈춘다).
    const onFrame = (t: number) => {
      const previous = lastTimeRef.current;
      lastTimeRef.current = t;
      if (previous === null) return;

      sim.step((t - previous) / 1000);

      // 색 인덱스별로 인스턴스를 나눠 담는다.
      const buckets: SphereChildConfig[][] = PALETTE.map(() => []);
      for (const p of sim.particles) {
        const remaining = FireworksSim.remaining(p);
        buckets[p.color % PALETTE.length].push({
          position: { x: p.x, y: p.y, z: p.z },
          // 인스턴스별 발광 감쇠가 불가능하므로 크기로 소멸을 표현한다.
          radius: p.radius * (p.kind === "shell" ? 1 : remaining),
        });
      }

      buckets.forEach((instances, i) => {
        meshRefs.current[i]?.replaceAll(instances);
      });
    };

    view.on("preRender", onFrame);
    return () => {
      view.off("preRender", onFrame);
      lastTimeRef.current = null;
      simRef.current = null;
    };
  }, [view]);

  const makeOnReady = useCallback(
    (index: number) => (handle: { ref: InstancedSphereMeshDesc }) => {
      meshRefs.current[index] = handle.ref;
      return () => {
        meshRefs.current[index] = null;
      };
    },
    [],
  );

  return (
    <>
      <EffectDesc config={bloomConfig} />
      {meshConfigs.map((config, i) => (
        <MeshDesc key={PALETTE[i]} config={config} onReady={makeOnReady(i)} />
      ))}
    </>
  );
}
