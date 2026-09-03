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
    }) => {
      const { data, error } = await supabase.rpc("pulse_finish", {
        _level: args.level,
        _pct: Math.round(args.pct),
        _time_ms: Math.round(args.ms),
        _coins: args.coinMask,
        _practice: args.practice,
      });
      if (error) throw error;
      return data as unknown as PulseFinishResult;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pulse-state", userId] });
      void qc.invalidateQueries({ queryKey: ["pulse-progress", userId] });
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
            "id, username, display_name, avatar_url, equipped_nametag, equipped_badge, equipped_frame, equipped_effect",
          )
          .in("id", rows.map((r) => r.user_id));
        const byId = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const r of rows) r.profile = (byId.get(r.user_id) as PulseRankRow["profile"]) ?? null;
      }
      return rows.filter((r) => r.profile);
    },
  });
}
