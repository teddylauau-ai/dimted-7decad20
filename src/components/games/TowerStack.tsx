import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Game3DCanvas } from "./Game3DCanvas";

/**
 * Tower Stack — build a skyscraper floor by floor. A steel floor plate swings in
 * over the tower; tap to lock it down. Overhang shears off and falls to the
 * street below, so sloppy work narrows the building. Perfect drops re-align the
 * core, widen the plate and light up the whole facade.
 *
 * The camera stays on ONE fixed city-viewing angle and only rises with the
 * tower — no orbiting, so aiming stays readable.
 */

const SLAB_H = 0.55;
const BASE = 4;
const SWEEP = 4.4;
const PERFECT = 0.14;

type Slab = { x: number; z: number; w: number; d: number };
type Shard = { id: number; x: number; y: number; z: number; w: number; d: number; hue: number; vx: number; vz: number };

function hueOf(i: number) {
  return (204 + i * 4) % 360;
}

/** Cached facade texture: simple cartoon building with a few big windows. */
const facadeCache = new Map<number, THREE.Texture>();
function facadeTexture(index: number) {
  const bucket = index % 4;
  const cached = facadeCache.get(bucket);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 64);
  const cols = 5;
  const rows = 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y + bucket) % 3 === 0 ? "#ffe9a8" : "#cfefff";
      g.fillRect(12 + x * 21, 12 + y * 22, 14, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  facadeCache.set(bucket, tex);
  return tex;
}

function FloorMesh({ slab, index, emissive = 0.1 }: { slab: Slab; index: number; emissive?: number }) {
  const color = useMemo(() => new THREE.Color(`hsl(${hueOf(index)}, 52%, 56%)`), [index]);
  const tex = useMemo(() => facadeTexture(index), [index]);
  return (
    <group position={[slab.x, index * SLAB_H + SLAB_H / 2, slab.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[slab.w, SLAB_H, slab.d]} />
        <meshStandardMaterial
          map={tex}
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          roughness={0.65}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}


function ShardMesh({ shard, onDone }: { shard: Shard; onDone: (id: number) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const vel = useRef({ y: 0, rx: (Math.random() - 0.5) * 4, rz: (Math.random() - 0.5) * 4 });
  const color = useMemo(() => new THREE.Color(`hsl(${shard.hue}, 30%, 46%)`), [shard.hue]);
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
        emissiveIntensity={0.2}
        roughness={0.5}
        metalness={0.3}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

/** Static cartoon skyline, kept far away and clear of the camera's sightline. */
const CITY_HUES = [200, 218, 176, 244, 190];
function Skyline() {
  const towers = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number; i: number }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const camAngle = Math.atan2(12.5, 9.5);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + rnd() * 0.1;
      // keep the wedge between the camera and the tower completely empty
      let diff = Math.abs(a - camAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 1.05) continue;
      const r = 22 + rnd() * 14;
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        w: 2 + rnd() * 2.6,
        d: 2 + rnd() * 2.6,
        h: 2.5 + rnd() * 7,
        i,
      });
    }
    return out;
  }, []);
  return (
    <group>
      {towers.map((t) => (
        <mesh key={t.i} position={[t.x, t.h / 2, t.z]}>
          <boxGeometry args={[t.w, t.h, t.d]} />
          <meshStandardMaterial
            color={`hsl(${CITY_HUES[t.i % CITY_HUES.length]}, 38%, ${28 + (t.i % 4) * 5}%)`}
            emissive={`hsl(${CITY_HUES[t.i % CITY_HUES.length]}, 45%, 22%)`}
            emissiveIntensity={0.5}
            roughness={0.85}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
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
  const movingRef = useRef<THREE.Group>(null);
  const craneRef = useRef<THREE.Group>(null);
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
    speed: 2.6,
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
      st.speed = Math.min(8.4, 2.6 + st.slabs.length * 0.16);
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
      }
      const crane = craneRef.current;
      if (crane) crane.position.set(mv.x, topY + SLAB_H * 1.5, mv.z);
    }

    // FIXED viewing angle — the camera only rises with the building.
    const focus = topY + 0.6;
    const target = new THREE.Vector3(9.5, focus + 6.2, 12.5);
    camera.position.lerp(target, 1 - Math.exp(-3.2 * dt));
    camera.lookAt(0, focus, 0);
  });

  const flashOn = flash > 0 && performance.now() - flash < 220;

  return (
    <>
      <fog attach="fog" args={["#050a12", 22, 60]} />
      {/* street plaza */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color="#0a1420" roughness={0.85} metalness={0.15} />
      </mesh>
      <gridHelper args={[60, 30, "#14313f", "#0b1b26"]} position={[0, -0.01, 0]} />
      <Skyline />
      {slabs.map((slab, i) => {
        const index = s.current.slabs.length - slabs.length + i;
        return (
          <FloorMesh
            key={index}
            slab={slab}
            index={index}
            emissive={flashOn && i === slabs.length - 1 ? 0.9 : 0.28}
          />
        );
      })}
      {!s.current.over ? (
        <>
          {/* crane cable + hook holding the incoming floor plate */}
          <group ref={craneRef}>
            <mesh position={[0, 3.2, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 6, 6]} />
              <meshStandardMaterial color="#5c6c7a" roughness={0.6} metalness={0.7} />
            </mesh>
          </group>
          <group ref={movingRef}>
            <mesh castShadow>
              <boxGeometry args={[BASE, SLAB_H, BASE]} />
              <meshStandardMaterial
                map={facadeTexture(s.current.slabs.length)}
                color={new THREE.Color(`hsl(${hueOf(s.current.slabs.length)}, 52%, 56%)`)}
                emissive={new THREE.Color(`hsl(${hueOf(s.current.slabs.length)}, 52%, 56%)`)}
                emissiveIntensity={0.4}
                roughness={0.65}
                metalness={0.05}
              />
            </mesh>
          </group>

        </>
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
        <span className="text-primary">floor {view.height}</span>
        <span className="text-gold">{view.combo > 0 ? `perfect ×${view.combo}` : "—"}</span>
      </div>
      <Game3DCanvas camera={{ position: [9.5, 8, 12.5], fov: 42 }}>
        <StackScene onScore={onScore} onEnd={onEnd} onView={setView} />
      </Game3DCanvas>
      <p className="text-muted-foreground font-mono text-[10px]">Space / tap to lock the floor</p>
    </div>
  );
}
