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
    avatar_url: string | null;
  } | null;
};

const AUTHOR = "id, username, display_name, last_active_at, activity_context, equipped_nametag, equipped_badge, equipped_frame, equipped_effect, avatar_url";

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

export type ArcadeReward = {
  status: "awarded" | "granted" | "cooldown" | "capped" | "no_profile" | "unknown_game";
  gained?: number;
  sparks_gained?: number;
  personal_best?: boolean;
  runs_left?: number;
};

/**
 * Score-scaled XP for a finished arcade run. Solo progression path: you never
 * need another player online to level up. Cooldown + daily cap live server-side.
 */
export async function awardArcadeXp(game: GameId, score: number): Promise<ArcadeReward> {
  const { data, error } = await supabase.rpc("award_arcade_xp", {
    _game: game,
    _score: Math.max(0, Math.round(score)),
  } as never);
  if (error) throw error;
  return data as unknown as ArcadeReward;
}

/* ------------------------------------------------------------------ skyward */

export type SkywardRow = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bestScore: number;
  gates: number;
  runs: number;
};

/** Save a Skyward run so it shows on the crew leaderboard. */
export async function submitSkywardRun(
  userId: string,
  score: number,
  detail: { gates: number; orbs: number; powers: number },
) {
  const { error } = await supabase.from("game_scores").insert({
    user_id: userId,
    game: "crew-flight",
    score: Math.max(0, Math.round(score)),
    detail,
  });
  if (error) throw error;
}

/**
 * Top Skyward pilots: best single run plus every gate they've ever cleared.
 * Gates come from the run detail we store with each score.
 */
export function useSkywardLeaderboard() {
  return useQuery({
    queryKey: ["skyward-leaderboard"],
    staleTime: 30_000,
    queryFn: async (): Promise<SkywardRow[]> => {
      const { data, error } = await supabase
        .from("game_scores")
        .select(`score, detail, profile:profiles!game_scores_user_id_fkey (${AUTHOR})`)
        .eq("game", "crew-flight")
        .order("created_at", { ascending: false })
        .limit(600);
      if (error) throw error;

      const byUser = new Map<string, SkywardRow>();
      for (const raw of (data ?? []) as unknown as {
        score: number;
        detail: { gates?: number } | null;
        profile: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
      }[]) {
        const p = raw.profile;
        if (!p) continue;
        const row =
          byUser.get(p.id) ??
          {
            userId: p.id,
            username: p.username,
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
            bestScore: 0,
            gates: 0,
            runs: 0,
          };
        row.bestScore = Math.max(row.bestScore, raw.score ?? 0);
        row.gates += Math.max(0, Number(raw.detail?.gates ?? 0));
        row.runs += 1;
        byUser.set(p.id, row);
      }
      return [...byUser.values()].sort((a, b) => b.bestScore - a.bestScore).slice(0, 25);
    },
  });
}
