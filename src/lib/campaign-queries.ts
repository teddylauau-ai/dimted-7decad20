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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["campaign-progress", userId] }),
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
