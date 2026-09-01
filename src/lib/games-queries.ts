import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GameId } from "./games";

export type ScoreRow = {
  id: string;
  game: string;
  score: number;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    equipped_nametag: string | null;
    equipped_badge: string | null;
    equipped_frame: string | null;
    equipped_effect: string | null;
  } | null;
};

const AUTHOR = "id, username, display_name, equipped_nametag, equipped_badge, equipped_frame, equipped_effect";

/** Top run per game, best first. */
export function useLeaderboard(game: GameId) {
  return useQuery({
    queryKey: ["leaderboard", game],
    queryFn: async (): Promise<ScoreRow[]> => {
      const { data, error } = await supabase
        .from("game_scores")
        .select(`id, game, score, created_at, profile:profiles!game_scores_user_id_fkey (${AUTHOR})`)
        .eq("game", game)
        .order("score", { ascending: false })
        .limit(25);
      if (error) throw error;

      // One row per player: their personal best.
      const seen = new Set<string>();
      return (data as unknown as ScoreRow[]).filter((row) => {
        const key = row.profile?.id ?? row.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });
}

/** Everything you've ever scored, newest first. */
export function useMyScores(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-scores", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_scores")
        .select("id, game, score, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function personalBest(
  scores: { game: string; score: number }[] | undefined,
  game: GameId,
): number {
  return (scores ?? []).filter((s) => s.game === game).reduce((m, s) => Math.max(m, s.score), 0);
}

export function useSubmitScore(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ game, score }: { game: GameId; score: number }) => {
      if (!userId) throw new Error("Sign in to save scores");
      const { error } = await supabase
        .from("game_scores")
        .insert({ user_id: userId, game, score: Math.max(0, Math.round(score)) });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["leaderboard", vars.game] });
      void qc.invalidateQueries({ queryKey: ["my-scores", userId] });
    },
  });
}

/** Staff can wipe a bogus run. */
export function useDeleteScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("game_scores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["leaderboard"] }),
  });
}
