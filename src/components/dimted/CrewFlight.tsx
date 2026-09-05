import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDimted } from "@/lib/dimted-store";
import { awardArcadeXp } from "@/lib/games-queries";
import { contributeCrewXp } from "@/lib/crews";
import { cn } from "@/lib/utils";

/**
 * Skyward — the crew minigame. One button, flappy-style: tap to flap, thread
 * the gates. Personal XP comes from the arcade RPC; the same run also banks XP
 * into the crew's shared pool (server-verified membership).
 */

const W = 560;
const H = 360;
const GRAVITY = 1500; // px/s^2
const FLAP = -430; // px/s
const SPEED = 190; // px/s
const GAP = 132;
const GATE_W = 54;
const SPACING = 250;
const BIRD_X = 130;
const BIRD_R = 13;

type Gate = { x: number; gapY: number; passed: boolean };

const BEST_KEY = "lazu.skyward.best";

export function CrewFlight({ crewId, crewName, boosted }: { crewId: string; crewName: string; boosted: boolean }) {
  const { syncXp, surgeActive } = useDimted();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [banked, setBanked] = useState<{ xp: number; crew: number } | null>(null);

  const state = useRef({
    y: H / 2,
    vy: 0,
    gates: [] as Gate[],
    score: 0,
    running: false,
    t: 0,
  });

  useEffect(() => {
    const raw = localStorage.getItem(BEST_KEY);
    if (raw) setBest(Number(raw) || 0);
  }, []);

  const finish = useCallback(
    async (finalScore: number) => {
      setPhase("over");
      setScore(finalScore);
      if (finalScore > best) {
        setBest(finalScore);
        localStorage.setItem(BEST_KEY, String(finalScore));
      }
      if (finalScore <= 0) return;

      const crewGain = Math.round(finalScore * 22 * (boosted ? 1.5 : 1));
      try {
        const [reward, contrib] = await Promise.all([
          awardArcadeXp("crew-flight" as never, finalScore * 12),
          contributeCrewXp(crewId, crewGain),
        ]);
        if (reward.status === "awarded" || reward.status === "granted") {
          syncXp(reward, "Skyward run");
          setBanked({ xp: reward.gained ?? 0, crew: contrib.added ?? 0 });
          toast.success(
            `+${reward.gained} XP · +${reward.sparks_gained} sparks · +${contrib.added ?? 0} crew XP` +
              (surgeActive ? " · surge doubled" : ""),
          );
        }
      } catch {
        toast.error("Couldn't bank that run");
      }
    },
    [best, boosted, crewId, surgeActive, syncXp],
  );

  const flap = useCallback(() => {
    if (phase === "playing") {
      state.current.vy = FLAP;
      return;
    }
    // start / restart
    state.current = {
      y: H / 2,
      vy: FLAP * 0.6,
      gates: [
        { x: W + 60, gapY: H / 2, passed: false },
        { x: W + 60 + SPACING, gapY: H / 2 - 40, passed: false },
        { x: W + 60 + SPACING * 2, gapY: H / 2 + 40, passed: false },
      ],
      score: 0,
      running: true,
      t: 0,
    };
    setScore(0);
    setBanked(null);
    setPhase("playing");
  }, [phase]);

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

      // background
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0b1220");
      g.addColorStop(1, "#101a2e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "#2dd4bf";
      ctx.lineWidth = 1;
      for (let x = ((-s.t * SPEED * 0.4) % 40 + 40) % 40; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // gates
      for (const gate of s.gates) {
        const top = gate.gapY - GAP / 2;
        const bottom = gate.gapY + GAP / 2;
        ctx.fillStyle = "#14b8a6";
        ctx.globalAlpha = 0.9;
        ctx.fillRect(gate.x, 0, GATE_W, top);
        ctx.fillRect(gate.x, bottom, GATE_W, H - bottom);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#5eead4";
        ctx.fillRect(gate.x, top - 6, GATE_W, 6);
        ctx.fillRect(gate.x, bottom, GATE_W, 6);
      }

      // bird
      ctx.save();
      ctx.translate(BIRD_X, s.y);
      ctx.rotate(Math.max(-0.5, Math.min(0.9, s.vy / 600)));
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b1220";
      ctx.beginPath();
      ctx.arc(5, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // score
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 28px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(s.score), W / 2, 42);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = state.current;

      if (s.running) {
        s.t += dt;
        s.vy += GRAVITY * dt;
        s.y += s.vy * dt;

        for (const gate of s.gates) gate.x -= SPEED * dt;

        // recycle + score
        const first = s.gates[0];
        if (first && first.x + GATE_W < -20) {
          s.gates.shift();
          const lastGate = s.gates[s.gates.length - 1];
          const gapY = 70 + Math.random() * (H - 140);
          s.gates.push({ x: (lastGate?.x ?? W) + SPACING, gapY, passed: false });
        }
        for (const gate of s.gates) {
          if (!gate.passed && gate.x + GATE_W < BIRD_X - BIRD_R) {
            gate.passed = true;
            s.score += 1;
            setScore(s.score);
          }
        }

        // collisions
        let dead = s.y + BIRD_R > H || s.y - BIRD_R < 0;
        for (const gate of s.gates) {
          const withinX = BIRD_X + BIRD_R > gate.x && BIRD_X - BIRD_R < gate.x + GATE_W;
          if (withinX && (s.y - BIRD_R < gate.gapY - GAP / 2 || s.y + BIRD_R > gate.gapY + GAP / 2)) dead = true;
        }
        if (dead) {
          s.running = false;
          void finish(s.score);
        }
      }

      draw();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [finish]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[560px] items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Crew minigame</p>
          <p className="font-display text-lg font-semibold">Skyward</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Trophy className="size-4 text-gold" /> Best {best}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Zap className="size-4 text-primary" /> Gates {score}
          </span>
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
                {phase === "idle" ? "Fly for your crew" : `${score} gate${score === 1 ? "" : "s"}`}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {phase === "idle"
                  ? "Tap or press Space to flap. Every gate banks XP for you and for " + crewName + "."
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
        {boosted ? "Crew Lv 20+ boost active: 1.5x crew XP per gate." : "Every gate = 22 crew XP into the shared pool."}
      </p>
    </div>
  );
}
