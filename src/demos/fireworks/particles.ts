/**
 * 불꽃 입자 시뮬레이션.
 *
 * 렌더링 엔진에 의존하지 않는 순수 계산이다. 좌표는 발사 지점 로컬 프레임의
 * 미터 단위이며, Navara의 geodetic 배치가 만드는 로컬 축(+X 서, +Y 상, +Z 북)을
 * 따른다. 상하 운동만 중력을 받으므로 실질적으로 중요한 축은 Y다.
 */

export type ParticleKind = "shell" | "spark";

export type Particle = {
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** 경과 시간 (s) */
  age: number;
  /** 수명 (s). shell은 이 시점에 폭발한다. */
  life: number;
  /** 팔레트 인덱스 */
  color: number;
  /** 최초 반경 (m) */
  radius: number;
};

const GRAVITY = 9.81;
/** 공기 저항. 값이 클수록 빨리 감속한다. */
const DRAG = 0.55;

export type SimConfig = {
  /** shell이 터지는 고도 (m) */
  burstHeightM: number;
  /** 폭발당 spark 개수 */
  sparkCount: number;
  /** 발사 간격 (s) */
  launchIntervalS: number;
  /** 팔레트 색상 개수 */
  paletteSize: number;
};

export const DEFAULT_SIM_CONFIG: SimConfig = {
  burstHeightM: 350,
  sparkCount: 90,
  launchIntervalS: 0.9,
  paletteSize: 6,
};

/**
 * 불꽃 시뮬레이션.
 *
 * `step(dt)`를 프레임마다 호출하고 `particles`를 읽어 렌더에 넘긴다.
 * 난수를 쓰므로 결정적이지 않다 — 테스트에서 위치를 단언하기보다 개수·수명
 * 같은 불변식을 확인하는 편이 낫다.
 */
export class FireworksSim {
  readonly particles: Particle[] = [];
  private timeToNextLaunch = 0;

  constructor(private readonly config: SimConfig = DEFAULT_SIM_CONFIG) {}

  step(dt: number): void {
    // dt가 크게 튀면(탭 비활성화 등) 시뮬레이션이 폭주하므로 상한을 둔다.
    const clamped = Math.min(dt, 0.1);

    this.timeToNextLaunch -= clamped;
    if (this.timeToNextLaunch <= 0) {
      this.launch();
      this.timeToNextLaunch = this.config.launchIntervalS * (0.6 + Math.random());
    }

    const exploded: Particle[] = [];

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += clamped;

      if (p.age >= p.life) {
        if (p.kind === "shell") exploded.push(p);
        this.particles.splice(i, 1);
        continue;
      }

      const drag = p.kind === "spark" ? DRAG : 0;
      const decay = Math.max(0, 1 - drag * clamped);
      p.vx *= decay;
      p.vy = (p.vy - GRAVITY * clamped) * decay;
      p.vz *= decay;

      p.x += p.vx * clamped;
      p.y += p.vy * clamped;
      p.z += p.vz * clamped;
    }

    for (const shell of exploded) this.explode(shell);
  }

  /** 남은 수명 비율 (1 → 갓 생성, 0 → 소멸 직전). */
  static remaining(p: Particle): number {
    return Math.max(0, 1 - p.age / p.life);
  }

  private launch(): void {
    const { burstHeightM } = this.config;
    // 폭발 고도에 도달할 초기 속도. v = sqrt(2gh)에 약간의 여유를 준다.
    const speed = Math.sqrt(2 * GRAVITY * burstHeightM) * 1.02;
    const spread = 40; // 발사대 폭 (m)

    this.particles.push({
      kind: "shell",
      x: (Math.random() - 0.5) * spread,
      y: 0,
      z: (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 6,
      vy: speed,
      vz: (Math.random() - 0.5) * 6,
      age: 0,
      life: speed / GRAVITY, // 정점에 도달하는 시각
      color: Math.floor(Math.random() * this.config.paletteSize),
      radius: 3,
    });
  }

  private explode(shell: Particle): void {
    const { sparkCount } = this.config;
    const burstSpeed = 45 + Math.random() * 25;

    for (let i = 0; i < sparkCount; i++) {
      // 구면 균등 분포. z를 균등하게 뽑아야 극에 몰리지 않는다.
      const cosTheta = 2 * Math.random() - 1;
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
      const phi = Math.random() * Math.PI * 2;
      // 껍질에만 몰리지 않도록 반경 방향으로도 흩는다.
      const speed = burstSpeed * (0.55 + 0.45 * Math.cbrt(Math.random()));

      this.particles.push({
        kind: "spark",
        x: shell.x,
        y: shell.y,
        z: shell.z,
        vx: sinTheta * Math.cos(phi) * speed,
        vy: cosTheta * speed,
        vz: sinTheta * Math.sin(phi) * speed,
        age: 0,
        life: 2.2 + Math.random() * 1.6,
        color: shell.color,
        radius: 4.5,
      });
    }
  }
}
