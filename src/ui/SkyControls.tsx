import type { CloudQuality } from "../scene/Clouds";

const QUALITIES: CloudQuality[] = ["low", "medium", "high", "ultra"];

type Props = {
  coverage: number;
  onCoverageChange: (value: number) => void;
  quality: CloudQuality;
  onQualityChange: (value: CloudQuality) => void;
};

/** 구름 양을 백분율로 읽기 쉽게 표기한다. */
function describe(coverage: number): string {
  if (coverage <= 0) return "맑음";
  if (coverage < 0.2) return "구름 조금";
  if (coverage < 0.45) return "구름 많음";
  if (coverage < 0.75) return "흐림";
  return "매우 흐림";
}

/** 모든 데모가 공유하는 하늘 설정. */
export function SkyControls({
  coverage,
  onCoverageChange,
  quality,
  onQualityChange,
}: Props) {
  return (
    <section className="sky-controls">
      <label>
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

      <label>
        <span>품질</span>
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
