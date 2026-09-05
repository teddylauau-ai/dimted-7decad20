import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemKind } from "./pulse";

const GAME = "pulse-rush";

export type PulseState = {
  user_id: string;
  coins: number;
  equipped_icon: string;
  equipped_ship: string;
  equipped_ball: string;
  equipped_wave: string;
  equipped_trail: string;
  equipped_death: string;
  equipped_colors: string;
};

export type PulseItem = {
  slug: string;
  kind: ItemKind;
  name: string;
  description: string;
  price_coins: number;
  required_level: number;
  rarity: string;
  feat: string | null;
};

export type PulseProgressRow = {
  level: number;
  stars: number;
  best_ms: number | null;
  best_pct: number;
  coins: number;
  attempts: number;
};

/** Coin balance + equipped loadout. The RPC creates the row on first call. */
export function usePulseState(userId: string | undefined) {
  return useQuery({
    queryKey: ["pulse-state", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PulseState | null> => {
      const { data, error } = await supabase.rpc("pulse_state_for_me");
      if (error) throw error;
      return (data ?? null) as unknown as PulseState | null;
    },
  });
}

export function usePulseItems() {
  return useQuery({
    queryKey: ["pulse-items"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<PulseItem[]> => {
      const { data, error } = await supabase
        .from("pulse_items")
        .select("slug, kind, name, description, price_coins, required_level, rarity, feat")
        .order("price_coins", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PulseItem[];
    },
  });
}

export function usePulseUnlocks(userId: string | undefined) {
  return useQuery({
    queryKey: ["pulse-unlocks", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("game_unlocks")
        .select("slug")
        .eq("user_id", userId!)
        .eq("game", GAME);
      if (error) throw error;
      return (data ?? []).map((r) => r.slug as string);
    },
  });
}

export function usePulseProgress(userId: string | undefined) {
  return useQuery({
    queryKey: ["pulse-progress", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PulseProgressRow[]> => {
      const { data, error } = await supabase
        .from("game_progress")
        .select("level, stars, best_ms, best_pct, coins, attempts")
        .eq("user_id", userId!)
        .eq("game", GAME)
        .order("level", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PulseProgressRow[];
    },
  });
}

export type PulseFinishResult = {
  status: "ok" | "practice" | "no_profile" | "forbidden";
  coins?: number;
  gained?: number;
  new_coins?: number;
  daily_bonus?: number;
};

export function usePulseFinish(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      level: number;
      pct: number;
      ms: number;
      coinMask: number;
      practice: boolean;
      daily?: boolean;
    }) => {
      const { data, error } = await supabase.rpc("pulse_finish", {
        _level: args.level,
        _pct: Math.round(args.pct),
        _time_ms: Math.round(args.ms),
        _coins: args.coinMask,
        _practice: args.practice,
        _daily: !!args.daily,
      });
      if (error) throw error;
      return data as unknown as PulseFinishResult;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pulse-state", userId] });
      void qc.invalidateQueries({ queryKey: ["pulse-progress", userId] });
      void qc.invalidateQueries({ queryKey: ["pulse-leaderboard"] });
      void qc.invalidateQueries({ queryKey: ["pulse-daily", userId] });
    },
  });
}

/** True once today's daily-challenge bonus has been claimed. */
export function usePulseDailyClaim(userId: string | undefined) {
  return useQuery({
    queryKey: ["pulse-daily", userId],
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("game_scores")
        .select("id")
        .eq("user_id", userId!)
        .eq("game", "pulse-daily")
        .gte("created_at", today.toISOString())
        .limit(1);
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });
}

export type PulseUnlockResult = {
  status:
    | "unlocked"
    | "owned"
    | "insufficient"
    | "unknown_item"
    | "locked"
    | "feat_locked"
    | "no_profile";
  coins?: number;
  price?: number;
  required_level?: number;
  need?: number;
  have?: number;
};

export function usePulseUnlock(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data, error } = await supabase.rpc("pulse_unlock", { _slug: slug });
      if (error) throw error;
      return data as unknown as PulseUnlockResult;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pulse-state", userId] });
      void qc.invalidateQueries({ queryKey: ["pulse-unlocks", userId] });
    },
  });
}

export function usePulseEquip(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { slot: ItemKind; slug: string }) => {
      const { error } = await supabase.rpc("pulse_equip", {
        _slot: args.slot,
        _slug: args.slug,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["pulse-state", userId] }),
  });
}

export function clearedLevels(rows: PulseProgressRow[] | undefined): number[] {
  return (rows ?? []).filter((r) => r.best_pct >= 100).map((r) => r.level);
}

export function rowFor(
  rows: PulseProgressRow[] | undefined,
  level: number,
): PulseProgressRow | undefined {
  return (rows ?? []).find((r) => r.level === level);
}

export function totalCoins(rows: PulseProgressRow[] | undefined): number {
  return (rows ?? []).reduce((s, r) => {
    const m = r.coins ?? 0;
    return s + (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
  }, 0);
}

export type PulseRankRow = {
  user_id: string;
  clears: number;
  coins: number;
  attempts: number;
  best_ms: number | null;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    equipped_nametag: string | null;
    equipped_badge: string | null;
    equipped_frame: string | null;
    equipped_effect: string | null;
  } | null;
};

/** Global Pulse Rush ranking: levels cleared, then secret coins, then total time. */
export function usePulseLeaderboard() {
  return useQuery({
    queryKey: ["pulse-leaderboard"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PulseRankRow[]> => {
      const { data, error } = await supabase
        .from("game_progress")
        .select("user_id, level, best_pct, coins, attempts, best_ms")
        .eq("game", GAME)
        .limit(5000);
      if (error) throw error;

      const agg = new Map<string, PulseRankRow>();
      for (const r of data ?? []) {
        const row =
          agg.get(r.user_id) ??
          ({ user_id: r.user_id, clears: 0, coins: 0, attempts: 0, best_ms: 0, profile: null } as PulseRankRow);
        if ((r.best_pct ?? 0) >= 100) {
          row.clears += 1;
          row.best_ms = (row.best_ms ?? 0) + (r.best_ms ?? 0);
        }
        const m = r.coins ?? 0;
        row.coins += (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
        row.attempts += r.attempts ?? 0;
        agg.set(r.user_id, row);
      }

      const rows = [...agg.values()]
        .sort(
          (a, b) =>
            b.clears - a.clears ||
            b.coins - a.coins ||
            (a.best_ms ?? Infinity) - (b.best_ms ?? Infinity),
        )
        .slice(0, 25);

      if (rows.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select(
            "id, username, display_name, last_active_at, activity_context, avatar_url, equipped_nametag, equipped_badge, equipped_frame, equipped_effect",
          )
          .in("id", rows.map((r) => r.user_id));
        const byId = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const r of rows) r.profile = (byId.get(r.user_id) as PulseRankRow["profile"]) ?? null;
      }
      return rows.filter((r) => r.profile);
    },
  });
}

/* ------------------------------------------------------------------ endless */

/** Record an Infinite Run distance (units). Also feeds the arcade XP backend. */
export async function recordEndlessRun(userId: string, units: number) {
  const score = Math.max(1, Math.round(units));
  const { error } = await supabase.from("game_scores").insert({
    user_id: userId,
    game: "pulse-endless",
    score,
    detail: { units: score },
  });
  if (error) throw error;
  return score;
}

/** Your personal best Infinite Run distance. */
export function usePulseEndlessBest(userId: string | undefined) {
  return useQuery({
    queryKey: ["pulse-endless-best", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("game_scores")
        .select("score")
        .eq("user_id", userId!)
        .eq("game", "pulse-endless")
        .order("score", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.score ?? 0;
    },
  });
}

export type DailyRow = {
  user_id: string;
  score: number;
  profile: PulseRankRow["profile"];
};

/** Today's daily-challenge leaderboard — best score per player, today only. */
export function usePulseDailyLeaderboard() {
  return useQuery({
    queryKey: ["pulse-daily-board"],
    refetchInterval: 60 * 1000,
    queryFn: async (): Promise<DailyRow[]> => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("game_scores")
        .select("user_id, score")
        .eq("game", "pulse-daily")
        .gte("created_at", today.toISOString())
        .limit(2000);
      if (error) throw error;
      const best = new Map<string, number>();
      for (const r of data ?? []) {
        best.set(r.user_id, Math.max(best.get(r.user_id) ?? 0, r.score));
      }
      const rows = [...best.entries()]
        .map(([user_id, score]) => ({ user_id, score, profile: null as DailyRow["profile"] }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      if (rows.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select(
            "id, username, display_name, last_active_at, activity_context, avatar_url, equipped_nametag, equipped_badge, equipped_frame, equipped_effect",
          )
          .in("id", rows.map((r) => r.user_id));
        const byId = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const r of rows) r.profile = (byId.get(r.user_id) as DailyRow["profile"]) ?? null;
      }
      return rows.filter((r) => r.profile);
    },
  });
}

/** Consecutive-day daily-challenge streak (today or yesterday counts as current). */
export function usePulseDailyStreak(userId: string | undefined) {
  return useQuery({
    queryKey: ["pulse-daily-streak", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const since = new Date(Date.now() - 400 * 24 * 3600 * 1000);
      const { data, error } = await supabase
        .from("game_scores")
        .select("created_at")
        .eq("user_id", userId!)
        .eq("game", "pulse-daily")
        .gte("created_at", since.toISOString())
        .limit(500);
      if (error) throw error;
      const days = new Set((data ?? []).map((r) => r.created_at.slice(0, 10)));
      const cursor = new Date();
      cursor.setUTCHours(0, 0, 0, 0);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      // Today may not be played yet — start from yesterday if so.
      if (!days.has(iso(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
      let streak = 0;
      while (days.has(iso(cursor))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      return streak;
    },
  });
}
