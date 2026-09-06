import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Game3DCanvas } from "./Game3DCanvas";

/**
 * Lane Hop — a Crossy Road style dash, in 3D. Hop forward across lanes of
 * traffic and rivers of light. Every new lane pays out, traffic gets faster the
 * deeper you go, one hit ends the run.
 */

const COLS = 9;
const HALF = (COLS - 1) / 2; // x range -4..4
const EDGE = COLS / 2; // 4.5

type Lane = {
  kind: "safe" | "road" | "river";
  dir: 1 | -1;
  speed: number;
  cars: number[];
  carW: number;
};

function makeLane(index: number): Lane {
  // Gentle on-ramp: the first stretch is mostly grass with slow, sparse traffic,
  // then difficulty climbs steadily the deeper you push.
  const warm = Math.min(1, index / 26); // 0 at the start, 1 by lane ~26
  if (index % 4 === 0) return { kind: "safe", dir: 1, speed: 0, cars: [], carW: 0 };
  if (index < 10 && index % 2 === 0) return { kind: "safe", dir: 1, speed: 0, cars: [], carW: 0 };

  // rivers only start once the player has found their rhythm
  const kind: Lane["kind"] = index > 14 && Math.random() < 0.26 ? "river" : "road";
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const base = kind === "road" ? 1.35 : 1.2;
  const speed = base + warm * (kind === "road" ? 3.6 : 2.2) + Math.random() * (0.3 + warm * 1.1);
  const carW = kind === "road" ? (Math.random() < 0.26 + warm * 0.1 ? 2.1 : 1.3) : 2.8;
  const gap = kind === "road" ? 6.4 - warm * 3.2 + Math.random() * 1.6 : 3.8 - warm * 0.5;
  const cars: number[] = [];
  for (let x = -EDGE - carW; x < EDGE + carW; x += carW + gap) cars.push(x + Math.random() * 0.4);
  return { kind, dir, speed, cars, carW };
}

const CAR_PAINT = ["#d94b58", "#3d7ad6", "#e7e9ee", "#2f3b4a", "#e0a52f", "#3aa37a"];

/** A road vehicle with a body, greenhouse, wheels and lights. */
function Vehicle({ w, dir, tint }: { w: number; dir: 1 | -1; tint: string }) {
  const truck = w > 1.7;
  const wheelY = 0.13;
  const wheelX = w / 2 - 0.28;
  return (
    <group rotation-y={dir > 0 ? 0 : Math.PI}>
      {/* chassis */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[w, 0.3, 0.62]} />
        <meshStandardMaterial color={tint} roughness={0.32} metalness={0.55} />
      </mesh>
      {/* cabin / greenhouse */}
      <mesh position={[truck ? -w * 0.26 : 0, 0.52, 0]} castShadow>
        <boxGeometry args={[truck ? w * 0.4 : w * 0.52, 0.24, 0.56]} />
        <meshStandardMaterial color={tint} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* glass */}
      <mesh position={[truck ? -w * 0.26 : 0, 0.53, 0]}>
        <boxGeometry args={[truck ? w * 0.41 : w * 0.53, 0.15, 0.575]} />
        <meshStandardMaterial color="#0e1a26" roughness={0.08} metalness={0.9} />
      </mesh>
      {truck ? (
        <mesh position={[w * 0.19, 0.55, 0]} castShadow>
          <boxGeometry args={[w * 0.52, 0.34, 0.6]} />
          <meshStandardMaterial color="#c9d2dc" roughness={0.6} metalness={0.25} />
        </mesh>
      ) : null}
      {/* wheels */}
      {[
        [wheelX, 0.33],
        [wheelX, -0.33],
        [-wheelX, 0.33],
        [-wheelX, -0.33],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x!, wheelY, z!]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.09, 12]} />
          <meshStandardMaterial color="#14181e" roughness={0.85} />
        </mesh>
      ))}
      {/* headlights + tail lights */}
      {[-0.18, 0.18].map((z) => (
        <mesh key={`h${z}`} position={[w / 2 + 0.01, 0.28, z]}>
          <boxGeometry args={[0.05, 0.1, 0.14]} />
          <meshStandardMaterial color="#fff6d8" emissive="#fff6d8" emissiveIntensity={2.4} />
        </mesh>
      ))}
      {[-0.18, 0.18].map((z) => (
        <mesh key={`t${z}`} position={[-w / 2 - 0.01, 0.3, z]}>
          <boxGeometry args={[0.04, 0.08, 0.12]} />
          <meshStandardMaterial color="#ff3b52" emissive="#ff2f45" emissiveIntensity={1.6} />
        </mesh>
      ))}
    </group>
  );
}

/** The party pig from the level-up screen, as a playable 3D character. */
function PigCharacter() {
  const pink = "#f4a3b8";
  const deep = "#e07f99";
  return (
    <group>
      <mesh castShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[0.56, 0.42, 0.62]} />
        <meshStandardMaterial color={pink} roughness={0.65} metalness={0.05} />
      </mesh>
      {/* head */}
      <mesh castShadow position={[0, 0.34, 0.06]}>
        <boxGeometry args={[0.46, 0.36, 0.44]} />
        <meshStandardMaterial color={pink} roughness={0.6} />
      </mesh>
      {/* snout */}
      <mesh castShadow position={[0, 0.3, 0.3]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.11, 0.12, 0.12, 12]} />
        <meshStandardMaterial color={deep} roughness={0.55} />
      </mesh>
      {/* ears */}
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} castShadow position={[x, 0.53, 0.02]} rotation-x={-0.35}>
          <coneGeometry args={[0.1, 0.18, 4]} />
          <meshStandardMaterial color={deep} roughness={0.6} />
        </mesh>
      ))}
      {/* eyes */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={`e${x}`} position={[x, 0.4, 0.27]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#141a22" />
        </mesh>
      ))}
      {/* legs */}
      {[
        [-0.18, 0.2],
        [0.18, 0.2],
        [-0.18, -0.2],
        [0.18, -0.2],
      ].map(([x, z], i) => (
        <mesh key={`l${i}`} castShadow position={[x!, -0.24, z!]}>
          <cylinderGeometry args={[0.07, 0.07, 0.18, 8]} />
          <meshStandardMaterial color={deep} roughness={0.7} />
        </mesh>
      ))}
      {/* curly tail */}
      <mesh position={[0, 0.12, -0.34]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.07, 0.025, 6, 12, Math.PI * 1.4]} />
        <meshStandardMaterial color={deep} roughness={0.6} />
      </mesh>
      {/* tiny party hat, because it is that pig */}
      <mesh castShadow position={[0, 0.66, 0.02]}>
        <coneGeometry args={[0.12, 0.24, 12]} />
        <meshStandardMaterial color="#2ee6c4" emissive="#2ee6c4" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

const LANE_COLORS: Record<Lane["kind"], string> = {
  safe: "#113a2c",
  road: "#141b26",
  river: "#0a1e38",
};

function LaneRow({ lane, index }: { lane: Lane; index: number }) {
  const cars = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = cars.current;
    if (!g) return;
    lane.cars.forEach((x, i) => {
      const child = g.children[i];
      if (child) child.position.x = x;
    });
  });
  return (
    <group position={[0, 0, -index]}>
      <mesh receiveShadow position={[0, lane.kind === "river" ? -0.16 : 0, 0]}>
        <boxGeometry args={[COLS + 4, 0.3, 1]} />
        <meshStandardMaterial
          color={LANE_COLORS[lane.kind]}
          roughness={lane.kind === "river" ? 0.15 : 0.75}
          metalness={lane.kind === "river" ? 0.7 : 0.15}
        />
      </mesh>
      {lane.kind === "safe" ? (
        <>
          <mesh position={[-EDGE - 0.9, 0.55, 0.2]} castShadow>
            <coneGeometry args={[0.42, 1.3, 7]} />
            <meshStandardMaterial color="#1f8f6a" roughness={0.6} />
          </mesh>
          <mesh position={[EDGE + 1.1, 0.45, -0.2]} castShadow>
            <coneGeometry args={[0.36, 1.1, 7]} />
            <meshStandardMaterial color="#2ee6c4" emissive="#2ee6c4" emissiveIntensity={0.2} />
          </mesh>
        </>
      ) : null}
      <group ref={cars}>
        {lane.cars.map((x, i) =>
          lane.kind === "road" ? (
            <group key={i} position={[x, 0.06, 0]}>
              <Vehicle w={lane.carW} dir={lane.dir} tint={CAR_PAINT[(index * 3 + i) % CAR_PAINT.length]!} />
            </group>
          ) : (
            <mesh key={i} position={[x, 0.02, 0]} castShadow receiveShadow>
              <boxGeometry args={[lane.carW, 0.26, 0.82]} />
              <meshStandardMaterial
                color="#2ee6c4"
                emissive="#2ee6c4"
                emissiveIntensity={0.4}
                roughness={0.25}
                metalness={0.4}
              />
            </mesh>
          ),
        )}
      </group>
    </group>
  );
}

function HopScene({
  onScore,
  onEnd,
  onView,
}: {
  onScore: (n: number) => void;
  onEnd: (n: number) => void;
  onView: (v: { score: number; row: number }) => void;
}) {
  const { camera, gl } = useThree();
  const player = useRef<THREE.Group>(null);
  const [window0, setWindow0] = useState(0);
  const cb = useRef({ onScore, onEnd, onView });
  cb.current = { onScore, onEnd, onView };

  const st = useRef({
    lanes: Array.from({ length: 60 }, (_, i) => makeLane(i)),
    col: 0,
    row: 0,
    best: 0,
    score: 0,
    over: false,
    px: 0,
    hopT: 1,
    from: { x: 0, z: 0 },
    to: { x: 0, z: 0 },
  });

  const visible = useMemo(
    () => st.current.lanes.slice(window0, window0 + 22).map((lane, i) => ({ lane, index: window0 + i })),
    [window0],
  );

  useEffect(() => {
    const s = st.current;
    const die = () => {
      if (s.over) return;
      s.over = true;
      cb.current.onEnd(s.score);
    };
    const hop = (dc: number, dr: number) => {
      if (s.over || s.hopT < 1) return;
      const nc = Math.min(HALF, Math.max(-HALF, Math.round(s.px) + dc));
      const nr = Math.max(0, s.row + dr);
      s.from = { x: s.px, z: -s.row };
      s.to = { x: nc, z: -nr };
      s.hopT = 0;
      s.col = nc;
      s.px = nc;
      s.row = nr;
      while (s.lanes.length < nr + 30) s.lanes.push(makeLane(s.lanes.length));
      setWindow0(Math.max(0, nr - 4));
      if (nr > s.best) {
        s.best = nr;
        s.score += 25 + Math.floor(nr / 5) * 5;
        cb.current.onScore(s.score);
        cb.current.onView({ score: s.score, row: nr });
      }
    };
    (s as unknown as { hop: typeof hop }).hop = hop;
    (s as unknown as { die: typeof die }).die = die;

    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w", "arrowdown", "s", "arrowleft", "a", "arrowright", "d", " "].includes(k))
        e.preventDefault();
      if (k === "arrowup" || k === "w" || k === " ") hop(0, 1);
      else if (k === "arrowdown" || k === "s") hop(0, -1);
      else if (k === "arrowleft" || k === "a") hop(-1, 0);
      else if (k === "arrowright" || k === "d") hop(1, 0);
    };
    window.addEventListener("keydown", key);

    let start: { x: number; y: number } | null = null;
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return hop(0, 1);
      if (Math.abs(dx) > Math.abs(dy)) hop(dx > 0 ? 1 : -1, 0);
      else hop(0, dy < 0 ? 1 : -1);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("keydown", key);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = st.current;
    if (s.over) return;
    const die = (s as unknown as { die: () => void }).die;

    // drive traffic
    for (let i = Math.max(0, s.row - 6); i < s.row + 18; i++) {
      const lane = s.lanes[i];
      if (!lane || lane.kind === "safe") continue;
      for (let c = 0; c < lane.cars.length; c++) {
        lane.cars[c]! += lane.dir * lane.speed * dt;
        if (lane.dir > 0 && lane.cars[c]! > EDGE + lane.carW) lane.cars[c]! = -EDGE - lane.carW * 2;
        if (lane.dir < 0 && lane.cars[c]! < -EDGE - lane.carW * 2) lane.cars[c]! = EDGE + lane.carW;
      }
    }

    // hop animation
    if (s.hopT < 1) s.hopT = Math.min(1, s.hopT + dt * 7);
    const e = s.hopT;
    const x = s.from.x + (s.to.x - s.from.x) * e;
    const z = s.from.z + (s.to.z - s.from.z) * e;
    const y = 0.32 + Math.sin(e * Math.PI) * 0.55;

    // collisions on the settled lane
    const lane = s.lanes[s.row];
    let px = s.hopT >= 1 ? s.px : x;
    if (s.hopT >= 1 && lane && lane.kind !== "safe") {
      const hit = lane.cars.some((cx) => px > cx - lane.carW / 2 && px < cx + lane.carW / 2);
      if (lane.kind === "road" && hit) return die();
      if (lane.kind === "river") {
        if (!hit) return die();
        s.px += lane.dir * lane.speed * dt;
        px = s.px;
        if (px < -HALF - 0.7 || px > HALF + 0.7) return die();
      }
    }

    const g = player.current;
    if (g) {
      g.position.set(s.hopT >= 1 ? px : x, y, z);
      g.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.08;
      g.scale.setY(1 - Math.sin(e * Math.PI) * 0.12);
    }

    camera.position.lerp(
      new THREE.Vector3(px * 0.25 + 3.4, 7.2, z + 7.4),
      1 - Math.exp(-4 * dt),
    );
    camera.lookAt(px * 0.2, 0.4, z - 2.2);
  });

  return (
    <>
      <fog attach="fog" args={["#050a12", 14, 34]} />
      {visible.map(({ lane, index }) => (
        <LaneRow key={index} lane={lane} index={index} />
      ))}
      <group ref={player}>
        <group rotation-y={Math.PI}>
          <PigCharacter />
        </group>
      </group>
    </>
  );
}

export function LaneHop({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const [view, setView] = useState({ score: 0, row: 0 });
  useEffect(() => {
    if (running) setView({ score: 0, row: 0 });
  }, [running]);
  if (!running) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[360px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-primary">lane {view.row}</span>
      </div>
      <Game3DCanvas aspect={4 / 5} camera={{ position: [3.4, 7.2, 7.4], fov: 46 }}>
        <HopScene onScore={onScore} onEnd={onEnd} onView={setView} />
      </Game3DCanvas>
      <p className="text-muted-foreground font-mono text-[10px]">
        W / ↑ hop · A D sidestep · tap or swipe on mobile
      </p>
    </div>
  );
}
