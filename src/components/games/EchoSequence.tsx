import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Game3DCanvas } from "./Game3DCanvas";

/**
 * Echo Sequence — memory under pressure, on a 3D pad deck. The deck plays back
 * a growing pattern, you repeat it. Playback speeds up every round and one wrong
 * pad ends the run.
 */

const PADS = 6;
const TONES = ["#2ee6c4", "#7db9ff", "#f6c860", "#ff7aa2", "#a78bfa", "#5ce6a0"];
const FREQ = [261.6, 329.6, 392, 493.9, 587.3, 659.3];

function padPos(i: number): [number, number, number] {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return [(col - 1) * 2.3, 0, (row - 0.5) * 2.3];
}

function Pad({
  index,
  lit,
  onHit,
}: {
  index: number;
  lit: boolean;
  onHit: (i: number) => void;
}) {
  const g = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const color = TONES[index]!;
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const grp = g.current;
    if (!grp) return;
    const target = lit ? 0.52 : hover ? 0.2 : 0;
    grp.position.y += (target - grp.position.y) * (1 - Math.exp(-14 * dt));
    grp.rotation.y = Math.sin(state.clock.elapsedTime * 0.6 + index) * 0.03;
  });
  return (
    <group ref={g} position={padPos(index)}>
      <mesh
        castShadow
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation();
          onHit(index);
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[2, 0.5, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={lit ? 1.5 : 0.12}
          roughness={0.25}
          metalness={0.45}
        />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <boxGeometry args={[1.6, 0.04, 1.6]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={lit ? 2.4 : 0.25}
          transparent
          opacity={lit ? 0.9 : 0.32}
        />
      </mesh>
      {lit ? <pointLight color={color} intensity={7} distance={4.5} position={[0, 1, 0]} /> : null}
    </group>
  );
}

function Deck({
  lit,
  onHit,
}: {
  lit: number | null;
  onHit: (i: number) => void;
}) {
  return (
    <>
      <fog attach="fog" args={["#050a12", 12, 30]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.36, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#07121d" roughness={0.4} metalness={0.6} />
      </mesh>
      <gridHelper args={[24, 24, "#153a4c", "#0c1f2b"]} position={[0, -0.35, 0]} />
      {Array.from({ length: PADS }, (_, i) => (
        <Pad key={i} index={i} lit={lit === i} onHit={onHit} />
      ))}
    </>
  );
}

export function EchoSequence({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const s = useRef({
    seq: [] as number[],
    step: 0,
    round: 0,
    score: 0,
    over: false,
    accepting: false,
  });
  const [lit, setLit] = useState<number | null>(null);
  const [view, setView] = useState({ round: 0, score: 0, phase: "watch" as "watch" | "repeat" });
  const timers = useRef<number[]>([]);
  const audio = useRef<AudioContext | null>(null);

  const tone = (pad: number, bad = false) => {
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = bad ? "sawtooth" : "triangle";
      osc.frequency.value = bad ? 90 : FREQ[pad]!;
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.34);
    } catch {
      /* audio is a nicety */
    }
  };

  useEffect(() => {
    if (!running) return;
    const st = s.current;
    st.seq = [];
    st.step = 0;
    st.round = 0;
    st.score = 0;
    st.over = false;
    st.accepting = false;
    cbs.current.onScore(0);

    const clearTimers = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };

    const playback = () => {
      const st2 = s.current;
      st2.accepting = false;
      setView({ round: st2.round, score: st2.score, phase: "watch" });
      const on = Math.max(180, 520 - st2.round * 22);
      const gap = Math.max(90, 240 - st2.round * 10);
      st2.seq.forEach((pad, i) => {
        timers.current.push(
          window.setTimeout(() => {
            setLit(pad);
            tone(pad);
          }, i * (on + gap)),
          window.setTimeout(() => setLit(null), i * (on + gap) + on),
        );
      });
      timers.current.push(
        window.setTimeout(
          () => {
            const st3 = s.current;
            st3.step = 0;
            st3.accepting = true;
            setView({ round: st3.round, score: st3.score, phase: "repeat" });
          },
          st2.seq.length * (on + gap) + 140,
        ),
      );
    };

    const nextRound = () => {
      const st2 = s.current;
      st2.round += 1;
      st2.seq.push(Math.floor(Math.random() * PADS));
      playback();
    };

    (s.current as unknown as { press: (i: number) => void }).press = (pad: number) => {
      const st2 = s.current;
      if (st2.over || !st2.accepting) return;
      setLit(pad);
      window.setTimeout(() => setLit(null), 130);
      if (st2.seq[st2.step] === pad) {
        tone(pad);
        st2.step += 1;
        st2.score += 20 + st2.round * 5;
        cbs.current.onScore(st2.score);
        setView({ round: st2.round, score: st2.score, phase: "repeat" });
        if (st2.step >= st2.seq.length) {
          st2.accepting = false;
          st2.score += 60 + st2.round * 20;
          cbs.current.onScore(st2.score);
          timers.current.push(window.setTimeout(nextRound, 520));
        }
      } else {
        tone(pad, true);
        st2.over = true;
        st2.accepting = false;
        clearTimers();
        cbs.current.onEnd(st2.score);
      }
    };

    timers.current.push(window.setTimeout(nextRound, 500));
    return () => {
      clearTimers();
      s.current.over = true;
    };
  }, [running]);

  if (!running) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[360px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-primary">round {view.round}</span>
        <span className={view.phase === "watch" ? "text-gold" : "text-primary"}>
          {view.phase === "watch" ? "watch" : "repeat"}
        </span>
      </div>
      <Game3DCanvas aspect={1} camera={{ position: [0, 6.4, 6.6], fov: 46 }}>
        <Deck
          lit={lit}
          onHit={(i) => (s.current as unknown as { press?: (n: number) => void }).press?.(i)}
        />
      </Game3DCanvas>
      <p className="text-muted-foreground font-mono text-[10px]">
        Watch the deck, then tap the pads back in order
      </p>
    </div>
  );
}
