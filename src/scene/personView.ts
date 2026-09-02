import { PersonViewPlugin } from "@navaramap/three-plugins";

import { SEOUL } from "../constants";
import { CHARACTERS, type Character, type CharacterId } from "./characters";

export type PersonViews = Record<CharacterId, PersonViewPlugin>;

function createFor(character: Character): PersonViewPlugin {
  return new PersonViewPlugin({
    character: {
      modelUrl: character.modelUrl,
      animation: {
        ...character.animation,
        dashSpeed: 2,
        crossfadeDuration: 0.3,
      },
      modelRotationOffset: character.modelRotationOffset,
      modelScale: character.modelScale,
      castShadow: true,
      receiveShadow: true,
    },
    // 지형에 붙어 걷는다. off면 공중을 자유 비행한다.
    collision: { mode: "ground" },
    moveSpeed: 10,
    dashSpeedMultiplier: 4,
    cameraDistance: character.cameraDistance,
    cameraPitch: 14.4,
    fpvHeightOffset: character.fpvHeightOffset,
    fpvPitch: 2.9,
    initialView: "tpv",
    // 배치 전 기본값. 실제 위치는 사용자가 정한다.
    startLng: SEOUL.lng,
    startLat: SEOUL.lat,
  });
}

/**
 * 캐릭터마다 플러그인 인스턴스를 하나씩 만든다.
 *
 * `PersonViewPlugin`의 `character`는 생성자 전용이라 런타임에 모델을 바꿀 수 없다.
 * 플러그인은 `view.init()` 전에 전부 등록해야 하므로 앱 시작 시 한 번에 만들고,
 * 전환은 "이전 것 stop → 새 것 teleport + start"로 처리한다.
 *
 * 모델은 `start()` 시점에 로드되므로, 쓰지 않는 캐릭터의 모델은 내려받지 않는다.
 */
export function createPersonViews(): PersonViews {
  return {
    fox: createFor(CHARACTERS.fox),
    human: createFor(CHARACTERS.human),
    penguin: createFor(CHARACTERS.penguin),
  };
}

/**
 * 캐릭터 모델의 표시 여부를 정한다.
 *
 * `stop()`은 카메라와 키 입력만 반납할 뿐 모델을 치우지 않는다. 캐릭터를 바꾸면
 * 이전 모델이 그 자리에 계속 서 있게 되므로 명시적으로 숨겨야 한다.
 *
 * 모델은 `start()` 이후 비동기로 로드되므로 잠시 기다렸다 적용한다.
 * 반환값은 정리 함수 — 아직 대기 중이면 취소한다.
 */
export function setModelVisible(
  personView: PersonViewPlugin,
  visible: boolean,
  { attempts = 40, intervalMs = 100 } = {},
): () => void {
  let cancelled = false;
  let left = attempts;

  const tick = () => {
    if (cancelled) return;
    const model = personView.model;
    if (model) {
      model.update({ visible });
      return;
    }
    // 아직 로드 전. 보이게 할 때는 기다리고, 숨길 때도 나중에 로드될 수 있으니 지켜본다.
    if (--left > 0) setTimeout(tick, intervalMs);
  };
  tick();

  return () => {
    cancelled = true;
  };
}

type Object3DLike = {
  name?: string;
  visible?: boolean;
  children?: Object3DLike[];
};

function hideByName(node: Object3DLike, names: Set<string>): number {
  let hidden = 0;
  if (node.name && names.has(node.name)) {
    node.visible = false;
    hidden++;
  }
  for (const child of node.children ?? []) hidden += hideByName(child, names);
  return hidden;
}

/**
 * 모델 안의 특정 노드를 숨긴다 (human.glb에 딸려 오는 바닥 평면 등).
 *
 * 모델은 `start()` 이후 비동기로 로드되므로 잠시 기다렸다 적용한다.
 * 반환값은 정리 함수 — 아직 대기 중이면 취소한다.
 */
export function hideModelNodes(
  personView: PersonViewPlugin,
  names: string[] | undefined,
  { attempts = 40, intervalMs = 100 } = {},
): () => void {
  if (!names || names.length === 0) return () => {};

  const wanted = new Set(names);
  let cancelled = false;
  let left = attempts;

  const tick = () => {
    if (cancelled) return;
    const raw = personView.model?.ref?.raw as Object3DLike | undefined;
    if (raw) {
      hideByName(raw, wanted);
      return;
    }
    if (--left > 0) setTimeout(tick, intervalMs);
  };
  tick();

  return () => {
    cancelled = true;
  };
}
