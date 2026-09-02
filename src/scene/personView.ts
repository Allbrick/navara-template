import { PersonViewPlugin } from "@navaramap/three-plugins";

import { SEOUL } from "../constants";

/**
 * 캐릭터 모델. Khronos glTF Sample Assets의 Fox.
 * `Access-Control-Allow-Origin: *`이라 브라우저에서 직접 로드된다.
 * 애니메이션 클립 이름(Survey/Walk/Run)은 이 모델이 실제로 갖고 있는 것들이다.
 */
export const CHARACTER_MODEL_URL =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb";

/**
 * 1인칭/3인칭 캐릭터 조작 플러그인.
 *
 * 플러그인은 `view.init()` **전에** 등록해야 하므로 App에서 생성해 ViewProvider의
 * `plugins`로 넘긴다. 실제 배치는 init 이후 `teleport()` + `start()`로 한다.
 *
 * 주의: 모델을 init 단계에서 받아오므로, 이 URL이 죽으면 view 초기화 자체가
 * 실패해 앱 전체가 뜨지 않는다. 운영에 쓸 때는 모델을 로컬 자산으로 옮기세요.
 */
export function createPersonView(): PersonViewPlugin {
  return new PersonViewPlugin({
    character: {
      modelUrl: CHARACTER_MODEL_URL,
      animation: {
        idleClip: "Survey",
        walkClip: "Walk",
        dashClip: "Run",
        dashSpeed: 2,
        crossfadeDuration: 0.3,
      },
      // Fox는 Z-up으로 만들어져 있어 Y-up 프레임에 맞추려면 보정이 필요하다.
      modelRotationOffset: { x: Math.PI / 2, y: Math.PI, z: 0 },
      modelScale: 0.06,
      castShadow: true,
      receiveShadow: true,
    },
    // 지형에 붙어 걷는다. off면 공중을 자유 비행한다.
    collision: { mode: "ground" },
    moveSpeed: 10,
    dashSpeedMultiplier: 4,
    cameraDistance: 20,
    cameraPitch: 14.4,
    fpvHeightOffset: 1.2,
    fpvPitch: 2.9,
    initialView: "tpv",
    // 배치 전 기본값. 실제 위치는 사용자가 지도를 클릭해 정한다.
    startLng: SEOUL.lng,
    startLat: SEOUL.lat,
  });
}
