import { useViewContext } from "@navaramap/three-react";
import { useCallback, useEffect, useState } from "react";

import { DISPLAY_TIME_ZONE, SEOUL } from "../../constants";
import { Panel } from "../../ui/Panel";
import {
  findSunriseSolarTime,
  formatClockTime,
  formatSolarTime,
} from "./sun";

/**
 * 일출 분석 데모.
 *
 * 태양 위치 계산은 Navara가 내장한 astronomy-engine을 `view.atmosphere`가
 * 감싼 것을 그대로 쓴다. 별도 천문 라이브러리를 붙이지 않는다.
 */
export function SunriseAnalysis() {
  const { view } = useViewContext();

  const [solarTime, setSolarTime] = useState(6);
  const [elevation, setElevation] = useState(0);
  const [clockTime, setClockTime] = useState("");
  const [sunrise, setSunrise] = useState<number | null>(null);

  // 슬라이더 값 → 태양시. atmosphere.date가 바뀌면 하늘·태양광·그림자가 함께 갱신된다.
  useEffect(() => {
    view.atmosphere.setSolarTime({ lng: SEOUL.lng }, solarTime);
    setElevation(view.atmosphere.getSunElevation(SEOUL));
    setClockTime(formatClockTime(view.atmosphere.date, DISPLAY_TIME_ZONE));
  }, [view, solarTime]);

  const jumpToSunrise = useCallback(() => {
    const hours = findSunriseSolarTime(view.atmosphere, SEOUL);
    setSunrise(hours);
    if (hours !== null) setSolarTime(hours);
  }, [view]);

  const isDay = elevation > 0;
  const atSunrise = sunrise !== null && Math.abs(solarTime - sunrise) < 1e-6;

  return (
    <Panel title="일출 분석 — 서울">
      <label>
        태양시 {formatSolarTime(solarTime)}
        <input
          type="range"
          min={0}
          max={24}
          step={0.05}
          value={solarTime}
          onChange={(e) => setSolarTime(Number(e.target.value))}
        />
      </label>

      <dl>
        <dt>한국 시각</dt>
        <dd>{clockTime}</dd>
        <dt>태양 고도</dt>
        <dd>
          {elevation.toFixed(2)}° <small>({isDay ? "주간" : "야간"})</small>
        </dd>
        <dt>일출 시각</dt>
        <dd>
          {sunrise === null
            ? "—"
            : `${formatSolarTime(sunrise)} (태양시)${atSunrise ? ` · ${clockTime} KST` : ""}`}
        </dd>
      </dl>

      <button type="button" onClick={jumpToSunrise}>
        일출 순간으로 이동
      </button>

      <p className="note">
        태양시는 경도 기준이라 KST와 다릅니다. 고도는 대기 굴절을 반영한
        값이며, 지형에 가려지는지 여부는 별도 판정이 필요합니다.
      </p>
    </Panel>
  );
}
