import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root element not found");

// StrictMode를 쓰지 않는다. @navaramap/three-react v0.1.1의 ViewProvider는
// dispose가 미구현(소스 내 TODO)이라 이중 마운트 시 ThreeView를 재생성하지
// 못하고 "You need to recreate ThreeView." 경고와 함께 레이어가 유실된다.
createRoot(container).render(<App />);
