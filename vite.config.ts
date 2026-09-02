import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Navara는 WASM + 웹 워커(@navaramap/worker)를 사용하므로 ES 워커 출력이 필요하다.
  worker: { format: "es" },
  // three는 반드시 단일 인스턴스여야 한다. @navaramap/three와 three-react가
  // 서로 다른 three 사본을 잡으면 "Multiple instances of Three.js" 경고와 함께
  // 렌더링이 깨진다.
  resolve: { dedupe: ["three", "postprocessing"] },
});
