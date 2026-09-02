import type { AttributionItem } from "@navaramap/three";

import humanUrl from "../models/human.glb?url";
import penguinUrl from "../models/pink.glb?url";

/**
 * 탐방에 쓸 캐릭터 정의.
 *
 * `PersonViewPlugin`의 `character`는 **생성자 전용**이라 런타임에 모델을 바꿀 수
 * 없다. 그래서 캐릭터마다 플러그인 인스턴스를 따로 만들어 두고 전환한다
 * (`createPersonViews` 참고).
 *
 * 애니메이션 클립 이름은 모델마다 다르므로 여기서 함께 관리한다 — 이름이 하나만
 * 틀려도 그 동작만 조용히 재생되지 않는다.
 */
export type CharacterId = "fox" | "human" | "penguin";

export type Character = {
  id: CharacterId;
  label: string;
  /** 툴팁에 쓰는 설명 */
  description: string;
  modelUrl: string;
  animation: {
    idleClip: string;
    walkClip: string;
    dashClip: string;
  };
  modelScale: number;
  modelRotationOffset?: { x: number; y: number; z: number };
  /** 눈높이 (m). 1인칭 시점과 3인칭 카메라가 겨누는 높이. */
  fpvHeightOffset: number;
  /** 3인칭 카메라 거리 (m). 작은 캐릭터일수록 가깝게. */
  cameraDistance: number;
  /**
   * 로드 후 숨길 노드 이름. human.glb에는 12×12 바닥 평면이 함께 들어 있어
   * 그대로 두면 캐릭터가 판때기를 끌고 다닌다.
   */
  hiddenNodes?: string[];
  attribution?: AttributionItem;
};

export const CHARACTERS: Record<CharacterId, Character> = {
  fox: {
    id: "fox",
    label: "여우",
    description: "Khronos glTF Sample Assets의 Fox (원격 로드)",
    // Access-Control-Allow-Origin이 *라 브라우저에서 직접 로드된다.
    modelUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb",
    animation: { idleClip: "Survey", walkClip: "Walk", dashClip: "Run" },
    // Fox는 Z-up으로 제작돼 Y-up 프레임에 맞추려면 보정이 필요하다.
    modelRotationOffset: { x: Math.PI / 2, y: Math.PI, z: 0 },
    modelScale: 0.06,
    fpvHeightOffset: 0.9,
    cameraDistance: 20,
    attribution: {
      attributionHtml:
        'Fox by PixelMannen (CC0), rig &amp; animation by tomkranis (CC BY 4.0) — ' +
        '<a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox">Khronos glTF Sample Assets</a>',
    },
  },
  human: {
    id: "human",
    label: "사람",
    description: "1.7m 사람 모델",
    modelUrl: humanUrl,
    // 클립 이름이 대문자로 시작한다. penguin과 대소문자가 다르니 주의.
    animation: { idleClip: "Idle", walkClip: "Walk", dashClip: "Run" },
    modelScale: 1,
    fpvHeightOffset: 1.6,
    cameraDistance: 6,
    hiddenNodes: ["Ground"],
  },
  penguin: {
    id: "penguin",
    label: "펭귄",
    description: "1m 분홍 펭귄 모델",
    modelUrl: penguinUrl,
    // 이쪽은 전부 소문자다.
    animation: { idleClip: "idle", walkClip: "walk", dashClip: "run" },
    modelScale: 1,
    fpvHeightOffset: 0.9,
    cameraDistance: 5,
  },
};

export const CHARACTER_LIST: Character[] = [
  CHARACTERS.human,
  CHARACTERS.penguin,
  CHARACTERS.fox,
];

export const DEFAULT_CHARACTER: CharacterId = "human";
