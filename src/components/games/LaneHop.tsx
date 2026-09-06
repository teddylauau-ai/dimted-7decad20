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
  if (index % 4 === 0) return { kind: "safe", dir: 1, speed: 0, cars: [], carW: 0 };
  const kind = Math.random() < 0.68 ? "road" : "river";
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const speed = (kind === "road" ? 2.6 : 1.7) + Math.min(6, index * 0.09) + Math.random() * 1.2;
  const carW = kind === "road" ? (Math.random() < 0.3 ? 2 : 1.3) : 2.6;
  const gap = kind === "road" ? 3 + Math.random() * 2 : 3.4;
  const cars: number[] = [];
  for (let x = -EDGE - carW; x < EDGE + carW; x += carW + gap) cars.push(x + Math.random() * 0.4);
  return { kind, dir, speed, cars, carW };
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
            <group key={i} position={[x, 0.34, 0]}>
              <mesh castShadow>
                <boxGeometry args={[lane.carW, 0.42, 0.66]} />
                <meshStandardMaterial
                  color={lane.dir > 0 ? "#ff6a8b" : "#ffb347"}
                  roughness={0.3}
                  metalness={0.4}
                />
              </mesh>
              <mesh position={[0, 0.3, 0]} castShadow>
                <boxGeometry args={[lane.carW * 0.55, 0.24, 0.56]} />
                <meshStandardMaterial color="#0d1522" roughness={0.2} metalness={0.6} />
              </mesh>
              <mesh position={[(lane.dir > 0 ? 1 : -1) * (lane.carW / 2 + 0.02), 0.02, 0]}>
                <boxGeometry args={[0.06, 0.18, 0.5]} />
                <meshStandardMaterial color="#fff6d8" emissive="#fff6d8" emissiveIntensity={2} />
              </mesh>
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
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.5, 0.6]} />
          <meshStandardMaterial
            color="#f6c860"
            emissive="#f6c860"
            emissiveIntensity={0.35}
            roughness={0.25}
            metalness={0.5}
          />
        </mesh>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[0.4, 0.24, 0.4]} />
          <meshStandardMaterial color="#fff3cf" emissive="#f6c860" emissiveIntensity={0.5} />
        </mesh>
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
