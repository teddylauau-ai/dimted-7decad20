import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Game3DCanvas } from "./Game3DCanvas";

/**
 * Neon Coil — a sleek cybernetic serpent hunting energy cores on a floating
 * grid. The body glides between cells instead of snapping, the head is a
 * armoured wedge with a visor and fins, and every few cores drops a mine so the
 * arena keeps closing in.
 */

const N = 15; // grid cells per side
const HALF = (N - 1) / 2;
const POOL = 90; // reusable segment meshes

type Cell = { x: number; y: number };

const key = (c: Cell) => `${c.x},${c.y}`;

function randomCell(taken: Set<string>): Cell {
  for (let i = 0; i < 400; i++) {
    const c = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
    if (!taken.has(key(c))) return c;
  }
  return { x: 0, y: 0 };
}

/** Head of the serpent: armoured wedge, glowing visor, swept fins. */
function SerpentHead() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.72, 0.4, 0.9]} />
        <meshStandardMaterial color="#123c46" roughness={0.28} metalness={0.85} />
      </mesh>
      {/* snout taper */}
      <mesh castShadow position={[0, -0.02, 0.56]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.3, 0.42, 4]} />
        <meshStandardMaterial color="#0f333c" roughness={0.25} metalness={0.9} />
      </mesh>
      {/* visor */}
      <mesh position={[0, 0.1, 0.36]}>
        <boxGeometry args={[0.56, 0.12, 0.16]} />
        <meshStandardMaterial color="#8ffff0" emissive="#37f5d8" emissiveIntensity={2.6} />
      </mesh>
      {/* dorsal ridge */}
      <mesh position={[0, 0.24, -0.06]}>
        <boxGeometry args={[0.12, 0.14, 0.7]} />
        <meshStandardMaterial color="#f6c860" emissive="#f6c860" emissiveIntensity={1.1} />
      </mesh>
      {/* swept fins */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.42, 0.02, -0.16]} rotation-y={sx * 0.5} castShadow>
          <boxGeometry args={[0.26, 0.07, 0.42]} />
          <meshStandardMaterial color="#1c5c68" emissive="#2ee6c4" emissiveIntensity={0.7} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function CoilScene({
  onScore,
  onEnd,
  onView,
}: {
  onScore: (n: number) => void;
  onEnd: (n: number) => void;
  onView: (v: { score: number; length: number }) => void;
}) {
  const { gl, camera } = useThree();
  const cb = useRef({ onScore, onEnd, onView });
  cb.current = { onScore, onEnd, onView };
  const [, force] = useState(0);
  const core = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const segRefs = useRef<(THREE.Group | null)[]>([]);

  const st = useRef({
    body: [{ x: 7, y: 7 }] as Cell[],
    prev: [{ x: 7, y: 7 }] as Cell[],
    dir: { x: 1, y: 0 },
    next: { x: 1, y: 0 },
    food: { x: 11, y: 7 } as Cell,
    mines: [] as Cell[],
    score: 0,
    eaten: 0,
    over: false,
    step: 0,
    interval: 0.16,
    yaw: 0,
  });

  useEffect(() => {
    const s = st.current;
    const turn = (x: number, y: number) => {
      if (s.over) return;
      if (s.dir.x === -x && s.dir.y === -y) return;
      s.next = { x, y };
    };
    const k = (e: KeyboardEvent) => {
      const c = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(c))
        e.preventDefault();
      if (c === "arrowup" || c === "w") turn(0, -1);
      else if (c === "arrowdown" || c === "s") turn(0, 1);
      else if (c === "arrowleft" || c === "a") turn(-1, 0);
      else if (c === "arrowright" || c === "d") turn(1, 0);
    };
    window.addEventListener("keydown", k);
    let start: { x: number; y: number } | null = null;
    const el = gl.domElement;
    const down = (e: PointerEvent) => (start = { x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
      else turn(0, dy > 0 ? 1 : -1);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("keydown", k);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = st.current;
    if (core.current) {
      core.current.rotation.y += dt * 2.4;
      core.current.position.y = 0.46 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
    }
    // gentler, slightly higher-angle view: easier to read the grid while playing
    camera.position.lerp(new THREE.Vector3(0, 16.5, 9.5), 1 - Math.exp(-2 * dt));
    camera.lookAt(0, 0, -0.4);

    if (!s.over) {
      s.step += dt;
      if (s.step >= s.interval) {
        s.step -= s.interval;
        s.dir = s.next;

        const head = s.body[0]!;
        const nx = (head.x + s.dir.x + N) % N;
        const ny = (head.y + s.dir.y + N) % N;
        const nextHead = { x: nx, y: ny };

        if (
          s.body.slice(0, -1).some((c) => c.x === nx && c.y === ny) ||
          s.mines.some((m) => m.x === nx && m.y === ny)
        ) {
          s.over = true;
          cb.current.onEnd(s.score);
          force((v) => v + 1);
          return;
        }

        s.prev = s.body;
        const ate = nextHead.x === s.food.x && nextHead.y === s.food.y;
        const nextBody = [nextHead, ...s.body];
        if (!ate) nextBody.pop();
        s.body = nextBody;
        if (ate) {
          s.eaten += 1;
          s.score += 40 + s.body.length * 4;
          s.interval = Math.max(0.07, 0.16 - s.eaten * 0.003);
          const taken = new Set(s.body.map(key));
          s.mines.forEach((m) => taken.add(key(m)));
          if (s.eaten % 3 === 0) s.mines.push(randomCell(taken));
          const taken2 = new Set(s.body.map(key));
          s.mines.forEach((m) => taken2.add(key(m)));
          s.food = randomCell(taken2);
          cb.current.onScore(s.score);
          cb.current.onView({ score: s.score, length: s.body.length });
          force((v) => v + 1);
        }
      }
    }

    // smooth glide: interpolate each segment from its previous cell
    const t = s.over ? 1 : Math.min(1, s.step / s.interval);
    const len = s.body.length;
    for (let i = 0; i < POOL; i++) {
      const g = segRefs.current[i];
      if (!g) continue;
      if (i >= len) {
        g.visible = false;
        continue;
      }
      g.visible = i > 0; // segment 0 is the head group
      const cur = s.body[i]!;
      const from = s.prev[i] ?? s.prev[s.prev.length - 1] ?? cur;
      let fx = from.x;
      let fy = from.y;
      if (Math.abs(cur.x - fx) > 1) fx = cur.x; // wrapped, snap
      if (Math.abs(cur.y - fy) > 1) fy = cur.y;
      const x = fx + (cur.x - fx) * t - HALF;
      const z = fy + (cur.y - fy) * t - HALF;
      const wave = Math.sin(state.clock.elapsedTime * 6 - i * 0.55) * 0.05;
      g.position.set(x, 0.3 + wave, z);
      const taper = 1 - (i / Math.max(6, len)) * 0.45;
      g.scale.setScalar(Math.max(0.4, taper));
      g.rotation.y = Math.atan2(cur.x - fx, cur.y - fy);
      if (i === 0) {
        const h = headRef.current;
        if (h) {
          h.position.set(x, 0.34, z);
          const target = Math.atan2(s.dir.x, s.dir.y);
          h.rotation.y += ((target - h.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 14);
        }
      }
    }
  });

  const s = st.current;
  const pos = (c: Cell): [number, number, number] => [c.x - HALF, 0.3, c.y - HALF];
  const pool = useMemo(() => Array.from({ length: POOL }, (_, i) => i), []);

  return (
    <>
      <fog attach="fog" args={["#050a12", 20, 46]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[N, N]} />
        <meshStandardMaterial color="#07131e" roughness={0.35} metalness={0.7} />
      </mesh>
      <gridHelper args={[N, N, "#15384a", "#0d222f"]} position={[0, 0.01, 0]} />
      {/* arena rim */}
      {[
        [0, (N + 0.4) / 2],
        [0, -(N + 0.4) / 2],
      ].map(([x, z], i) => (
        <mesh key={`rz${i}`} position={[x!, 0.2, z!]}>
          <boxGeometry args={[N + 0.6, 0.14, 0.3]} />
          <meshStandardMaterial color="#2ee6c4" emissive="#2ee6c4" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {[
        [(N + 0.4) / 2, 0],
        [-(N + 0.4) / 2, 0],
      ].map(([x, z], i) => (
        <mesh key={`rx${i}`} position={[x!, 0.2, z!]}>
          <boxGeometry args={[0.3, 0.14, N + 0.6]} />
          <meshStandardMaterial color="#2ee6c4" emissive="#2ee6c4" emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* serpent head */}
      <group ref={headRef}>
        <SerpentHead />
      </group>

      {/* body segments: armoured plates that taper toward the tail */}
      {pool.map((i) => (
        <group
          key={i}
          ref={(el) => {
            segRefs.current[i] = el;
          }}
          visible={false}
        >
          <mesh castShadow>
            <boxGeometry args={[0.62, 0.34, 0.78]} />
            <meshStandardMaterial
              color="#10333d"
              roughness={0.3}
              metalness={0.85}
            />
          </mesh>
          {/* glowing spine line */}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.16, 0.06, 0.66]} />
            <meshStandardMaterial color="#2ee6c4" emissive="#2ee6c4" emissiveIntensity={1.5} />
          </mesh>
          {/* side vents */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.33, 0, 0]}>
              <boxGeometry args={[0.04, 0.12, 0.5]} />
              <meshStandardMaterial color="#7df9ff" emissive="#7df9ff" emissiveIntensity={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      <mesh ref={core} position={pos(s.food)} castShadow>
        <octahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color="#7df9ff" emissive="#7df9ff" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={pos(s.food)} color="#7df9ff" intensity={6} distance={5} />
      {s.mines.map((m, i) => (
        <group key={`m${i}`} position={pos(m)}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial color="#ff5f7e" emissive="#ff2f57" emissiveIntensity={1.1} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function NeonCoil({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const [view, setView] = useState({ score: 0, length: 1 });
  useEffect(() => {
    if (running) setView({ score: 0, length: 1 });
  }, [running]);
  if (!running) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[360px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-primary">coil {view.length}</span>
      </div>
      <Game3DCanvas aspect={1} camera={{ position: [0, 16.5, 9.5], fov: 46 }}>
        <CoilScene onScore={onScore} onEnd={onEnd} onView={setView} />
      </Game3DCanvas>
      <p className="text-muted-foreground font-mono text-[10px]">
        Arrows / WASD · swipe on mobile · edges wrap
      </p>
    </div>
  );
}
