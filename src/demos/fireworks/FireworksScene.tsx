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
  LAUNCH_SITES,
  type LaunchSite,
} from "./constants";
import {
  DEFAULT_SIM_CONFIG,
  FireworksSim,
  type Particle,
} from "./particles";

/** 불꽃 색상. */
const PALETTE = [
  "#ff5964",
  "#ffb03a",
  "#7ee787",
  "#6ec6ff",
  "#c792ea",
  "#fff1c1",
];

/**
 * 밝기 단계.
 *
 * 인스턴스별 발광 세기를 줄 수 없어서(emissiveColor/Intensity는 메시 단위 공유)
 * 단계마다 메시를 따로 만들고, 입자가 나이 들면 그 프레임의 인스턴스를 어두운
 * 메시로 옮긴다. 크기 축소만으로 소멸을 표현하던 것보다 실제 연화의 감광에
 * 가깝다. 메시 수는 색(6) × 단계(3) = 18개가 되지만 전부 인스턴싱이라
 * draw call만 늘고 인스턴스 총량은 그대로다.
 */
const TIERS = [3.4, 1.7, 0.75];

/** 입자 상태로 밝기 단계를 고른다. */
function tierOf(p: Particle): number {
  if (p.kind === "flash" || p.kind === "shell") return 0;
  if (p.kind === "trail") return 2;

  const remaining = FireworksSim.remaining(p);
  if (remaining > 0.6) return 0;
  if (remaining > 0.28) return 1;
  return 2;
}

/** 화면에 그릴 반경. 종류마다 소멸하는 모양이 다르다. */
function radiusOf(p: Particle): number {
  const remaining = FireworksSim.remaining(p);
  switch (p.kind) {
    case "shell":
      return p.radius;
    case "flash":
      // 섬광은 순간적으로 커졌다 사라진다.
      return p.radius * Math.sin(Math.PI * (1 - remaining)) * 0.9 + p.radius * 0.3;
    case "trail":
      return p.radius * remaining;
    default:
      // 불꽃은 끝에서만 급히 줄어든다. 중간에는 밝기 단계가 감광을 맡는다.
      return p.radius * Math.min(1, remaining * 2.2);
  }
}

/** 색 × 밝기 단계 조합. 버킷 인덱스로 쓴다. */
const LAYERS = PALETTE.flatMap((hex, color) =>
  TIERS.map((intensity, tier) => ({ hex, color, tier, intensity })),
);

const layerIndex = (color: number, tier: number) =>
  (color % PALETTE.length) * TIERS.length + tier;

/**
 * 발사 지점 한 곳의 불꽃.
 *
 * 지점마다 시뮬레이션을 따로 돌린다. 발사 간격에 난수가 섞여 있어 두 지점이
 * 저절로 어긋나며 터진다.
 */
function FireworksBurst({ site, index }: { site: LaunchSite; index: number }) {
  const { view } = useViewContext();
  const meshRefs = useRef<(InstancedSphereMeshDesc | null)[]>([]);
  const lastTimeRef = useRef<number | null>(null);

  const meshConfigs = useMemo(
    () =>
      LAYERS.map((layer) => ({
        geodetic: {
          lng: site.lng,
          lat: site.lat,
          height: LAUNCH_BASE_HEIGHT_M,
        },
        effectIds: [BLOOM_EFFECT_ID],
        spheres: {
          // 입자가 많아 세그먼트를 낮게 잡는다. 멀리서 점으로 보이므로 충분하다.
          widthSegments: 6,
          heightSegments: 6,
          color: new Color().setStyle(layer.hex),
          emissiveColor: new Color().setStyle(layer.hex),
          emissiveIntensity: layer.intensity,
          children: [] as SphereChildConfig[],
        },
      })),
    [site.lng, site.lat],
  );

  useEffect(() => {
    const sim = new FireworksSim({
      ...DEFAULT_SIM_CONFIG,
      burstHeightM: BURST_HEIGHT_M,
    });
    if (import.meta.env.DEV) {
      const w = window as unknown as { fireworks?: FireworksSim[] };
      w.fireworks ??= [];
      w.fireworks[index] = sim;
    }

    // preRender는 렌더 직전에 발생한다. ViewProvider에 animation이 켜져 있어야
    // 매 프레임 돈다(없으면 변화가 있을 때만 렌더되어 애니메이션이 멈춘다).
    const onFrame = (t: number) => {
      const previous = lastTimeRef.current;
      lastTimeRef.current = t;
      if (previous === null) return;

      sim.step((t - previous) / 1000);

      const buckets: SphereChildConfig[][] = LAYERS.map(() => []);
      for (const p of sim.particles) {
        buckets[layerIndex(p.color, tierOf(p))].push({
          position: { x: p.x, y: p.y, z: p.z },
          radius: radiusOf(p),
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
    };
  }, [view, index]);

  const makeOnReady = useCallback(
    (i: number) => (handle: { ref: InstancedSphereMeshDesc }) => {
      meshRefs.current[i] = handle.ref;
      return () => {
        meshRefs.current[i] = null;
      };
    },
    [],
  );

  return (
    <>
      {meshConfigs.map((config, i) => (
        <MeshDesc
          key={`${site.id}-${LAYERS[i].hex}-${LAYERS[i].tier}`}
          config={config}
          onReady={makeOnReady(i)}
        />
      ))}
    </>
  );
}

/**
 * 불꽃 렌더링.
 *
 * 블룸은 전체가 공유하는 하나의 이펙트이므로 여기서 한 번만 선언하고, 발사
 * 지점별 메시가 `effectIds`로 거기에 묶인다.
 *
 * Navara 기본 Descriptor에는 PointLight가 없어 폭발이 주변 지형을 비추지는
 * 않는다. 그 표현이 필요하면 Shader 티어에서 커스텀 라이트 Descriptor를
 * 작성해야 한다.
 */
export function FireworksScene() {
  const bloomConfig = useMemo(
    () => ({
      id: BLOOM_EFFECT_ID,
      selectiveEffect: true as const,
      selectiveBloom: {
        strength: 1.15,
        radius: 0.6,
        threshold: 0.18,
      },
    }),
    [],
  );

  return (
    <>
      <EffectDesc config={bloomConfig} />
      {LAUNCH_SITES.map((site, i) => (
        <FireworksBurst key={site.id} site={site} index={i} />
      ))}
    </>
  );
}
