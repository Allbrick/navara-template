/**
 * 태양 고도 기반 일출 시각 계산.
 *
 * `view.atmosphere`를 구조적 타입으로만 받는다. 엔진 인스턴스에 직접 묶이지
 * 않으므로 단위 테스트에서 가짜 구현으로 대체할 수 있다.
 */
export type SunSampler = {
  date: Date;
  setSolarTime(location: { lng: number }, hours: number): void;
  getSunElevation(location: { lat: number; lng: number }): number;
};

const COARSE_STEP_HOURS = 0.25;
const BISECTION_ITERATIONS = 40;

/**
 * 태양 고도가 음수에서 양수로 바뀌는 지점(= 일출)의 태양시를 구한다.
 * 고도값은 대기 굴절이 반영된 값이라 통상적인 일출 정의와 일치한다.
 *
 * 백야/극야처럼 하루 종일 부호가 바뀌지 않으면 `null`을 반환한다.
 * 호출 전후로 `sampler.date`는 보존된다.
 */
export function findSunriseSolarTime(
  sampler: SunSampler,
  location: { lat: number; lng: number },
): number | null {
  const originalDate = sampler.date;

  const elevationAt = (hours: number) => {
    sampler.setSolarTime({ lng: location.lng }, hours);
    return sampler.getSunElevation(location);
  };

  try {
    let previousHours = 0;
    let previousElevation = elevationAt(previousHours);

    for (let h = COARSE_STEP_HOURS; h <= 24; h += COARSE_STEP_HOURS) {
      const elevation = elevationAt(h);

      // 음수 → 양수 전환 구간을 찾으면 이분법으로 좁힌다.
      if (previousElevation < 0 && elevation >= 0) {
        let lo = previousHours;
        let hi = h;
        for (let i = 0; i < BISECTION_ITERATIONS; i++) {
          const mid = (lo + hi) / 2;
          if (elevationAt(mid) < 0) lo = mid;
          else hi = mid;
        }
        return (lo + hi) / 2;
      }

      previousHours = h;
      previousElevation = elevation;
    }

    return null;
  } finally {
    sampler.date = originalDate;
  }
}

/** 엔진이 들고 있는 실제 시각(UTC 인스턴트)을 지정 시간대의 시:분으로 표기한다. */
export function formatClockTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** 소수 시간(6.3)을 시:분 표기("06:18")로 변환한다. */
export function formatSolarTime(hours: number): string {
  const normalized = ((hours % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.round((normalized - h) * 60);
  // 반올림으로 60분이 되면 시간으로 올린다.
  const carriedH = m === 60 ? (h + 1) % 24 : h;
  const carriedM = m === 60 ? 0 : m;
  return `${String(carriedH).padStart(2, "0")}:${String(carriedM).padStart(2, "0")}`;
}
