import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Achievement = {
  slug: string;
  title: string;
  blurb: string;
  metric: string;
  goal: number;
  reward_xp: number;
  reward_sparks: number;
  rarity: string;
};

export type AchievementClaim = { slug: string; reward_xp: number; reward_sparks: number; created_at: string };

/** Metric labels used in the UI, so a goal always reads honestly. */
export const METRIC_LABEL: Record<string, string> = {
  messages: "messages sent",
  friends: "friends",
  crew_xp: "XP given to a crew",
  pulse_clears: "Pulse Rush levels cleared",
  skyward_gates: "gates in one Skyward run",
  study_best: "% best study score",
};

export async function fetchAchievements() {
  const { data, error } = await supabase
    .from("achievements")
    .select("slug,title,blurb,metric,goal,reward_xp,reward_sparks,rarity")
    .order("goal", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Achievement[];
}

export async function fetchMyClaims(userId: string) {
  const { data, error } = await supabase
    .from("achievement_claims")
    .select("slug,reward_xp,reward_sparks,created_at")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as AchievementClaim[];
}

export async function fetchProgress(userId: string) {
  const { data, error } = await supabase.rpc("achievement_progress", { _user_id: userId });
  if (error) throw error;
  return (data ?? {}) as Record<string, number>;
}

export type SyncResult = {
  status: string;
  earned?: { slug: string; title: string; reward_xp: number; reward_sparks: number }[];
  gained?: number;
  sparks_gained?: number;
};

/** Claims every achievement whose goal the server can verify you've met. */
export async function syncAchievements() {
  const { data, error } = await supabase.rpc("sync_achievements");
  if (error) throw error;
  return data as unknown as SyncResult;
}

export type StreakResult = {
  status: "awarded" | "already_claimed" | "no_profile" | "banned";
  gained?: number;
  sparks_gained?: number;
  streak?: number;
};

export async function claimDailyStreak() {
  const { data, error } = await supabase.rpc("claim_daily_streak");
  if (error) throw error;
  return data as unknown as StreakResult;
}

/** The XP a streak day is worth before level scaling — matches claim_daily_streak. */
export function streakBaseXp(day: number) {
  return Math.min(600, 120 + (Math.min(Math.max(day, 1), 14) - 1) * 40);
}

export const STREAK_CAP_DAY = 14;

/** One-time bonuses for study decks, Pulse Rush first clears and Skyward gates. */
export async function awardBonusXp(kind: "study_mastery" | "pulse_first_clear" | "skyward_gates", ref: string) {
  const { data, error } = await supabase.rpc("award_bonus_xp", { _kind: kind, _ref: ref });
  if (error) throw error;
  return data as unknown as { status: string; gained?: number; sparks_gained?: number; key?: string };
}

/* ------------------------------------------------------------------- hooks */

export function useAchievements() {
  return useQuery({ queryKey: ["achievements"], queryFn: fetchAchievements, staleTime: 10 * 60_000 });
}

export function useMyAchievements(userId?: string) {
  return useQuery({
    queryKey: ["achievement-claims", userId],
    queryFn: () => fetchMyClaims(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useAchievementProgress(userId?: string, totalXp = 0) {
  return useQuery({
    queryKey: ["achievement-progress", userId, totalXp],
    queryFn: () => fetchProgress(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useSyncAchievements(onDone?: (r: SyncResult) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: syncAchievements,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["achievement-claims"] });
      qc.invalidateQueries({ queryKey: ["achievement-progress"] });
      onDone?.(r);
    },
  });
}
