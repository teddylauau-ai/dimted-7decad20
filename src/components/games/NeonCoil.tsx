import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Game3DCanvas } from "./Game3DCanvas";

/**
 * Neon Coil — snake, rebuilt in 3D. Sweep the coil around a floating grid,
 * swallow energy cores, wrap through the edges. Every few cores drops a mine
 * onto the board, so the arena keeps closing in on you.
 */

const N = 15; // grid cells per side
const HALF = (N - 1) / 2;

type Cell = { x: number; y: number };

const key = (c: Cell) => `${c.x},${c.y}`;

function randomCell(taken: Set<string>): Cell {
  for (let i = 0; i < 400; i++) {
    const c = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
    if (!taken.has(key(c))) return c;
  }
  return { x: 0, y: 0 };
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

  const st = useRef({
    body: [{ x: 7, y: 7 }] as Cell[],
    dir: { x: 1, y: 0 },
    next: { x: 1, y: 0 },
    food: { x: 11, y: 7 } as Cell,
    mines: [] as Cell[],
    score: 0,
    eaten: 0,
    over: false,
    step: 0,
    interval: 0.14,
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
      core.current.position.y = 0.42 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
    }
    camera.position.lerp(new THREE.Vector3(0, 15, 12.5), 1 - Math.exp(-2 * dt));
    camera.lookAt(0, 0, 0);
    if (s.over) return;

    s.step += dt;
    if (s.step < s.interval) return;
    s.step = 0;
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

    const ate = nextHead.x === s.food.x && nextHead.y === s.food.y;
    s.body = [nextHead, ...s.body];
    if (!ate) s.body.pop();
    else {
      s.eaten += 1;
      s.score += 40 + s.body.length * 4;
      s.interval = Math.max(0.06, 0.14 - s.eaten * 0.003);
      const taken = new Set(s.body.map(key));
      s.mines.forEach((m) => taken.add(key(m)));
      if (s.eaten % 3 === 0) s.mines.push(randomCell(taken));
      const taken2 = new Set(s.body.map(key));
      s.mines.forEach((m) => taken2.add(key(m)));
      s.food = randomCell(taken2);
      cb.current.onScore(s.score);
      cb.current.onView({ score: s.score, length: s.body.length });
    }
    force((v) => v + 1);
  });

  const s = st.current;
  const pos = (c: Cell): [number, number, number] => [c.x - HALF, 0.3, c.y - HALF];

  return (
    <>
      <fog attach="fog" args={["#050a12", 20, 44]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[N, N]} />
        <meshStandardMaterial color="#07131e" roughness={0.4} metalness={0.6} />
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
      {s.body.map((c, i) => {
        const t = i / Math.max(1, s.body.length);
        const scale = i === 0 ? 0.88 : 0.72 - t * 0.16;
        return (
          <mesh key={`${i}-${c.x}-${c.y}`} position={pos(c)} castShadow>
            <boxGeometry args={[scale, scale * 0.8, scale]} />
            <meshStandardMaterial
              color={i === 0 ? "#f6c860" : new THREE.Color(`hsl(${168 + t * 60}, 75%, ${58 - t * 18}%)`)}
              emissive={i === 0 ? "#f6c860" : "#2ee6c4"}
              emissiveIntensity={i === 0 ? 0.7 : 0.3 - t * 0.2}
              roughness={0.25}
              metalness={0.5}
            />
          </mesh>
        );
      })}
      <mesh ref={core} position={pos(s.food)} castShadow>
        <octahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color="#7df9ff" emissive="#7df9ff" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={pos(s.food)} color="#7df9ff" intensity={6} distance={5} />
      {s.mines.map((m, i) => (
        <mesh key={`m${i}`} position={pos(m)} castShadow>
          <coneGeometry args={[0.36, 0.8, 5]} />
          <meshStandardMaterial color="#ff5f7e" emissive="#ff2f57" emissiveIntensity={0.9} />
        </mesh>
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
      <Game3DCanvas aspect={1} camera={{ position: [0, 15, 12.5], fov: 46 }}>
        <CoilScene onScore={onScore} onEnd={onEnd} onView={setView} />
      </Game3DCanvas>
      <p className="text-muted-foreground font-mono text-[10px]">
        Arrows / WASD · swipe on mobile · edges wrap
      </p>
    </div>
  );
}
