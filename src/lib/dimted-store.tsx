import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { levelFromTotalXp, rankForLevel, unlockAt, xpForLevel, type Unlock } from "./dimted";

const STORAGE_KEY = "dimted.progress.v1";

/** Cooldown windows keep XP tied to real activity rather than volume. */
const COOLDOWN_MS: Record<string, number> = {
  message: 60_000,
  conversation: 20_000,
  community: 30_000,
  friend: 30_000,
  activity: 15_000,
  challenge: 0,
  discovery: 0,
};

export type LevelUpPayload = {
  level: number;
  rank: string;
  gained: number;
  unlock?: Unlock;
};

type Persisted = { totalXp: number; energy: number; surgeUntil: number };

type Ctx = {
  totalXp: number;
  level: number;
  rank: string;
  intoLevel: number;
  needed: number;
  progress: number;
  energy: number;
  surgeActive: boolean;
  surgeSecondsLeft: number;
  levelUp: LevelUpPayload | null;
  hydrated: boolean;
  award: (sourceId: string, amount: number, label?: string) => "granted" | "cooldown";
  igniteSurge: () => void;
  dismissLevelUp: () => void;
  lastGain: { amount: number; label: string; at: number } | null;
};

const DimtedContext = createContext<Ctx | null>(null);

const START_XP = (() => {
  // Seeded so the demo profile opens at Level 17 · 2,430 / 3,000-ish.
  let total = 0;
  for (let l = 1; l < 17; l++) total += xpForLevel(l);
  return total + Math.round(xpForLevel(17) * 0.81);
})();

export function DimtedProvider({ children }: { children: ReactNode }) {
  const [totalXp, setTotalXp] = useState(START_XP);
  const [energy, setEnergy] = useState(68);
  const [surgeUntil, setSurgeUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [levelUp, setLevelUp] = useState<LevelUpPayload | null>(null);
  const [lastGain, setLastGain] = useState<Ctx["lastGain"]>(null);
  const [hydrated, setHydrated] = useState(false);
  const cooldowns = useRef<Record<string, number>>({});

  // Read persisted progress after hydration only, to avoid SSR mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Persisted>;
        if (typeof p.totalXp === "number") setTotalXp(p.totalXp);
        if (typeof p.energy === "number") setEnergy(p.energy);
        if (typeof p.surgeUntil === "number") setSurgeUntil(p.surgeUntil);
      }
    } catch {
      /* first visit, or storage unavailable */
    }
    setHydrated(true);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ totalXp, energy, surgeUntil }));
    } catch {
      /* ignore */
    }
  }, [hydrated, totalXp, energy, surgeUntil]);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [hydrated]);

  const derived = useMemo(() => levelFromTotalXp(totalXp), [totalXp]);
  const surgeActive = hydrated && surgeUntil > now;

  const award = useCallback<Ctx["award"]>(
    (sourceId, amount, label) => {
      const gate = COOLDOWN_MS[sourceId] ?? 0;
      const last = cooldowns.current[sourceId] ?? 0;
      const stamp = Date.now();
      if (gate > 0 && stamp - last < gate) return "cooldown";
      cooldowns.current[sourceId] = stamp;

      const multiplier = surgeUntil > stamp ? 2 : 1;
      const gained = amount * multiplier;

      setTotalXp((prev) => {
        const before = levelFromTotalXp(prev).level;
        const next = prev + gained;
        const after = levelFromTotalXp(next).level;
        if (after > before) {
          setLevelUp({
            level: after,
            rank: rankForLevel(after),
            gained,
            unlock: unlockAt(after),
          });
        }
        return next;
      });
      setEnergy((e) => Math.min(100, e + Math.max(1, Math.round(gained / 25))));
      setLastGain({ amount: gained, label: label ?? sourceId, at: stamp });
      return "granted";
    },
    [surgeUntil],
  );

  const igniteSurge = useCallback(() => {
    setEnergy((e) => {
      if (e < 100) return e;
      setSurgeUntil(Date.now() + 30 * 60 * 1000);
      return 10;
    });
  }, []);

  const value: Ctx = {
    totalXp,
    level: derived.level,
    rank: rankForLevel(derived.level),
    intoLevel: derived.intoLevel,
    needed: derived.needed,
    progress: Math.min(1, derived.intoLevel / derived.needed),
    energy,
    surgeActive,
    surgeSecondsLeft: surgeActive ? Math.max(0, Math.round((surgeUntil - now) / 1000)) : 0,
    levelUp,
    hydrated,
    award,
    igniteSurge,
    dismissLevelUp: () => setLevelUp(null),
    lastGain,
  };

  return <DimtedContext.Provider value={value}>{children}</DimtedContext.Provider>;
}

export function useDimted(): Ctx {
  const ctx = useContext(DimtedContext);
  if (!ctx) throw new Error("useDimted must be used inside <DimtedProvider>");
  return ctx;
}
