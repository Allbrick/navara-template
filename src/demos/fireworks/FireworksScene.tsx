import { Color } from "@navaramap/three";
import type {
  AmbientLightUpdate,
  InstancedSphereMeshDesc,
  SphereChildConfig,
} from "@navaramap/three-default-descs";
import {
  EffectDesc,
  LightDesc,
  MeshDesc,
  useViewContext,
} from "@navaramap/three-react";
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

/** 팔레트를 0~1 RGB로 미리 풀어둔다. 주변 조명 색을 섞는 데 쓴다. */
const PALETTE_RGB = PALETTE.map((hex) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
]);

/**
 * 밝기 단계.
 *
 * 인스턴스별 발광 세기를 줄 수 없어서(emissiveColor/Intensity는 메시 단위 공유)
 * 단계마다 메시를 따로 만들고, 입자가 나이 들면 그 프레임의 인스턴스를 어두운
 * 메시로 옮긴다. 크기 축소만으로 소멸을 표현하던 것보다 실제 연화의 감광에
 * 가깝다.
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

/**
 * 주변 조명 기여도.
 *
 * 기저광(타고 있는 불꽃·잔광)과 섬광을 **따로 합산한다.** 한 덩어리로 더하면
 * 입자 수백 개의 기저값이 커서 상한에 상시 붙어버리고, 정작 터지는 순간의
 * 번쩍임이 묻힌다(실측: 67% 프레임이 상한).
 */
function glowOf(p: Particle): { spark: number; flash: number } {
  switch (p.kind) {
    case "flash":
      // 0 → 1 → 0으로 짧게 부풀었다 꺼진다.
      return { spark: 0, flash: Math.sin(Math.PI * (1 - FireworksSim.remaining(p))) };
    case "shell":
      return { spark: 0.15, flash: 0 };
    case "trail":
      return { spark: 0.04, flash: 0 };
    default:
      return { spark: FireworksSim.remaining(p) > 0.6 ? 1 : 0.35, flash: 0 };
  }
}

/** 최대 주변광 세기. 넘기면 야경이 대낮처럼 떠버린다. */
const MAX_AMBIENT_INTENSITY = 0.42;
/** 타고 있는 불꽃이 만드는 은은한 기저광 배율. */
const SPARK_SCALE = 0.0003;
/** 폭발 섬광 하나가 정점에서 더하는 세기. */
const FLASH_SCALE = 0.3;
/** 세기 변화를 부드럽게 만드는 계수 (프레임당 보간 비율). */
const AMBIENT_SMOOTHING = 0.25;

/** 색 × 밝기 단계 조합. 버킷 인덱스로 쓴다. */
const LAYERS = PALETTE.flatMap((hex, color) =>
  TIERS.map((intensity, tier) => ({ hex, color, tier, intensity })),
);

const layerIndex = (color: number, tier: number) =>
  (color % PALETTE.length) * TIERS.length + tier;

type RegisterMesh = (
  siteIndex: number,
  layer: number,
  desc: InstancedSphereMeshDesc | null,
) => void;

/** 발사 지점 한 곳의 메시들. 그리기만 하고 시뮬레이션은 갖지 않는다. */
function FireworksBurst({
  site,
  siteIndex,
  registerMesh,
}: {
  site: LaunchSite;
  siteIndex: number;
  registerMesh: RegisterMesh;
}) {
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

  const makeOnReady = useCallback(
    (layer: number) => (handle: { ref: InstancedSphereMeshDesc }) => {
      registerMesh(siteIndex, layer, handle.ref);
      return () => registerMesh(siteIndex, layer, null);
    },
    [registerMesh, siteIndex],
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
 * 시뮬레이션·프레임 루프·주변 조명을 여기서 모두 소유한다. 조명은 모든 발사
 * 지점의 상태를 합쳐 하나로 내야 하므로, 지점별 컴포넌트가 각자 루프를 도는
 * 구조로는 만들 수 없다.
 *
 * **주변 조명은 AmbientLight로 근사한다.** 기본 Descriptor에 PointLight가 없어
 * 폭발 지점에서 뻗어나가는 방향성 조명을 만들 수 없다. 대신 살아있는 입자의
 * 발광량을 합쳐 전역 주변광의 세기와 색을 매 프레임 조절한다 — 폭발할 때
 * 야경 전체가 그 색으로 번쩍이는, 실제로 가장 눈에 띄는 효과다.
 * 방향성이 필요하면 Shader 티어에서 커스텀 라이트 Descriptor를 써야 한다.
 */
export function FireworksScene() {
  const { view } = useViewContext();

  // 지점별 시뮬레이션. 발사 간격에 난수가 섞여 있어 저절로 어긋나며 터진다.
  const sims = useMemo(
    () =>
      LAUNCH_SITES.map(
        () =>
          new FireworksSim({
            ...DEFAULT_SIM_CONFIG,
            burstHeightM: BURST_HEIGHT_M,
          }),
      ),
    [],
  );

  const meshRefs = useRef<(InstancedSphereMeshDesc | null)[][]>(
    LAUNCH_SITES.map(() => LAYERS.map(() => null)),
  );
  // desc의 onUpdateConfig를 직접 부르지 않고 핸들의 update를 쓴다 —
  // 핸들 쪽이 리렌더 요청 같은 부수 처리를 함께 해준다.
  const lightRef = useRef<{ update: (u: AmbientLightUpdate) => void } | null>(
    null,
  );
  const lightColor = useRef(new Color().setStyle("#ffffff"));
  const smoothedIntensity = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  const registerMesh = useCallback<RegisterMesh>((siteIndex, layer, desc) => {
    meshRefs.current[siteIndex][layer] = desc;
  }, []);

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

  const ambientConfig = useMemo(
    () => ({
      // LightConfig는 전부 선택 속성인 weak type이라, 공통 속성이 하나도 없으면
      // 타입이 거부된다. id를 주면서 동시에 나중에 찾기도 쉬워진다.
      id: "fireworks-ambient",
      ambient: { color: lightColor.current, intensity: 0 },
    }),
    [],
  );

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { fireworks?: FireworksSim[] }).fireworks = sims;
    }

    // preRender는 렌더 직전에 발생한다. ViewProvider에 animation이 켜져 있어야
    // 매 프레임 돈다(없으면 변화가 있을 때만 렌더되어 애니메이션이 멈춘다).
    const onFrame = (t: number) => {
      const previous = lastTimeRef.current;
      lastTimeRef.current = t;
      if (previous === null) return;
      const dt = (t - previous) / 1000;

      let sparkGlow = 0;
      let flashGlow = 0;
      // 색은 두 기여를 합친 가중치로 섞는다. 터지는 순간에는 섬광 색이 이긴다.
      let colorWeight = 0;
      const rgb = [0, 0, 0];

      sims.forEach((sim, siteIndex) => {
        sim.step(dt);

        const buckets: SphereChildConfig[][] = LAYERS.map(() => []);
        for (const p of sim.particles) {
          buckets[layerIndex(p.color, tierOf(p))].push({
            position: { x: p.x, y: p.y, z: p.z },
            radius: radiusOf(p),
          });

          const glow = glowOf(p);
          sparkGlow += glow.spark;
          flashGlow += glow.flash;

          const w = glow.spark * SPARK_SCALE + glow.flash * FLASH_SCALE;
          if (w > 0) {
            const c = PALETTE_RGB[p.color % PALETTE_RGB.length];
            colorWeight += w;
            rgb[0] += c[0] * w;
            rgb[1] += c[1] * w;
            rgb[2] += c[2] * w;
          }
        }

        const refs = meshRefs.current[siteIndex];
        buckets.forEach((instances, i) => {
          refs[i]?.replaceAll(instances);
        });
      });

      // 세기를 급격히 바꾸면 깜빡임이 거슬리므로 프레임 간 보간한다.
      const target = Math.min(
        MAX_AMBIENT_INTENSITY,
        sparkGlow * SPARK_SCALE + flashGlow * FLASH_SCALE,
      );
      smoothedIntensity.current +=
        (target - smoothedIntensity.current) * AMBIENT_SMOOTHING;

      if (colorWeight > 0) {
        lightColor.current.setRGB(
          rgb[0] / colorWeight,
          rgb[1] / colorWeight,
          rgb[2] / colorWeight,
        );
      }

      lightRef.current?.update({
        ambient: {
          color: lightColor.current,
          intensity: smoothedIntensity.current,
        },
      });
    };

    view.on("preRender", onFrame);
    return () => {
      view.off("preRender", onFrame);
      lastTimeRef.current = null;
    };
  }, [view, sims]);

  return (
    <>
      <EffectDesc config={bloomConfig} />
      <LightDesc
        config={ambientConfig}
        onReady={(handle: { update: (u: AmbientLightUpdate) => void }) => {
          lightRef.current = handle;
          return () => {
            lightRef.current = null;
          };
        }}
      />
      {LAUNCH_SITES.map((site, i) => (
        <FireworksBurst
          key={site.id}
          site={site}
          siteIndex={i}
          registerMesh={registerMesh}
        />
      ))}
    </>
  );
}
