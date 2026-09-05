import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Magnet, Play, Shield, Sparkles, Star, Timer, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDimted } from "@/lib/dimted-store";
import { awardArcadeXp } from "@/lib/games-queries";
import { contributeCrewXp } from "@/lib/crews";
import { cn } from "@/lib/utils";

/**
 * Skyward — the crew minigame. One button, flappy-style, but built to keep
 * pulling people back: five rotating zones with their own hazards, four
 * power-ups, a combo chain, and three randomised run missions that pay bonus
 * crew XP. Personal XP comes from the arcade RPC; the same run banks XP into
 * the crew's shared pool (server-verified membership).
 */

const W = 560;
const H = 360;
const GRAVITY = 1500; // px/s^2
const FLAP = -430; // px/s
const BASE_SPEED = 195;
const MAX_SPEED = 350;
const BASE_GAP = 150;
const MIN_GAP = 110;
const GATE_W = 54;
const BASE_SPACING = 260;
const BIRD_X = 130;
const BIRD_R = 13;
const ORB_R = 9;
const ZONE_LENGTH = 12; // gates per zone

type PowerKind = "shield" | "magnet" | "slow" | "double";
type Orb = { y: number; taken: boolean; power: PowerKind | null };
type Gate = { x: number; gapY: number; passed: boolean; drift: number; orb: Orb | null; laser: boolean };
type Rock = { x: number; y: number; r: number; vy: number; spin: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: string };

type Zone = {
  name: string;
  sky: [string, string];
  gate: string;
  cap: string;
  drifting: boolean;
  lasers: boolean;
  rocks: boolean;
  gusts: boolean;
};

const ZONES: Zone[] = [
  { name: "Dawn Reach", sky: ["#08101c", "#12213a"], gate: "#14b8a6", cap: "#5eead4", drifting: false, lasers: false, rocks: false, gusts: false },
  { name: "Drift Canyon", sky: ["#0a1524", "#123047"], gate: "#0e7490", cap: "#67e8f9", drifting: true, lasers: false, rocks: false, gusts: false },
  { name: "Laser Vault", sky: ["#140b1e", "#2a1236"], gate: "#7c3aed", cap: "#c4b5fd", drifting: true, lasers: true, rocks: false, gusts: false },
  { name: "Belt of Ash", sky: ["#1a1008", "#33200d"], gate: "#b45309", cap: "#fcd34d", drifting: false, lasers: false, rocks: true, gusts: false },
  { name: "Storm Crown", sky: ["#04121a", "#0b3040"], gate: "#0891b2", cap: "#a5f3fc", drifting: true, lasers: true, rocks: true, gusts: true },
];

const POWER_META: Record<PowerKind, { label: string; color: string; blurb: string }> = {
  shield: { label: "Shield", color: "#a78bfa", blurb: "Survive one hit" },
  magnet: { label: "Magnet", color: "#38bdf8", blurb: "Pulls orbs in" },
  slow: { label: "Slow-mo", color: "#5eead4", blurb: "Everything eases up" },
  double: { label: "Double", color: "#fbbf24", blurb: "2x points" },
};

type Mission = { id: string; label: string; goal: number; reward: number; progress: (r: RunTotals) => number };
type RunTotals = { gates: number; orbs: number; powers: number; bestCombo: number; zones: number; noHit: boolean };

const MISSION_POOL: Mission[] = [
  { id: "gates20", label: "Clear 20 gates", goal: 20, reward: 120, progress: (r) => r.gates },
  { id: "gates35", label: "Clear 35 gates", goal: 35, reward: 220, progress: (r) => r.gates },
  { id: "orbs10", label: "Collect 10 orbs", goal: 10, reward: 130, progress: (r) => r.orbs },
  { id: "orbs18", label: "Collect 18 orbs", goal: 18, reward: 200, progress: (r) => r.orbs },
  { id: "power3", label: "Grab 3 power-ups", goal: 3, reward: 140, progress: (r) => r.powers },
  { id: "combo4", label: "Reach a x4 combo", goal: 4, reward: 160, progress: (r) => r.bestCombo },
  { id: "zone3", label: "Reach zone 3", goal: 3, reward: 180, progress: (r) => r.zones },
  { id: "clean12", label: "Clear 12 gates without a scratch", goal: 12, reward: 170, progress: (r) => (r.noHit ? r.gates : 0) },
];

const BEST_KEY = "lazu.skyward.best";
const RUNS_KEY = "lazu.skyward.runs";

function zoneIndex(score: number) {
  return Math.floor(score / ZONE_LENGTH) % ZONES.length;
}
function zoneNumber(score: number) {
  return Math.floor(score / ZONE_LENGTH) + 1;
}
function speedFor(score: number) {
  return Math.min(MAX_SPEED, BASE_SPEED + score * 3.2);
}
function gapFor(score: number) {
  return Math.max(MIN_GAP, BASE_GAP - score * 1.2);
}
function spacingFor(score: number) {
  return Math.max(205, BASE_SPACING - score * 1.6);
}
function pickMissions() {
  const pool = [...MISSION_POOL];
  const out: Mission[] = [];
  while (out.length < 3 && pool.length) out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  return out;
}

export function CrewFlight({ crewId, crewName, boosted }: { crewId: string; crewName: string; boosted: boolean }) {
  const { syncXp, surgeActive } = useDimted();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");
  const [score, setScore] = useState(0);
  const [orbCount, setOrbCount] = useState(0);
  const [combo, setCombo] = useState(1);
  const [zone, setZone] = useState(0);
  const [powers, setPowers] = useState<{ shield: boolean; magnet: number; slow: number; double: number }>({
    shield: false,
    magnet: 0,
    slow: 0,
    double: 0,
  });
  const [best, setBest] = useState(0);
  const [runs, setRuns] = useState(0);
  const [missions, setMissions] = useState<Mission[]>(() => pickMissions());
  const [summary, setSummary] = useState<{
    xp: number;
    crew: number;
    done: { label: string; reward: number }[];
    totals: RunTotals;
  } | null>(null);

  const state = useRef({
    y: H / 2,
    vy: 0,
    gates: [] as Gate[],
    rocks: [] as Rock[],
    parts: [] as Particle[],
    score: 0,
    orbs: 0,
    combo: 1,
    bestCombo: 1,
    powerCount: 0,
    noHit: true,
    shield: false,
    magnet: 0,
    slow: 0,
    double: 0,
    shake: 0,
    invuln: 0,
    rockTimer: 0,
    gust: 0,
    gustTimer: 3,
    running: false,
    t: 0,
  });

  useEffect(() => {
    setBest(Number(localStorage.getItem(BEST_KEY) ?? 0) || 0);
    setRuns(Number(localStorage.getItem(RUNS_KEY) ?? 0) || 0);
  }, []);

  const finish = useCallback(
    async (totals: RunTotals) => {
      setPhase("over");
      const runPoints = totals.gates * 12 + totals.orbs * 9 + totals.powers * 10;
      const nextRuns = runs + 1;
      setRuns(nextRuns);
      localStorage.setItem(RUNS_KEY, String(nextRuns));
      if (runPoints > best) {
        setBest(runPoints);
        localStorage.setItem(BEST_KEY, String(runPoints));
      }

      const done = missions
        .filter((m) => m.progress(totals) >= m.goal)
        .map((m) => ({ label: m.label, reward: m.reward }));
      const missionXp = done.reduce((n, m) => n + m.reward, 0);
      setMissions(pickMissions());

      if (runPoints <= 0) {
        setSummary({ xp: 0, crew: 0, done, totals });
        return;
      }

      const crewGain = Math.round(
        (totals.gates * 22 + totals.orbs * 14 + totals.powers * 18 + missionXp) * (boosted ? 1.5 : 1),
      );
      try {
        const [reward, contrib] = await Promise.all([
          awardArcadeXp("crew-flight" as never, runPoints + missionXp),
          contributeCrewXp(crewId, crewGain),
        ]);
        if (reward.status === "awarded" || reward.status === "granted") {
          syncXp(reward, "Skyward run");
          const crewAdded = contrib.added ?? crewGain;
          setSummary({ xp: reward.gained ?? 0, crew: crewAdded, done, totals });
          toast.success(
            `+${reward.gained} XP · +${reward.sparks_gained} sparks · +${crewAdded} crew XP` +
              (done.length ? ` · ${done.length} mission${done.length === 1 ? "" : "s"}` : "") +
              (surgeActive ? " · surge doubled" : ""),
          );
        }
      } catch {
        toast.error("Couldn't bank that run");
      }
    },
    [best, boosted, crewId, missions, runs, surgeActive, syncXp],
  );

  const makeGate = useCallback((x: number, atScore: number): Gate => {
    const z = ZONES[zoneIndex(atScore)]!;
    const gap = gapFor(atScore);
    const gapY = gap / 2 + 24 + Math.random() * (H - gap - 48);
    const roll = Math.random();
    const power: PowerKind | null =
      roll < 0.07 ? "shield" : roll < 0.13 ? "magnet" : roll < 0.19 ? "slow" : roll < 0.25 ? "double" : null;
    return {
      x,
      gapY,
      passed: false,
      drift: z.drifting && Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 9) : 0,
      orb: power || Math.random() < 0.6 ? { y: gapY, taken: false, power } : null,
      laser: z.lasers && Math.random() < 0.4,
    };
  }, []);

  const flap = useCallback(() => {
    const s = state.current;
    if (phase === "playing") {
      s.vy = FLAP;
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
    state.current = {
      y: H / 2,
      vy: FLAP * 0.6,
      gates: [makeGate(W + 90, 0), makeGate(W + 90 + BASE_SPACING, 0), makeGate(W + 90 + BASE_SPACING * 2, 0)],
      rocks: [],
      parts: [],
      score: 0,
      orbs: 0,
      combo: 1,
      bestCombo: 1,
      powerCount: 0,
      noHit: true,
      shield: false,
      magnet: 0,
      slow: 0,
      double: 0,
      shake: 0,
      invuln: 0.5,
      rockTimer: 1.4,
      gust: 0,
      gustTimer: 3,
      running: true,
      t: 0,
    };
    setScore(0);
    setOrbCount(0);
    setCombo(1);
    setZone(0);
    setPowers({ shield: false, magnet: 0, slow: 0, double: 0 });
    setSummary(null);
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
      const z = ZONES[zoneIndex(s.score)]!;
      const speed = speedFor(s.score) * (s.slow > 0 ? 0.62 : 1);
      const gap = gapFor(s.score);

      ctx.save();
      if (s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, z.sky[0]);
      g.addColorStop(1, z.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // parallax stars
      for (let layer = 0; layer < 2; layer += 1) {
        const sp = 0.15 + layer * 0.25;
        ctx.globalAlpha = 0.35 - layer * 0.12;
        ctx.fillStyle = layer === 0 ? "#94a3b8" : z.cap;
        for (let i = 0; i < 26; i += 1) {
          const seed = i * (layer === 0 ? 71 : 113);
          const x = ((seed * 13 - s.t * speed * sp) % (W + 20) + W + 20) % (W + 20);
          const y = (seed * 29) % H;
          ctx.fillRect(x, y, 2, 2);
        }
      }
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = z.cap;
      ctx.lineWidth = 1;
      for (let x = ((-s.t * speed * 0.4) % 40 + 40) % 40; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // gusts
      if (s.gust !== 0) {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = "#a5f3fc";
        for (let i = 0; i < 8; i += 1) {
          const y = ((i * 47 + s.t * 220) % H + H) % H;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y + (s.gust > 0 ? 18 : -18));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // gates
      for (const gate of s.gates) {
        const top = gate.gapY - gap / 2;
        const bottom = gate.gapY + gap / 2;
        ctx.fillStyle = z.gate;
        ctx.globalAlpha = 0.93;
        ctx.fillRect(gate.x, 0, GATE_W, top);
        ctx.fillRect(gate.x, bottom, GATE_W, H - bottom);
        ctx.globalAlpha = 1;
        ctx.fillStyle = z.cap;
        ctx.fillRect(gate.x, top - 6, GATE_W, 6);
        ctx.fillRect(gate.x, bottom, GATE_W, 6);

        // laser sweeping the gap (blinks on/off)
        if (gate.laser) {
          const on = Math.sin(s.t * 3 + gate.x * 0.03) > -0.2;
          ctx.globalAlpha = on ? 0.85 : 0.18;
          ctx.strokeStyle = "#f472b6";
          ctx.lineWidth = on ? 4 : 2;
          ctx.beginPath();
          ctx.moveTo(gate.x + GATE_W / 2, top);
          ctx.lineTo(gate.x + GATE_W / 2, bottom);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        if (gate.orb && !gate.orb.taken) {
          const ox = gate.x + GATE_W / 2 + (gate.laser ? 26 : 0);
          const oy = gate.orb.y + Math.sin(s.t * 4 + gate.x * 0.02) * 6;
          const color = gate.orb.power ? POWER_META[gate.orb.power].color : "#fbbf24";
          ctx.beginPath();
          ctx.arc(ox, oy, gate.orb.power ? ORB_R + 2 : ORB_R, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // rocks
      for (const rock of s.rocks) {
        ctx.save();
        ctx.translate(rock.x, rock.y);
        ctx.rotate(rock.spin);
        ctx.fillStyle = "#78716c";
        ctx.beginPath();
        for (let i = 0; i < 7; i += 1) {
          const a = (i / 7) * Math.PI * 2;
          const r = rock.r * (i % 2 ? 0.78 : 1);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#fcd34d";
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.restore();
      }

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
      if (s.magnet > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, 74, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(56,189,248,0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (s.shield) {
        ctx.beginPath();
        ctx.arc(0, 0, BIRD_R + 7, 0, Math.PI * 2);
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      const bodyColor = s.double > 0 ? "#fde68a" : "#fbbf24";
      ctx.fillStyle = bodyColor;
      ctx.shadowColor = bodyColor;
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
      ctx.font = "600 12px ui-sans-serif, system-ui";
      ctx.fillStyle = z.cap;
      ctx.fillText(`Zone ${zoneNumber(s.score)} · ${z.name}`, W / 2, 60);
      if (s.combo > 1) {
        ctx.font = "bold 13px ui-sans-serif, system-ui";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`x${s.combo} combo`, W / 2, 78);
      }
      ctx.restore();
    };

    const tick = (now: number) => {
      const dtRaw = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = state.current;

      if (s.shake > 0) s.shake = Math.max(0, s.shake - dtRaw * 40);
      for (const p of s.parts) {
        p.x += p.vx * dtRaw;
        p.y += p.vy * dtRaw;
        p.life -= dtRaw;
      }
      if (s.parts.length) s.parts = s.parts.filter((p) => p.life > 0);

      if (s.running) {
        const slowed = s.slow > 0;
        const dt = dtRaw * (slowed ? 0.62 : 1);
        const z = ZONES[zoneIndex(s.score)]!;
        const speed = speedFor(s.score) * (slowed ? 0.62 : 1);
        const gap = gapFor(s.score);
        s.t += dt;
        s.invuln = Math.max(0, s.invuln - dtRaw);
        s.magnet = Math.max(0, s.magnet - dtRaw);
        s.slow = Math.max(0, s.slow - dtRaw);
        s.double = Math.max(0, s.double - dtRaw);

        // gusts (storm zone)
        if (z.gusts) {
          s.gustTimer -= dtRaw;
          if (s.gustTimer <= 0) {
            s.gust = s.gust === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
            s.gustTimer = s.gust === 0 ? 2.2 + Math.random() * 2 : 1.6 + Math.random();
          }
        } else {
          s.gust = 0;
        }

        s.vy += GRAVITY * dt + s.gust * 260 * dt;
        s.y += s.vy * dt;

        for (const gate of s.gates) {
          gate.x -= speed * dt;
          if (gate.drift !== 0) {
            gate.gapY += gate.drift * dt;
            const lo = gap / 2 + 46;
            const hi = H - gap / 2 - 46;
            if (gate.gapY < lo || gate.gapY > hi) {
              gate.gapY = Math.max(lo, Math.min(hi, gate.gapY));
              gate.drift *= -1;
            }
            if (gate.orb && !gate.orb.taken && !gate.orb.power) gate.orb.y = gate.gapY;
          }
        }

        const first = s.gates[0];
        if (first && first.x + GATE_W < -20) {
          s.gates.shift();
          const lastGate = s.gates[s.gates.length - 1];
          s.gates.push(makeGate((lastGate?.x ?? W) + spacingFor(s.score), s.score));
        }

        // asteroids
        if (z.rocks) {
          s.rockTimer -= dtRaw;
          if (s.rockTimer <= 0) {
            s.rockTimer = 1.1 + Math.random() * 1.2;
            s.rocks.push({
              x: W + 30,
              y: 40 + Math.random() * (H - 80),
              r: 11 + Math.random() * 9,
              vy: (Math.random() - 0.5) * 70,
              spin: 0,
            });
          }
        }
        for (const rock of s.rocks) {
          rock.x -= (speed + 40) * dt;
          rock.y += rock.vy * dt;
          rock.spin += dt * 2;
          if (rock.y < rock.r || rock.y > H - rock.r) rock.vy *= -1;
        }
        if (s.rocks.length) s.rocks = s.rocks.filter((r) => r.x > -40);

        // gates cleared
        for (const gate of s.gates) {
          if (!gate.passed && gate.x + GATE_W < BIRD_X - BIRD_R) {
            gate.passed = true;
            s.score += s.combo * (s.double > 0 ? 2 : 1);
            setScore(s.score);
            setZone(zoneIndex(s.score));
          }
        }

        // orbs (magnet pulls them in)
        for (const gate of s.gates) {
          if (!gate.orb || gate.orb.taken) continue;
          const ox = gate.x + GATE_W / 2 + (gate.laser ? 26 : 0);
          const oy = gate.orb.y;
          const dist = Math.hypot(ox - BIRD_X, oy - s.y);
          const reach = s.magnet > 0 ? 74 : ORB_R + BIRD_R;
          if (dist < reach) {
            gate.orb.taken = true;
            const power = gate.orb.power;
            if (power) {
              s.powerCount += 1;
              if (power === "shield") s.shield = true;
              if (power === "magnet") s.magnet = 6;
              if (power === "slow") s.slow = 4.5;
              if (power === "double") s.double = 6;
              setPowers({ shield: s.shield, magnet: s.magnet, slow: s.slow, double: s.double });
            } else {
              s.orbs += 1;
              setOrbCount(s.orbs);
              s.combo = Math.min(6, 1 + Math.floor(s.orbs / 3));
              s.bestCombo = Math.max(s.bestCombo, s.combo);
              setCombo(s.combo);
            }
            const hue = power ? POWER_META[power].color : "#fbbf24";
            for (let i = 0; i < 12; i += 1) {
              s.parts.push({
                x: ox,
                y: oy,
                vx: (Math.random() - 0.5) * 240,
                vy: (Math.random() - 0.5) * 240,
                life: 0.5,
                hue,
              });
            }
          }
        }

        // collisions
        let hit = s.y + BIRD_R > H || s.y - BIRD_R < 0;
        for (const gate of s.gates) {
          const withinX = BIRD_X + BIRD_R > gate.x && BIRD_X - BIRD_R < gate.x + GATE_W;
          if (withinX && (s.y - BIRD_R < gate.gapY - gap / 2 || s.y + BIRD_R > gate.gapY + gap / 2)) hit = true;
          if (gate.laser) {
            const on = Math.sin(s.t * 3 + gate.x * 0.03) > -0.2;
            const beamX = gate.x + GATE_W / 2;
            if (on && Math.abs(beamX - BIRD_X) < BIRD_R + 2) hit = true;
          }
        }
        for (const rock of s.rocks) {
          if (Math.hypot(rock.x - BIRD_X, rock.y - s.y) < rock.r + BIRD_R - 2) hit = true;
        }

        if (hit && s.invuln <= 0) {
          if (s.shield) {
            s.shield = false;
            s.noHit = false;
            setPowers({ shield: false, magnet: s.magnet, slow: s.slow, double: s.double });
            s.invuln = 1;
            s.shake = 10;
            s.y = Math.max(BIRD_R + 6, Math.min(H - BIRD_R - 6, s.y));
            s.vy = FLAP * 0.7;
            s.combo = 1;
            setCombo(1);
            for (const gate of s.gates) if (Math.abs(gate.x - BIRD_X) < 130) gate.x += 90;
            s.rocks = s.rocks.filter((r) => Math.abs(r.x - BIRD_X) > 130);
          } else {
            s.running = false;
            s.shake = 16;
            s.noHit = false;
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
            void finish({
              gates: s.score,
              orbs: s.orbs,
              powers: s.powerCount,
              bestCombo: s.bestCombo,
              zones: zoneNumber(s.score),
              noHit: s.noHit || s.score === 0,
            });
          }
        }
      }

      draw();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [finish, makeGate]);

  const activePowers = useMemo(
    () =>
      [
        powers.shield ? { key: "shield" as PowerKind, left: 0 } : null,
        powers.magnet > 0 ? { key: "magnet" as PowerKind, left: powers.magnet } : null,
        powers.slow > 0 ? { key: "slow" as PowerKind, left: powers.slow } : null,
        powers.double > 0 ? { key: "double" as PowerKind, left: powers.double } : null,
      ].filter(Boolean) as { key: PowerKind; left: number }[],
    [powers],
  );

  const zoneMeta = ZONES[zone] ?? ZONES[0]!;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[560px] flex-wrap items-center justify-between gap-3">
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
            <Sparkles className="size-4 text-gold" /> {orbCount}
            {combo > 1 && <span className="text-gold font-semibold">·x{combo}</span>}
          </span>
          <span className="text-muted-foreground text-xs">
            Runs {runs} · {zoneMeta.name}
          </span>
        </div>
      </div>

      {activePowers.length > 0 && (
        <div className="flex w-full max-w-[560px] flex-wrap gap-2">
          {activePowers.map((p) => (
            <span
              key={p.key}
              className="glass-surface flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ color: POWER_META[p.key].color }}
            >
              {p.key === "shield" && <Shield className="size-3.5" />}
              {p.key === "magnet" && <Magnet className="size-3.5" />}
              {p.key === "slow" && <Timer className="size-3.5" />}
              {p.key === "double" && <Star className="size-3.5" />}
              {POWER_META[p.key].label}
              {p.left > 0 && <span className="opacity-70">{p.left.toFixed(1)}s</span>}
            </span>
          ))}
        </div>
      )}

      <div
        onPointerDown={(e) => {
          e.preventDefault();
          flap();
        }}
        className="relative w-full max-w-[560px] cursor-pointer overflow-hidden rounded-2xl border border-border/50 select-none"
      >
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full touch-none" />
        {phase !== "playing" && (
          <div className="bg-background/75 absolute inset-0 grid place-items-center backdrop-blur-sm">
            <div className="max-h-full w-full overflow-y-auto px-6 py-4 text-center">
              <p className="font-display text-xl font-bold">
                {phase === "idle" ? "Fly for your crew" : `${score} points · ${orbCount} orbs`}
              </p>
              {phase === "idle" ? (
                <p className="text-muted-foreground mx-auto mt-1 max-w-[400px] text-xs">
                  Tap or press Space to flap. Five zones rotate every {ZONE_LENGTH} gates — drifting gates, lasers,
                  asteroids and storm gusts. Gold orbs build your combo; coloured orbs are power-ups. Every point banks
                  XP for you and {crewName}.
                </p>
              ) : (
                <p className="text-muted-foreground mt-1 text-xs">
                  {summary
                    ? `+${summary.xp} personal XP · +${summary.crew} crew XP`
                    : "Banking your run…"}
                </p>
              )}

              {phase === "over" && summary && summary.done.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  {summary.done.map((m) => (
                    <p key={m.label} className="text-gold">
                      ✓ {m.label} · +{m.reward} bonus
                    </p>
                  ))}
                </div>
              )}

              <div className="mx-auto mt-3 max-w-[400px] text-left">
                <p className="eyebrow mb-1 text-center">Run missions</p>
                <div className="grid gap-1">
                  {missions.map((m) => (
                    <div
                      key={m.id}
                      className="glass-surface flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <span>{m.label}</span>
                      <span className="text-gold font-semibold">+{m.reward}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="mt-3 gap-1.5" onClick={flap}>
                <Play className="size-4" /> {phase === "idle" ? "Start" : "Run again"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className={cn("text-muted-foreground max-w-[560px] text-center text-xs", boosted && "text-gold")}>
        {boosted
          ? "Crew Lv 20+ boost active: 1.5x crew XP from gates, orbs, power-ups and missions."
          : "Gates 22 · orbs 14 · power-ups 18 crew XP each, plus mission bonuses into the shared pool."}
      </p>
    </div>
  );
}
