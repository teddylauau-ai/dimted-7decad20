import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProgressRow = { level: number; stars: number; best_ms: number | null };

const GAME = "nova-rift";

/** Every level you've cleared in the campaign, with stars and best time. */
export function useCampaignProgress(userId: string | undefined) {
  return useQuery({
    queryKey: ["campaign-progress", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProgressRow[]> => {
      const { data, error } = await supabase
        .from("game_progress")
        .select("level, stars, best_ms")
        .eq("user_id", userId!)
        .eq("game", GAME)
        .order("level", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProgressRow[];
    },
  });
}

export function useSaveClear(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ level, stars, ms }: { level: number; stars: number; ms: number }) => {
      if (!userId) throw new Error("Sign in to save progress");
      const { data: existing } = await supabase
        .from("game_progress")
        .select("id, stars, best_ms")
        .eq("user_id", userId)
        .eq("game", GAME)
        .eq("level", level)
        .maybeSingle();

      if (existing) {
        const bestMs = Math.min(existing.best_ms ?? ms, ms);
        const bestStars = Math.max(existing.stars ?? 0, stars);
        const { error } = await supabase
          .from("game_progress")
          .update({ stars: bestStars, best_ms: bestMs })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("game_progress")
          .insert({ user_id: userId, game: GAME, level, stars, best_ms: ms });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaign-progress", userId] });
      void qc.invalidateQueries({ queryKey: ["rift-state", userId] });
      void qc.invalidateQueries({ queryKey: ["rift-leaderboard"] });
    },

  });
}

export function highestCleared(rows: ProgressRow[] | undefined): number {
  return (rows ?? []).reduce((m, r) => Math.max(m, r.level), 0);
}

export function totalStars(rows: ProgressRow[] | undefined): number {
  return (rows ?? []).reduce((sum, r) => sum + (r.stars ?? 0), 0);
}

export function starsAt(rows: ProgressRow[] | undefined, level: number): number {
  return (rows ?? []).find((r) => r.level === level)?.stars ?? 0;
}

export function bestMsAt(rows: ProgressRow[] | undefined, level: number): number | null {
  return (rows ?? []).find((r) => r.level === level)?.best_ms ?? null;
}

/* ---------------------------------------------------------- leaderboard */

export type RiftBoardRow = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  equippedNametag: string | null;
  equippedBadge: string | null;
  equippedFrame: string | null;
  equippedEffect: string | null;
  stars: number;
  cleared: number;
  totalMs: number;
};

/**
 * Nova Rift ladder: most stars first, then furthest level, then fastest total
 * time across every level they've cleared.
 */
export function useRiftLeaderboard(limit = 25) {
  return useQuery({
    queryKey: ["rift-leaderboard", limit],
    staleTime: 5_000,
    refetchOnMount: "always",
    queryFn: async (): Promise<RiftBoardRow[]> => {
      const { data, error } = await supabase
        .from("game_progress")
        .select("user_id, level, stars, best_ms")
        .eq("game", GAME)
        .limit(4000);
      if (error) throw error;

      const agg = new Map<string, { stars: number; cleared: number; totalMs: number }>();
      for (const row of (data ?? []) as (ProgressRow & { user_id: string })[]) {
        const cur = agg.get(row.user_id) ?? { stars: 0, cleared: 0, totalMs: 0 };
        cur.stars += row.stars ?? 0;
        cur.cleared = Math.max(cur.cleared, row.level ?? 0);
        cur.totalMs += row.best_ms ?? 0;
        agg.set(row.user_id, cur);
      }
      if (!agg.size) return [];

      const { data: people, error: pErr } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, equipped_nametag, equipped_badge, equipped_frame, equipped_effect",
        )
        .in("id", [...agg.keys()]);
      if (pErr) throw pErr;

      const rows: RiftBoardRow[] = [];
      for (const p of people ?? []) {
        const a = agg.get(p.id)!;
        rows.push({
          userId: p.id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
          equippedNametag: p.equipped_nametag,
          equippedBadge: p.equipped_badge,
          equippedFrame: p.equipped_frame,
          equippedEffect: p.equipped_effect,
          stars: a.stars,
          cleared: a.cleared,
          totalMs: a.totalMs,
        });
      }
      return rows
        .sort((x, y) => y.stars - x.stars || y.cleared - x.cleared || x.totalMs - y.totalMs)
        .slice(0, limit);
    },
  });
}
