import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const GAME = "nova-vanguard";

export type VanguardState = {
  user_id: string;
  cores: number;
  equipped_weapon: string | null;
  equipped_gear: string | null;
};

export type VanguardProgressRow = { level: number; stars: number; best_ms: number | null };

/** Cores balance + loadout. The RPC creates the row on first call. */
export function useVanguardState(userId: string | undefined) {
  return useQuery({
    queryKey: ["vanguard-state", userId],
    enabled: !!userId,
    queryFn: async (): Promise<VanguardState | null> => {
      const { data, error } = await supabase.rpc("vanguard_state_for_me");
      if (error) throw error;
      return (data ?? null) as unknown as VanguardState | null;
    },
  });
}

export function useVanguardUnlocks(userId: string | undefined) {
  return useQuery({
    queryKey: ["vanguard-unlocks", userId],
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

export function useVanguardProgress(userId: string | undefined) {
  return useQuery({
    queryKey: ["vanguard-progress", userId],
    enabled: !!userId,
    queryFn: async (): Promise<VanguardProgressRow[]> => {
      const { data, error } = await supabase
        .from("game_progress")
        .select("level, stars, best_ms")
        .eq("user_id", userId!)
        .eq("game", GAME)
        .order("level", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VanguardProgressRow[];
    },
  });
}

export type FinishResult = {
  status: "ok" | "no_profile" | "forbidden";
  cores?: number;
  gained_cores?: number;
};

export function useFinishLevel(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { level: number; ms: number; stars: number; cores: number }) => {
      const { data, error } = await supabase.rpc("vanguard_finish", {
        _level: args.level,
        _time_ms: Math.round(args.ms),
        _stars: args.stars,
        _cores: args.cores,
      });
      if (error) throw error;
      return data as unknown as FinishResult;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vanguard-state", userId] });
      void qc.invalidateQueries({ queryKey: ["vanguard-progress", userId] });
    },
  });
}

export type UnlockResult = {
  status: "unlocked" | "owned" | "insufficient" | "unknown_item" | "locked" | "no_profile";
  cores?: number;
};

export function useUnlockItem(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data, error } = await supabase.rpc("vanguard_unlock", { _slug: slug });
      if (error) throw error;
      return data as unknown as UnlockResult;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vanguard-state", userId] });
      void qc.invalidateQueries({ queryKey: ["vanguard-unlocks", userId] });
    },
  });
}

export function useEquipLoadout(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { weapon: string | null; gear: string | null }) => {
      const { error } = await supabase.rpc("vanguard_equip", {
        _weapon: args.weapon as unknown as string,
        _gear: args.gear as unknown as string,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["vanguard-state", userId] }),
  });
}

export function highestVanguardCleared(rows: VanguardProgressRow[] | undefined): number {
  return (rows ?? []).reduce((m, r) => Math.max(m, r.level), 0);
}

export function vanguardStars(rows: VanguardProgressRow[] | undefined): number {
  return (rows ?? []).reduce((s, r) => s + (r.stars ?? 0), 0);
}

export function starsForLevel(rows: VanguardProgressRow[] | undefined, level: number): number {
  return (rows ?? []).find((r) => r.level === level)?.stars ?? 0;
}

export function bestMsForLevel(
  rows: VanguardProgressRow[] | undefined,
  level: number,
): number | null {
  return (rows ?? []).find((r) => r.level === level)?.best_ms ?? null;
}
