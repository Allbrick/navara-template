import { DefaultPlugin } from "@navaramap/three-default-plugin";
import { ViewProvider } from "@navaramap/three-react";
import { useMemo, useState } from "react";

import { Demos } from "./Demos";
import { createPersonView } from "./scene/personView";

export default function App() {
  // canvas를 ref가 아닌 state로 잡는다. ViewProvider의 canvas prop은
  // RefObject<HTMLCanvasElement>(널 불가)를 받으므로, 요소가 붙은 뒤
  // 실제 엘리먼트를 넘기는 편이 타입상 정확하고 초기화 시점도 명확하다.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  // 플러그인은 view.init() 전에 등록돼야 하므로 전부 여기서 만든다.
  // DefaultPlugin은 PhotorealScene이(init 후) 다시 쓰고, PersonViewPlugin은
  // WalkDemo가 teleport/start에 쓰므로 같은 인스턴스를 아래로 넘긴다.
  const defaultPlugin = useMemo(() => new DefaultPlugin(), []);
  const personView = useMemo(() => createPersonView(), []);
  const plugins = useMemo(
    () => [defaultPlugin, personView],
    [defaultPlugin, personView],
  );

  return (
    <div className="app">
      <canvas ref={setCanvas} className="viewport" />
      {canvas && (
        // animation: 불꽃 입자와 캐릭터 이동을 매 프레임 갱신해야 하므로
        // 연속 렌더가 필요하다. 끄면 변화가 있을 때만 렌더된다.
        <ViewProvider canvas={canvas} plugins={plugins} shadow animation>
          <Demos defaultPlugin={defaultPlugin} personView={personView} />
        </ViewProvider>
      )}
    </div>
  );
}
