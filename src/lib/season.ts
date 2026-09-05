import { supabase } from "@/integrations/supabase/client";
import type { Cosmetic } from "./cosmetics";

export type Season = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_at: string;
};

export type RewardType = "sparks" | "xp" | "cosmetic" | "title" | "none";

export type SeasonTier = {
  id: string;
  season_id: string;
  tier: number;
  reward_type: RewardType;
  reward_value: number;
  cosmetic_slug: string | null;
  title_slug: string | null;
  description: string | null;
  cosmetic: Cosmetic | null;
  title: { slug: string; label: string; tier: number } | null;
};

export type SeasonProgress = {
  user_id: string;
  season_id: string;
  xp: number;
  claimed_tiers: number[];
};

export async function fetchActiveSeason(): Promise<Season | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("active", true)
    .order("starts_at", { ascending: false })
    .maybeSingle();
  if (error) throw error;
  return (data as Season | null) ?? null;
}

export async function fetchSeasonTiers(seasonId: string): Promise<SeasonTier[]> {
  const { data, error } = await supabase
    .from("season_tiers")
    .select(
      `id, season_id, tier, reward_type, reward_value, cosmetic_slug, title_slug, description,
       cosmetic:cosmetics (slug, name, slot, rarity, description, price_sparks, required_level, featured, pool, available_until),
       title:titles (slug, label, tier)`,
    )
    .eq("season_id", seasonId)
    .order("tier");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...(t as unknown as Omit<SeasonTier, "cosmetic" | "title">),
    cosmetic: (t as unknown as { cosmetic: Cosmetic | null }).cosmetic,
    title: (t as unknown as { title: { slug: string; label: string; tier: number } | null }).title,
  }));
}

export async function fetchMySeasonProgress(seasonId: string | undefined): Promise<SeasonProgress | null> {
  if (!seasonId) return null;
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("season_progress")
    .select("user_id, season_id, xp, claimed_tiers")
    .eq("season_id", seasonId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as SeasonProgress | null) ?? { user_id: userId, season_id: seasonId, xp: 0, claimed_tiers: [] };
}

export async function claimTier(seasonId: string, tier: number) {
  const { data, error } = await supabase.rpc("claim_season_tier", {
    _season_id: seasonId,
    _tier: tier,
  });
  if (error) throw error;
  return (data ?? { ok: false }) as { ok: boolean; error?: string; reward_type?: RewardType; reward_value?: number };
}

export function tierXpNeeded(tier: number): number {
  return tier * 1000;
}

export function currentTier(progressXp: number): number {
  let tier = 0;
  for (let i = 1; i <= 50; i++) {
    if (progressXp >= tierXpNeeded(i)) tier = i;
  }
  return tier;
}

export function seasonTimeLeft(endsAt: string): number {
  return Math.max(0, Math.round((Date.parse(endsAt) - Date.now()) / 1000));
}
