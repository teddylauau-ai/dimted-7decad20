import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Game3DCanvas } from "./Game3DCanvas";

/**
 * Tower Stack — the classic stacker, now fully 3D. A slab sweeps in over the
 * tower on alternating axes; tap to drop it. Overhang is sliced off and tumbles
 * away, so sloppy drops shrink the next slab. Perfect drops regrow width, pay a
 * combo, and flash the tower.
 */

const SLAB_H = 0.55;
const BASE = 4;
const SWEEP = 7;
const PERFECT = 0.14;

type Slab = { x: number; z: number; w: number; d: number };
type Shard = { id: number; x: number; y: number; z: number; w: number; d: number; hue: number; vx: number; vz: number };

function hueOf(i: number) {
  return (168 + i * 9) % 360;
}

function SlabMesh({
  slab,
  index,
  emissive = 0.12,
}: {
  slab: Slab;
  index: number;
  emissive?: number;
}) {
  const color = useMemo(() => new THREE.Color(`hsl(${hueOf(index)}, 68%, 56%)`), [index]);
  return (
    <mesh
      position={[slab.x, index * SLAB_H + SLAB_H / 2, slab.z]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[slab.w, SLAB_H, slab.d]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissive}
        roughness={0.28}
        metalness={0.35}
      />
    </mesh>
  );
}

function ShardMesh({ shard, onDone }: { shard: Shard; onDone: (id: number) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const vel = useRef({ y: 0, rx: (Math.random() - 0.5) * 4, rz: (Math.random() - 0.5) * 4 });
  const color = useMemo(() => new THREE.Color(`hsl(${shard.hue}, 68%, 56%)`), [shard.hue]);
  useEffect(() => {
    const t = window.setTimeout(() => onDone(shard.id), 2200);
    return () => window.clearTimeout(t);
  }, [shard.id, onDone]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const m = ref.current;
    if (!m) return;
    vel.current.y -= 22 * dt;
    m.position.y += vel.current.y * dt;
    m.position.x += shard.vx * dt;
    m.position.z += shard.vz * dt;
    m.rotation.x += vel.current.rx * dt;
    m.rotation.z += vel.current.rz * dt;
  });
  return (
    <mesh ref={ref} position={[shard.x, shard.y, shard.z]}>
      <boxGeometry args={[shard.w, SLAB_H, shard.d]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.25}
        roughness={0.3}
        metalness={0.3}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

function StackScene({
  onScore,
  onEnd,
  onView,
}: {
  onScore: (n: number) => void;
  onEnd: (n: number) => void;
  onView: (v: { score: number; combo: number; height: number }) => void;
}) {
  const { camera, gl } = useThree();
  const movingRef = useRef<THREE.Mesh>(null);
  const [slabs, setSlabs] = useState<Slab[]>([{ x: 0, z: 0, w: BASE, d: BASE }]);
  const [shards, setShards] = useState<Shard[]>([]);
  const [flash, setFlash] = useState(0);
  const shardId = useRef(0);
  const cb = useRef({ onScore, onEnd, onView });
  cb.current = { onScore, onEnd, onView };

  const s = useRef({
    slabs: [{ x: 0, z: 0, w: BASE, d: BASE }] as Slab[],
    moving: { x: -SWEEP, z: 0, w: BASE, d: BASE } as Slab,
    axis: "x" as "x" | "z",
    dir: 1,
    speed: 3.4,
    score: 0,
    combo: 0,
    over: false,
  });

  useEffect(() => {
    const st = s.current;
    const drop = () => {
      if (st.over) return;
      const top = st.slabs[st.slabs.length - 1]!;
      const mv = st.moving;
      const axis = st.axis;
      const cur = axis === "x" ? mv.x : mv.z;
      const base = axis === "x" ? top.x : top.z;
      const size = axis === "x" ? top.w : top.d;
      const delta = cur - base;
      const overlap = size - Math.abs(delta);

      if (overlap <= 0.08) {
        st.over = true;
        setShards((prev) => [
          ...prev,
          {
            id: shardId.current++,
            x: mv.x,
            y: st.slabs.length * SLAB_H + SLAB_H / 2,
            z: mv.z,
            w: mv.w,
            d: mv.d,
            hue: hueOf(st.slabs.length),
            vx: axis === "x" ? Math.sign(delta) * 3 : 0,
            vz: axis === "z" ? Math.sign(delta) * 3 : 0,
          },
        ]);
        cb.current.onEnd(st.score);
        return;
      }

      const perfect = Math.abs(delta) <= PERFECT;
      let newCentre = base + delta / 2;
      let newSize = overlap;
      if (perfect) {
        newCentre = base;
        newSize = Math.min(BASE, size + 0.14);
        st.combo += 1;
        st.score += 100 + st.combo * 40;
        setFlash(performance.now());
      } else {
        st.combo = 0;
        st.score += 60;
        const shardSize = Math.abs(delta);
        const shardCentre = base + Math.sign(delta) * (size / 2 + shardSize / 2);
        setShards((prev) => [
          ...prev.slice(-8),
          {
            id: shardId.current++,
            x: axis === "x" ? shardCentre : mv.x,
            y: st.slabs.length * SLAB_H + SLAB_H / 2,
            z: axis === "z" ? shardCentre : mv.z,
            w: axis === "x" ? shardSize : mv.w,
            d: axis === "z" ? shardSize : mv.d,
            hue: hueOf(st.slabs.length),
            vx: axis === "x" ? Math.sign(delta) * 2.5 : 0,
            vz: axis === "z" ? Math.sign(delta) * 2.5 : 0,
          },
        ]);
      }

      const placed: Slab =
        axis === "x"
          ? { x: newCentre, z: top.z, w: newSize, d: top.d }
          : { x: top.x, z: newCentre, w: top.w, d: newSize };
      st.slabs = [...st.slabs, placed];
      setSlabs(st.slabs.slice(-26));

      st.axis = axis === "x" ? "z" : "x";
      st.dir = 1;
      st.speed = Math.min(11, 3.4 + st.slabs.length * 0.2);
      st.moving =
        st.axis === "x"
          ? { x: -SWEEP, z: placed.z, w: placed.w, d: placed.d }
          : { x: placed.x, z: -SWEEP, w: placed.w, d: placed.d };

      cb.current.onScore(st.score);
      cb.current.onView({ score: st.score, combo: st.combo, height: st.slabs.length - 1 });
    };

    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown") {
        e.preventDefault();
        drop();
      }
    };
    const pointer = (e: Event) => {
      e.preventDefault();
      drop();
    };
    window.addEventListener("keydown", key);
    const el = gl.domElement;
    el.addEventListener("pointerdown", pointer);
    return () => {
      window.removeEventListener("keydown", key);
      el.removeEventListener("pointerdown", pointer);
    };
  }, [gl]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const st = s.current;
    const topY = (st.slabs.length - 1) * SLAB_H;

    if (!st.over) {
      const mv = st.moving;
      if (st.axis === "x") {
        mv.x += st.dir * st.speed * dt;
        if (mv.x > SWEEP) (mv.x = SWEEP), (st.dir = -1);
        if (mv.x < -SWEEP) (mv.x = -SWEEP), (st.dir = 1);
      } else {
        mv.z += st.dir * st.speed * dt;
        if (mv.z > SWEEP) (mv.z = SWEEP), (st.dir = -1);
        if (mv.z < -SWEEP) (mv.z = -SWEEP), (st.dir = 1);
      }
      const m = movingRef.current;
      if (m) {
        m.position.set(mv.x, topY + SLAB_H * 1.5, mv.z);
        m.scale.set(mv.w / BASE, 1, mv.d / BASE);
        m.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.02;
      }
    }

    // orbiting chase camera that rises with the tower
    const t = state.clock.elapsedTime * 0.18;
    const focus = topY + 0.6;
    const radius = 11;
    camera.position.lerp(
      new THREE.Vector3(Math.cos(t) * radius, focus + 6.4, Math.sin(t) * radius),
      1 - Math.exp(-3 * dt),
    );
    camera.lookAt(0, focus, 0);
  });

  const flashOn = flash > 0 && performance.now() - flash < 220;

  return (
    <>
      <fog attach="fog" args={["#050a12", 16, 46]} />
      {/* infinite reflective floor pad under the tower */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[26, 64]} />
        <meshStandardMaterial color="#08131f" roughness={0.55} metalness={0.5} />
      </mesh>
      <gridHelper args={[52, 52, "#123043", "#0a1c28"]} position={[0, -0.01, 0]} />
      {slabs.map((slab, i) => {
        const index = s.current.slabs.length - slabs.length + i;
        return (
          <SlabMesh
            key={index}
            slab={slab}
            index={index}
            emissive={flashOn && i === slabs.length - 1 ? 0.85 : 0.12}
          />
        );
      })}
      {!s.current.over ? (
        <mesh ref={movingRef} castShadow>
          <boxGeometry args={[BASE, SLAB_H, BASE]} />
          <meshStandardMaterial
            color="#f6c860"
            emissive="#f6c860"
            emissiveIntensity={0.55}
            roughness={0.2}
            metalness={0.55}
          />
        </mesh>
      ) : null}
      {shards.map((sh) => (
        <ShardMesh
          key={sh.id}
          shard={sh}
          onDone={(id) => setShards((prev) => prev.filter((p) => p.id !== id))}
        />
      ))}
    </>
  );
}

export function TowerStack({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const [view, setView] = useState({ score: 0, combo: 0, height: 0 });
  useEffect(() => {
    if (running) setView({ score: 0, combo: 0, height: 0 });
  }, [running]);

  if (!running) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[360px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-primary">height {view.height}</span>
        <span className="text-gold">{view.combo > 0 ? `perfect ×${view.combo}` : "—"}</span>
      </div>
      <Game3DCanvas camera={{ position: [11, 8, 11], fov: 42 }}>
        <StackScene onScore={onScore} onEnd={onEnd} onView={setView} />
      </Game3DCanvas>
      <p className="text-muted-foreground font-mono text-[10px]">Space / tap to drop</p>
    </div>
  );
}
