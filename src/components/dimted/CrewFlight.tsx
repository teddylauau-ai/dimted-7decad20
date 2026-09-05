import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Shield, Sparkles, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDimted } from "@/lib/dimted-store";
import { awardArcadeXp } from "@/lib/games-queries";
import { contributeCrewXp } from "@/lib/crews";
import { cn } from "@/lib/utils";

/**
 * Skyward — the crew minigame. One button, flappy-style: tap to flap, thread
 * the gates, grab orbs for a rising combo, and bank a shield when you can.
 * Personal XP comes from the arcade RPC; the same run banks XP into the crew's
 * shared pool (server-verified membership).
 */

const W = 560;
const H = 360;
const GRAVITY = 1500; // px/s^2
const FLAP = -430; // px/s
const BASE_SPEED = 190; // px/s
const MAX_SPEED = 330;
const BASE_GAP = 148;
const MIN_GAP = 108;
const GATE_W = 54;
const BASE_SPACING = 260;
const BIRD_X = 130;
const BIRD_R = 13;
const ORB_R = 9;

type Gate = {
  x: number;
  gapY: number;
  passed: boolean;
  drift: number; // vertical movement speed for late-game gates
  orb: { y: number; taken: boolean } | null;
  shield: boolean; // orb grants a shield instead of combo
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: string };

const BEST_KEY = "lazu.skyward.best";

function speedFor(score: number) {
  return Math.min(MAX_SPEED, BASE_SPEED + score * 4);
}
function gapFor(score: number) {
  return Math.max(MIN_GAP, BASE_GAP - score * 1.6);
}
function spacingFor(score: number) {
  return Math.max(200, BASE_SPACING - score * 2);
}

export function CrewFlight({ crewId, crewName, boosted }: { crewId: string; crewName: string; boosted: boolean }) {
  const { syncXp, surgeActive } = useDimted();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");
  const [score, setScore] = useState(0);
  const [orbs, setOrbs] = useState(0);
  const [combo, setCombo] = useState(1);
  const [shield, setShield] = useState(false);
  const [best, setBest] = useState(0);
  const [banked, setBanked] = useState<{ xp: number; crew: number } | null>(null);

  const state = useRef({
    y: H / 2,
    vy: 0,
    gates: [] as Gate[],
    parts: [] as Particle[],
    score: 0,
    orbs: 0,
    combo: 1,
    shield: false,
    shake: 0,
    invuln: 0,
    running: false,
    t: 0,
  });

  useEffect(() => {
    const raw = localStorage.getItem(BEST_KEY);
    if (raw) setBest(Number(raw) || 0);
  }, []);

  const finish = useCallback(
    async (finalScore: number, finalOrbs: number) => {
      setPhase("over");
      setScore(finalScore);
      const runPoints = finalScore * 12 + finalOrbs * 8;
      if (runPoints > best) {
        setBest(runPoints);
        localStorage.setItem(BEST_KEY, String(runPoints));
      }
      if (runPoints <= 0) return;

      const crewGain = Math.round((finalScore * 22 + finalOrbs * 14) * (boosted ? 1.5 : 1));
      try {
        const [reward, contrib] = await Promise.all([
          awardArcadeXp("crew-flight" as never, runPoints),
          contributeCrewXp(crewId, crewGain),
        ]);
        if (reward.status === "awarded" || reward.status === "granted") {
          syncXp(reward, "Skyward run");
          const crewAdded = contrib.added ?? crewGain;
          setBanked({ xp: reward.gained ?? 0, crew: crewAdded });
          toast.success(
            `+${reward.gained} XP · +${reward.sparks_gained} sparks · +${crewAdded} crew XP` +
              (surgeActive ? " · surge doubled" : ""),
          );
        }
      } catch {
        toast.error("Couldn't bank that run");
      }
    },
    [best, boosted, crewId, surgeActive, syncXp],
  );

  const makeGate = useCallback((x: number, score: number): Gate => {
    const gap = gapFor(score);
    const gapY = gap / 2 + 24 + Math.random() * (H - gap - 48);
    const shieldOrb = score > 6 && Math.random() < 0.14;
    return {
      x,
      gapY,
      passed: false,
      drift: score > 12 && Math.random() < 0.45 ? (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 22) : 0,
      orb: Math.random() < 0.55 || shieldOrb ? { y: gapY, taken: false } : null,
      shield: shieldOrb,
    };
  }, []);

  const flap = useCallback(() => {
    if (phase === "playing") {
      state.current.vy = FLAP;
      const s = state.current;
      for (let i = 0; i < 4; i += 1) {
        s.parts.push({
          x: BIRD_X - 8,
          y: s.y + 6,
          vx: -60 - Math.random() * 60,
          vy: 20 + Math.random() * 50,
          life: 0.4,
          hue: "#5eead4",
        });
      }
      return;
    }
    // start / restart
    state.current = {
      y: H / 2,
      vy: FLAP * 0.6,
      gates: [makeGate(W + 80, 0), makeGate(W + 80 + BASE_SPACING, 0), makeGate(W + 80 + BASE_SPACING * 2, 0)],
      parts: [],
      score: 0,
      orbs: 0,
      combo: 1,
      shield: false,
      shake: 0,
      invuln: 0.4,
      running: true,
      t: 0,
    };
    setScore(0);
    setOrbs(0);
    setCombo(1);
    setShield(false);
    setBanked(null);
    setPhase("playing");
  }, [makeGate, phase]);

  // input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  // loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    const draw = () => {
      const s = state.current;
      const speed = speedFor(s.score);
      const gap = gapFor(s.score);

      ctx.save();
      if (s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      // background
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#08101c");
      g.addColorStop(0.6, "#0b1220");
      g.addColorStop(1, "#121d33");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // parallax stars
      for (let layer = 0; layer < 2; layer += 1) {
        const sp = 0.15 + layer * 0.25;
        ctx.globalAlpha = 0.35 - layer * 0.12;
        ctx.fillStyle = layer === 0 ? "#94a3b8" : "#5eead4";
        for (let i = 0; i < 26; i += 1) {
          const seed = i * (layer === 0 ? 71 : 113);
          const x = ((seed * 13 - s.t * speed * sp) % (W + 20) + W + 20) % (W + 20);
          const y = (seed * 29) % H;
          ctx.fillRect(x, y, 2, 2);
        }
      }
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#2dd4bf";
      ctx.lineWidth = 1;
      for (let x = ((-s.t * speed * 0.4) % 40 + 40) % 40; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // gates
      for (const gate of s.gates) {
        const top = gate.gapY - gap / 2;
        const bottom = gate.gapY + gap / 2;
        const moving = gate.drift !== 0;
        ctx.fillStyle = moving ? "#0e7490" : "#14b8a6";
        ctx.globalAlpha = 0.92;
        ctx.fillRect(gate.x, 0, GATE_W, top);
        ctx.fillRect(gate.x, bottom, GATE_W, H - bottom);
        ctx.globalAlpha = 1;
        ctx.fillStyle = moving ? "#67e8f9" : "#5eead4";
        ctx.fillRect(gate.x, top - 6, GATE_W, 6);
        ctx.fillRect(gate.x, bottom, GATE_W, 6);

        // orb
        if (gate.orb && !gate.orb.taken) {
          const ox = gate.x + GATE_W / 2;
          const oy = gate.orb.y + Math.sin(s.t * 4 + gate.x * 0.02) * 6;
          ctx.beginPath();
          ctx.arc(ox, oy, ORB_R, 0, Math.PI * 2);
          ctx.fillStyle = gate.shield ? "#a78bfa" : "#fbbf24";
          ctx.shadowColor = gate.shield ? "#a78bfa" : "#fbbf24";
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // particles
      for (const p of s.parts) {
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.fillStyle = p.hue;
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      ctx.globalAlpha = 1;

      // bird
      ctx.save();
      ctx.translate(BIRD_X, s.y);
      ctx.rotate(Math.max(-0.5, Math.min(0.9, s.vy / 600)));
      if (s.shield) {
        ctx.beginPath();
        ctx.arc(0, 0, BIRD_R + 7, 0, Math.PI * 2);
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0b1220";
      ctx.beginPath();
      ctx.arc(5, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // HUD
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 28px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(s.score), W / 2, 42);
      if (s.combo > 1) {
        ctx.font = "bold 14px ui-sans-serif, system-ui";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`x${s.combo} combo`, W / 2, 62);
      }
      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = state.current;

      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 40);
      for (const p of s.parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      if (s.parts.length) s.parts = s.parts.filter((p) => p.life > 0);

      if (s.running) {
        const speed = speedFor(s.score);
        const gap = gapFor(s.score);
        s.t += dt;
        s.invuln = Math.max(0, s.invuln - dt);
        s.vy += GRAVITY * dt;
        s.y += s.vy * dt;

        for (const gate of s.gates) {
          gate.x -= speed * dt;
          if (gate.drift !== 0) {
            gate.gapY += gate.drift * dt;
            const lo = gap / 2 + 24;
            const hi = H - gap / 2 - 24;
            if (gate.gapY < lo || gate.gapY > hi) {
              gate.gapY = Math.max(lo, Math.min(hi, gate.gapY));
              gate.drift *= -1;
            }
            if (gate.orb && !gate.orb.taken) gate.orb.y = gate.gapY;
          }
        }

        // recycle
        const first = s.gates[0];
        if (first && first.x + GATE_W < -20) {
          s.gates.shift();
          const lastGate = s.gates[s.gates.length - 1];
          s.gates.push(makeGate((lastGate?.x ?? W) + spacingFor(s.score), s.score));
        }

        // score gates
        for (const gate of s.gates) {
          if (!gate.passed && gate.x + GATE_W < BIRD_X - BIRD_R) {
            gate.passed = true;
            s.score += s.combo;
            setScore(s.score);
          }
        }

        // orb pickups
        for (const gate of s.gates) {
          if (!gate.orb || gate.orb.taken) continue;
          const ox = gate.x + GATE_W / 2;
          const oy = gate.orb.y;
          if (Math.hypot(ox - BIRD_X, oy - s.y) < ORB_R + BIRD_R) {
            gate.orb.taken = true;
            if (gate.shield) {
              s.shield = true;
              setShield(true);
            } else {
              s.orbs += 1;
              setOrbs(s.orbs);
              s.combo = Math.min(5, 1 + Math.floor(s.orbs / 3));
              setCombo(s.combo);
            }
            for (let i = 0; i < 10; i += 1) {
              s.parts.push({
                x: ox,
                y: oy,
                vx: (Math.random() - 0.5) * 220,
                vy: (Math.random() - 0.5) * 220,
                life: 0.5,
                hue: gate.shield ? "#a78bfa" : "#fbbf24",
              });
            }
          }
        }

        // collisions
        let hit = s.y + BIRD_R > H || s.y - BIRD_R < 0;
        for (const gate of s.gates) {
          const withinX = BIRD_X + BIRD_R > gate.x && BIRD_X - BIRD_R < gate.x + GATE_W;
          if (withinX && (s.y - BIRD_R < gate.gapY - gap / 2 || s.y + BIRD_R > gate.gapY + gap / 2)) hit = true;
        }

        if (hit && s.invuln <= 0) {
          if (s.shield) {
            s.shield = false;
            setShield(false);
            s.invuln = 0.9;
            s.shake = 10;
            s.y = Math.max(BIRD_R + 4, Math.min(H - BIRD_R - 4, s.y));
            s.vy = FLAP * 0.7;
            s.combo = 1;
            setCombo(1);
            for (const gate of s.gates) {
              if (Math.abs(gate.x - BIRD_X) < 120) gate.x += 80;
            }
          } else {
            s.running = false;
            s.shake = 16;
            for (let i = 0; i < 24; i += 1) {
              s.parts.push({
                x: BIRD_X,
                y: s.y,
                vx: (Math.random() - 0.5) * 320,
                vy: (Math.random() - 0.5) * 320,
                life: 0.7,
                hue: "#f87171",
              });
            }
            void finish(s.score, s.orbs);
          }
        }
      }

      draw();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [finish, makeGate]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[560px] items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Crew minigame</p>
          <p className="font-display text-lg font-semibold">Skyward</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Trophy className="size-4 text-gold" /> Best {best}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Zap className="size-4 text-primary" /> {score}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-4 text-gold" /> {orbs}
            {combo > 1 && <span className="text-gold font-semibold">·x{combo}</span>}
          </span>
          {shield && (
            <span className="flex items-center gap-1 text-violet-400">
              <Shield className="size-4" /> Shield
            </span>
          )}
        </div>
      </div>

      <div
        onPointerDown={(e) => {
          e.preventDefault();
          flap();
        }}
        className="relative w-full max-w-[560px] cursor-pointer overflow-hidden rounded-2xl border border-border/50 select-none"
      >
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full touch-none" />
        {phase !== "playing" && (
          <div className="bg-background/70 absolute inset-0 grid place-items-center backdrop-blur-sm">
            <div className="px-6 text-center">
              <p className="font-display text-xl font-bold">
                {phase === "idle" ? "Fly for your crew" : `${score} point${score === 1 ? "" : "s"} · ${orbs} orbs`}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs">
                {phase === "idle"
                  ? `Tap or press Space to flap. Grab gold orbs to raise your combo, purple orbs give a shield, and it speeds up as you go — every point banks XP for you and ${crewName}.`
                  : banked
                    ? `+${banked.xp} personal XP · +${banked.crew} crew XP`
                    : "Run over."}
              </p>
              <Button className="mt-3 gap-1.5" onClick={flap}>
                <Play className="size-4" /> {phase === "idle" ? "Start" : "Run again"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className={cn("text-muted-foreground text-center text-xs", boosted && "text-gold")}>
        {boosted
          ? "Crew Lv 20+ boost active: 1.5x crew XP from gates and orbs."
          : "Each gate = 22 crew XP, each orb = 14 crew XP into the shared pool."}
      </p>
    </div>
  );
}
