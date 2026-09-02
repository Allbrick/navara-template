import type { DefaultPlugin } from "@navaramap/three-default-plugin";
import { useEffect } from "react";

type Props = {
  plugin: DefaultPlugin;
};

/**
 * 하늘 / 별 / 태양광 / 대기 원근 / 톤매핑 / AA 번들을 한 번에 등록한다.
 *
 * `addDefaultPhotorealScene()`는 반드시 `view.init()` 이후에 호출해야 한다.
 * ViewProvider는 init이 끝난 뒤에야 children을 렌더링하므로, 이 컴포넌트가
 * ViewProvider 안에 있는 한 순서는 보장된다.
 */
export function PhotorealScene({ plugin }: Props) {
  useEffect(() => {
    const scene = plugin.addDefaultPhotorealScene();
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

  return null;
}
