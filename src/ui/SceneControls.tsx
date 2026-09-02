import { BASEMAP_LIST, type BasemapId } from "../scene/basemaps";
import type { CloudQuality } from "../scene/Clouds";

const QUALITIES: CloudQuality[] = ["low", "medium", "high", "ultra"];

type Props = {
  basemap: BasemapId;
  onBasemapChange: (value: BasemapId) => void;
  coverage: number;
  onCoverageChange: (value: number) => void;
  quality: CloudQuality;
  onQualityChange: (value: CloudQuality) => void;
  reflections: boolean;
  onReflectionsChange: (value: boolean) => void;
};

/** 구름 양을 읽기 쉬운 말로 표기한다. */
function describe(coverage: number): string {
  if (coverage <= 0) return "맑음";
  if (coverage < 0.2) return "구름 조금";
  if (coverage < 0.45) return "구름 많음";
  if (coverage < 0.75) return "흐림";
  return "매우 흐림";
}

/** 데모와 무관한 씬 전체 설정 (배경지도 · 하늘). */
export function SceneControls({
  basemap,
  onBasemapChange,
  coverage,
  onCoverageChange,
  quality,
  onQualityChange,
  reflections,
  onReflectionsChange,
}: Props) {
  return (
    <section className="scene-controls">
      <div className="field">
        <span>배경지도</span>
        <div className="segmented">
          {BASEMAP_LIST.map((map) => (
            <button
              key={map.id}
              type="button"
              title={map.description}
              aria-pressed={basemap === map.id}
              onClick={() => onBasemapChange(map.id)}
            >
              {map.label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>
          구름 {Math.round(coverage * 100)}%
          <small> · {describe(coverage)}</small>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={coverage}
          onChange={(e) => onCoverageChange(Number(e.target.value))}
        />
      </label>

      <label
        className="field checkbox"
        title="수면 가까이에서 볼 때 켜세요. 고고도 광역 시점에서는 화면 전체가 어두워집니다."
      >
        <input
          type="checkbox"
          checked={reflections}
          onChange={(e) => onReflectionsChange(e.target.checked)}
        />
        <span>물 반사 (SSR)</span>
      </label>

      <label className="field">
        <span>구름 품질</span>
        <select
          value={quality}
          onChange={(e) => onQualityChange(e.target.value as CloudQuality)}
          disabled={coverage <= 0}
        >
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
