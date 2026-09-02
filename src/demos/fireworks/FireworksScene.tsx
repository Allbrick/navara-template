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
import { DEFAULT_SIM_CONFIG, FireworksSim } from "./particles";

/**
 * 불꽃 색상.
 *
 * 색마다 별도의 InstancedSphereMesh를 만든다. 인스턴스별 `color`는 diffuse에만
 * 곱해지는데 야간 씬에는 비출 광원이 없어 아무 효과가 없고, 실제로 보이는 것은
 * emissive다. 그런데 emissiveColor는 메시 단위 공유라 인스턴스별로 줄 수 없다.
 * 따라서 색 = 메시로 나누는 것이 이 API에서 색을 표현하는 유일한 방법이다.
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
      PALETTE.map((hex) => ({
        geodetic: {
          lng: site.lng,
          lat: site.lat,
          height: LAUNCH_BASE_HEIGHT_M,
        },
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
          key={`${site.id}-${PALETTE[i]}`}
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
        strength: 1.1,
        radius: 0.55,
        threshold: 0.2,
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
