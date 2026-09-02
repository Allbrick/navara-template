import { DefaultPlugin } from "@navaramap/three-default-plugin";
import { ViewProvider } from "@navaramap/three-react";
import { useMemo, useState } from "react";

import { Demos } from "./Demos";

export default function App() {
  // canvas를 ref가 아닌 state로 잡는다. ViewProvider의 canvas prop은
  // RefObject<HTMLCanvasElement>(널 불가)를 받으므로, 요소가 붙은 뒤
  // 실제 엘리먼트를 넘기는 편이 타입상 정확하고 초기화 시점도 명확하다.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  // animation: 불꽃 입자를 매 프레임 갱신해야 하므로 연속 렌더가 필요하다.
  // 끄면 preRender가 변화가 있을 때만 발생해 애니메이션이 끊긴다.
  //
  // 플러그인 인스턴스는 ViewProvider(init 전 등록)와 PhotorealScene
  // (init 후 호출) 양쪽에서 같은 것을 써야 한다.
  const plugin = useMemo(() => new DefaultPlugin(), []);
  const plugins = useMemo(() => [plugin], [plugin]);

  return (
    <div className="app">
      <canvas ref={setCanvas} className="viewport" />
      {canvas && (
        <ViewProvider canvas={canvas} plugins={plugins} shadow animation>
          <Demos plugin={plugin} />
        </ViewProvider>
      )}
    </div>
  );
}
