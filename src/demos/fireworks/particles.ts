/**
 * 불꽃 입자 시뮬레이션.
 *
 * 렌더링 엔진에 의존하지 않는 순수 계산이다. 좌표는 발사 지점 로컬 프레임의
 * 미터 단위이며, Navara의 geodetic 배치가 만드는 로컬 축(+X 서, +Y 상, +Z 북)을
 * 따른다. 상하 운동만 중력을 받으므로 실질적으로 중요한 축은 Y다.
 */

export type ParticleKind =
  /** 상승 중인 탄. 정점에서 폭발한다. */
  | "shell"
  /** 폭발로 흩어진 불꽃 */
  | "spark"
  /** 불꽃이 지나간 자리에 남는 잔광 */
  | "trail"
  /** 폭발 순간의 섬광 */
  | "flash";

/** 폭발 형태. 실제 연화의 대표적인 종류들. */
export type BurstType =
  /** 모란 — 균일한 구형, 잔광 없음 */
  | "peony"
  /** 국화 — 구형 + 긴 잔광 */
  | "chrysanthemum"
  /** 수양버들 — 느리게 퍼져 길게 늘어짐 */
  | "willow"
  /** 고리 — 한 평면 위의 원 */
  | "ring"
  /** 야자수 — 굵은 가닥 몇 개 */
  | "palm"
  /** 십자 분열 — 흩어진 뒤 한 번 더 갈라짐 */
  | "crossette";

const BURST_TYPES: BurstType[] = [
  "peony",
  "chrysanthemum",
  "willow",
  "ring",
  "palm",
  "crossette",
];

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
  /** 공기 저항 계수. 클수록 빨리 감속한다. */
  drag: number;
  /** 잔광을 남기는 간격 (s). 0이면 남기지 않는다. */
  trailInterval: number;
  /** 다음 잔광 방출까지 남은 시간 */
  trailTimer: number;
  /** 이 시각(age)에 한 번 더 갈라진다. crossette 전용. */
  splitAt?: number;
  /** 폭발 형태. shell이 들고 있다가 폭발할 때 쓴다. */
  burst?: BurstType;
};

const GRAVITY = 9.81;

export type SimConfig = {
  /** shell이 터지는 기준 고도 (m). 발사마다 ±20% 흔들린다. */
  burstHeightM: number;
  /** 폭발당 기준 불꽃 개수 */
  sparkCount: number;
  /** 발사 간격 (s) */
  launchIntervalS: number;
  /** 팔레트 색상 개수 */
  paletteSize: number;
  /**
   * 살아있는 입자 상한. 넘으면 오래된 잔광부터 버린다.
   * 상시로 걸리면 잔광 길이가 수명이 아니라 예산에 좌우되므로 여유를 둔다.
   */
  maxParticles: number;
};

export const DEFAULT_SIM_CONFIG: SimConfig = {
  burstHeightM: 350,
  sparkCount: 80,
  launchIntervalS: 1.1,
  paletteSize: 6,
  maxParticles: 3200,
};

/** [min, max) 실수 난수 */
function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 구면 균등 분포 단위벡터. z를 균등하게 뽑아야 극에 몰리지 않는다. */
function randomDirection(): [number, number, number] {
  const cosTheta = 2 * Math.random() - 1;
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  const phi = Math.random() * Math.PI * 2;
  return [sinTheta * Math.cos(phi), cosTheta, sinTheta * Math.sin(phi)];
}

/** `n`에 수직인 정규직교 두 벡터. 고리형 폭발의 평면을 만든다. */
function basisFor(n: [number, number, number]) {
  // n과 가장 덜 나란한 축을 골라야 외적이 퇴화하지 않는다.
  const helper: [number, number, number] =
    Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u: [number, number, number] = [
    helper[1] * n[2] - helper[2] * n[1],
    helper[2] * n[0] - helper[0] * n[2],
    helper[0] * n[1] - helper[1] * n[0],
  ];
  const ul = Math.hypot(u[0], u[1], u[2]);
  const un: [number, number, number] = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v: [number, number, number] = [
    n[1] * un[2] - n[2] * un[1],
    n[2] * un[0] - n[0] * un[2],
    n[0] * un[1] - n[1] * un[0],
  ];
  return { u: un, v };
}

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

  /** 남은 수명 비율 (1 → 갓 생성, 0 → 소멸 직전). */
  static remaining(p: Particle): number {
    return Math.max(0, 1 - p.age / p.life);
  }

  step(dt: number): void {
    // dt가 크게 튀면(탭 비활성화 등) 시뮬레이션이 폭주하므로 상한을 둔다.
    const clamped = Math.min(dt, 0.1);

    this.timeToNextLaunch -= clamped;
    if (this.timeToNextLaunch <= 0) {
      this.launch();
      this.timeToNextLaunch = this.config.launchIntervalS * between(0.6, 1.6);
    }

    const exploded: Particle[] = [];
    const split: Particle[] = [];
    const trails: Particle[] = [];

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += clamped;

      if (p.age >= p.life) {
        if (p.kind === "shell") exploded.push(p);
        this.particles.splice(i, 1);
        continue;
      }

      if (p.splitAt !== undefined && p.age >= p.splitAt) {
        split.push(p);
        p.splitAt = undefined;
      }

      // 잔광은 지나간 자리에 속도 없이 남는다.
      if (p.trailInterval > 0) {
        p.trailTimer -= clamped;
        if (p.trailTimer <= 0) {
          p.trailTimer = p.trailInterval;
          trails.push(p);
        }
      }

      const decay = Math.max(0, 1 - p.drag * clamped);
      p.vx *= decay;
      p.vy = (p.vy - GRAVITY * clamped) * decay;
      p.vz *= decay;

      p.x += p.vx * clamped;
      p.y += p.vy * clamped;
      p.z += p.vz * clamped;
    }

    for (const shell of exploded) this.explode(shell);
    for (const p of split) this.split(p);
    for (const p of trails) this.emitTrail(p);

    this.enforceBudget();
  }

  /** 입자 상한을 넘으면 잔광부터 오래된 것을 버린다. */
  private enforceBudget(): void {
    let excess = this.particles.length - this.config.maxParticles;
    if (excess <= 0) return;

    for (let i = 0; i < this.particles.length && excess > 0; ) {
      if (this.particles[i].kind === "trail") {
        this.particles.splice(i, 1);
        excess--;
      } else {
        i++;
      }
    }
  }

  private push(p: Particle): void {
    this.particles.push(p);
  }

  private launch(): void {
    const burstHeight = this.config.burstHeightM * between(0.8, 1.2);
    // 폭발 고도에 도달할 초기 속도. v = sqrt(2gh).
    const speed = Math.sqrt(2 * GRAVITY * burstHeight) * 1.02;
    const spread = 40; // 발사대 폭 (m)

    this.push({
      kind: "shell",
      x: between(-spread / 2, spread / 2),
      y: 0,
      z: between(-spread / 2, spread / 2),
      vx: between(-3, 3),
      vy: speed,
      vz: between(-3, 3),
      age: 0,
      life: speed / GRAVITY, // 정점에 도달하는 시각
      color: Math.floor(Math.random() * this.config.paletteSize),
      radius: 2.5,
      drag: 0,
      // 상승 중 꼬리를 남긴다. 폭발 잔광에 예산을 더 쓰도록 성기게 잡는다.
      trailInterval: 0.05,
      trailTimer: 0,
      burst: BURST_TYPES[Math.floor(Math.random() * BURST_TYPES.length)],
    });
  }

  /** 폭발 순간의 섬광. 아주 짧고 크다. */
  private emitFlash(shell: Particle): void {
    this.push({
      kind: "flash",
      x: shell.x,
      y: shell.y,
      z: shell.z,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      life: 0.14,
      color: shell.color,
      radius: 26,
      drag: 0,
      trailInterval: 0,
      trailTimer: 0,
    });
  }

  private emitTrail(source: Particle): void {
    this.push({
      kind: "trail",
      x: source.x,
      y: source.y,
      z: source.z,
      // 잔광은 거의 제자리에서 흩어지며 꺼진다.
      vx: between(-1, 1),
      vy: between(-1, 0.4),
      vz: between(-1, 1),
      age: 0,
      life: source.kind === "shell" ? between(0.5, 0.9) : between(0.35, 0.7),
      color: source.color,
      radius: source.radius * 0.45,
      drag: 1.2,
      trailInterval: 0,
      trailTimer: 0,
    });
  }

  private explode(shell: Particle): void {
    this.emitFlash(shell);

    const type = shell.burst ?? "peony";
    const { sparkCount, paletteSize } = this.config;

    // 일부는 두 가지 색으로 터뜨린다.
    const secondary =
      Math.random() < 0.35
        ? (shell.color + 1 + Math.floor(Math.random() * (paletteSize - 1))) %
          paletteSize
        : shell.color;

    const spawn = (
      dir: [number, number, number],
      speed: number,
      opts: Partial<Particle> = {},
    ) => {
      this.push({
        kind: "spark",
        x: shell.x,
        y: shell.y,
        z: shell.z,
        vx: dir[0] * speed,
        vy: dir[1] * speed,
        vz: dir[2] * speed,
        age: 0,
        life: between(2.2, 3.4),
        color: Math.random() < 0.5 ? shell.color : secondary,
        radius: 4,
        drag: 0.55,
        trailInterval: 0,
        trailTimer: 0,
        ...opts,
      });
    };

    switch (type) {
      case "peony": {
        // 껍질에만 몰리지 않도록 반경 방향으로도 흩는다.
        for (let i = 0; i < sparkCount; i++) {
          spawn(randomDirection(), between(45, 70) * Math.cbrt(between(0.3, 1)));
        }
        break;
      }

      case "chrysanthemum": {
        for (let i = 0; i < sparkCount; i++) {
          spawn(randomDirection(), between(42, 62) * Math.cbrt(between(0.4, 1)), {
            life: between(2.8, 3.9),
            trailInterval: between(0.05, 0.08),
            trailTimer: Math.random() * 0.08,
          });
        }
        break;
      }

      case "willow": {
        // 느리게 퍼지고 오래 살아 중력에 길게 늘어진다.
        for (let i = 0; i < sparkCount * 0.8; i++) {
          spawn(randomDirection(), between(18, 30), {
            life: between(4.2, 5.8),
            drag: 0.22,
            radius: 3.4,
            trailInterval: between(0.06, 0.1),
            trailTimer: Math.random() * 0.1,
          });
        }
        break;
      }

      case "ring": {
        const normal = randomDirection();
        const { u, v } = basisFor(normal);
        const speed = between(48, 62);
        for (let i = 0; i < sparkCount; i++) {
          const a = (i / sparkCount) * Math.PI * 2;
          const jitter = between(0.94, 1.06);
          spawn(
            [
              (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * jitter,
              (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * jitter,
              (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * jitter,
            ],
            speed,
            { life: between(2.4, 3.2) },
          );
        }
        break;
      }

      case "palm": {
        // 굵은 가닥 몇 개가 뻗어나간다.
        const fronds = Math.floor(between(7, 11));
        const perFrond = Math.max(4, Math.floor(sparkCount / fronds));
        for (let f = 0; f < fronds; f++) {
          const base = randomDirection();
          const speed = between(50, 66);
          for (let i = 0; i < perFrond; i++) {
            // 가닥을 따라 속도를 달리해 길쭉하게 만든다.
            spawn(
              [
                base[0] + between(-0.07, 0.07),
                base[1] + between(-0.07, 0.07),
                base[2] + between(-0.07, 0.07),
              ],
              speed * between(0.35, 1),
              {
                life: between(3, 4.2),
                drag: 0.35,
                radius: 4.6,
                trailInterval: between(0.05, 0.09),
                trailTimer: Math.random() * 0.09,
              },
            );
          }
        }
        break;
      }

      case "crossette": {
        // 적은 수가 크게 퍼진 뒤 각자 한 번 더 갈라진다.
        const count = Math.floor(sparkCount * 0.3);
        for (let i = 0; i < count; i++) {
          spawn(randomDirection(), between(38, 52), {
            life: between(2.6, 3.4),
            radius: 5,
            splitAt: between(0.7, 1),
            trailInterval: 0.07,
            trailTimer: Math.random() * 0.07,
          });
        }
        break;
      }
    }
  }

  /** crossette 입자가 한 번 더 갈라진다. */
  private split(p: Particle): void {
    for (let i = 0; i < 4; i++) {
      const dir = randomDirection();
      const speed = between(12, 20);
      this.push({
        kind: "spark",
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx * 0.3 + dir[0] * speed,
        vy: p.vy * 0.3 + dir[1] * speed,
        vz: p.vz * 0.3 + dir[2] * speed,
        age: 0,
        life: between(1.1, 1.8),
        color: p.color,
        radius: p.radius * 0.6,
        drag: 0.6,
        trailInterval: 0.08,
        trailTimer: 0,
      });
    }
  }
}
