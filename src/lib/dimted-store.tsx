import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { contextFromPath } from "./presence";
import {
  levelFromTotalXp,
  rankForLevel,
  unlockAt,
  type Unlock,
  type XpSourceId,
} from "./dimted";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  title: string;
  total_xp: number;
  energy: number;
  surge_until: string | null;
  streak: number;
  realm_name: string;
  last_active_at: string;
  created_at: string;
  sparks: number;
  equipped_nametag: string | null;
  equipped_badge: string | null;
  equipped_frame: string | null;
  equipped_banner: string | null;
  equipped_effect: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  activity_context?: string | null;
  banned_until?: string | null;
  ban_reason?: string | null;
  muted_until?: string | null;
  mute_reason?: string | null;
};


export type LevelUpPayload = {
  level: number;
  rank: string;
  gained: number;
  unlock?: Unlock | undefined;
};

export type AwardResult = "granted" | "cooldown" | "capped" | "error";

type Ctx = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  totalXp: number;
  level: number;
  rank: string;
  intoLevel: number;
  needed: number;
  progress: number;
  energy: number;
  sparks: number;
  surgeActive: boolean;
  surgeSecondsLeft: number;
  levelUp: LevelUpPayload | null;
  lastGain: { amount: number; label: string; at: number } | null;
  award: (source: XpSourceId, label?: string) => Promise<AwardResult>;
  igniteSurge: () => Promise<void>;
  dismissLevelUp: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

/**
 * Kept on globalThis so hot-module reloads reuse the same context object.
 * Without this, editing this file mid-session leaves the provider and the
 * consumers holding two different contexts ("must be used inside
 * <DimtedProvider>") until a hard refresh.
 */
const g = globalThis as unknown as { __dimtedContext?: React.Context<Ctx | null> };
const DimtedContext = (g.__dimtedContext ??= createContext<Ctx | null>(null));

export function DimtedProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelUp, setLevelUp] = useState<LevelUpPayload | null>(null);
  const [lastGain, setLastGain] = useState<Ctx["lastGain"]>(null);
  const [now, setNow] = useState(0);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session ?? null);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
      setNow(Date.now());
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Fetch the profile whenever a session appears (including right after sign-up).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setProfile(data as Profile);
          break;
        }
        // The profile row is created by the backend on signup; give it a moment.
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Presence heartbeat. Status is never chosen by hand — it's whatever the
  // server last heard from you, plus which screen you were on.
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    const ping = () => {
      if (stopped || document.visibilityState === "hidden") return;
      void supabase.rpc("touch_presence", {
        _context: contextFromPath(window.location.pathname),
      });
    };
    ping();
    const t = window.setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      stopped = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [session]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const totalXp = profile?.total_xp ?? 0;
  const derived = useMemo(() => levelFromTotalXp(totalXp), [totalXp]);
  const surgeUntil = profile?.surge_until ? Date.parse(profile.surge_until) : 0;
  const surgeActive = surgeUntil > now && now > 0;

  const award = useCallback<Ctx["award"]>(
    async (source, label) => {
      if (!profile) return "error";
      const before = levelFromTotalXp(profile.total_xp).level;
      const { data, error } = await supabase.rpc(
        "award_xp",
        label ? { _source: source, _label: label } : { _source: source },
      );
      if (error) return "error";

      const result = (data ?? {}) as {
        status?: string;
        gained?: number;
        total_xp?: number;
        energy?: number;
        sparks?: number;
        sparks_gained?: number;
        surge_until?: string | null;
      };

      if (result.status === "granted") {
        const nextXp = result.total_xp ?? profile.total_xp;
        setProfile((p) =>
          p
            ? {
                ...p,
                total_xp: nextXp,
                sparks: result.sparks ?? p.sparks,
                energy: result.energy ?? p.energy,
                surge_until: result.surge_until ?? p.surge_until,
              }
            : p,
        );
        setLastGain({ amount: result.gained ?? 0, label: label ?? source, at: Date.now() });
        const after = levelFromTotalXp(nextXp).level;
        if (after > before) {
          setLevelUp({
            level: after,
            rank: rankForLevel(after),
            gained: result.gained ?? 0,
            unlock: unlockAt(after),
          });
        }
        return "granted";
      }
      if (result.status === "capped") return "capped";
      if (result.status === "cooldown") return "cooldown";
      return "error";
    },
    [profile],
  );

  const igniteSurge = useCallback(async () => {
    const { data } = await supabase.rpc("ignite_surge");
    const result = (data ?? {}) as { status?: string; energy?: number; surge_until?: string };
    if (result.status === "ignited") {
      setProfile((p) =>
        p ? { ...p, energy: result.energy ?? 0, surge_until: result.surge_until ?? null } : p,
      );
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value: Ctx = {
    loading,
    session,
    profile,
    totalXp,
    level: derived.level,
    rank: rankForLevel(derived.level),
    intoLevel: derived.intoLevel,
    needed: derived.needed,
    progress: Math.min(1, derived.intoLevel / derived.needed),
    energy: profile?.energy ?? 0,
    sparks: profile?.sparks ?? 0,
    surgeActive,
    surgeSecondsLeft: surgeActive ? Math.max(0, Math.round((surgeUntil - now) / 1000)) : 0,
    levelUp,
    lastGain,
    award,
    igniteSurge,
    dismissLevelUp: () => setLevelUp(null),
    refreshProfile,
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
    },
  };

  return <DimtedContext.Provider value={value}>{children}</DimtedContext.Provider>;
}

export function useDimted(): Ctx {
  const ctx = useContext(DimtedContext);
  if (!ctx) throw new Error("useDimted must be used inside <DimtedProvider>");
  return ctx;
}
