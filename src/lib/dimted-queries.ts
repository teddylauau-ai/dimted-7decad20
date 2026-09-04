import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { friendshipLevel, levelFromTotalXp, type PlayerStats, type Rarity } from "./dimted";
import type { Cosmetic } from "./cosmetics";

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  title: string;
  total_xp: number;
  last_active_at: string;
  activity_context: string | null;
  created_at: string;
  equipped_nametag: string | null;
  equipped_badge: string | null;
  equipped_frame: string | null;
  equipped_banner: string | null;
  equipped_effect: string | null;
  avatar_url: string | null;
  banner_url: string | null;
};

export type FriendRow = {
  friendshipId: string;
  status: "pending" | "accepted";
  requesterId: string;
  friendshipXp: number;
  streak: number;
  lastExchangeAt: string | null;
  profile: PublicProfile;
};

const PROFILE_FIELDS =
  "id, username, display_name, bio, title, total_xp, last_active_at, activity_context, created_at, equipped_nametag, equipped_badge, equipped_frame, equipped_banner, equipped_effect, avatar_url, banner_url";

const AUTHOR_FIELDS =
  "id, display_name, username, last_active_at, activity_context, equipped_nametag, equipped_badge, equipped_frame, equipped_effect, avatar_url";

/** Someone counts as "around" if they've been active in the last 5 minutes. */
export function isRecentlyActive(iso: string): boolean {
  return Date.now() - Date.parse(iso) < 5 * 60 * 1000;
}

async function fetchFriendships(userId: string): Promise<FriendRow[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `id, status, requester_id, friendship_xp, streak, last_exchange_at,
       a:profiles!friendships_user_a_fkey (${PROFILE_FIELDS}),
       b:profiles!friendships_user_b_fkey (${PROFILE_FIELDS})`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      status: "pending" | "accepted";
      requester_id: string;
      friendship_xp: number;
      streak: number;
      last_exchange_at: string | null;
      a: PublicProfile;
      b: PublicProfile;
    };
    const other = r.a.id === userId ? r.b : r.a;
    return {
      friendshipId: r.id,
      status: r.status,
      requesterId: r.requester_id,
      friendshipXp: r.friendship_xp,
      streak: r.streak,
      lastExchangeAt: r.last_exchange_at,
      profile: other,
    };
  });
}

export function useFriendships(userId: string | undefined) {
  return useQuery({
    queryKey: ["friendships", userId],
    enabled: !!userId,
    queryFn: () => fetchFriendships(userId!),
  });
}

export type CommunityRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  owner_id: string;
  total_xp: number;
  created_at: string;
  visibility: string;
  memberCount: number;
  isMember: boolean;
};

export function useCommunities(userId: string | undefined) {
  return useQuery({
    queryKey: ["communities", userId],
    enabled: !!userId,
    queryFn: async (): Promise<CommunityRow[]> => {
      const [{ data: communities, error }, { data: members }] = await Promise.all([
        supabase
          .from("communities")
          .select("id, slug, name, tagline, owner_id, total_xp, created_at, visibility")
          .order("total_xp", { ascending: false }),
        supabase.from("community_members").select("community_id, user_id"),
      ]);
      if (error) throw error;

      const rows = (members ?? []) as { community_id: string; user_id: string }[];
      return (communities ?? []).map((c) => ({
        ...(c as Omit<CommunityRow, "memberCount" | "isMember">),
        memberCount: rows.filter((m) => m.community_id === c.id).length,
        isMember: rows.some((m) => m.community_id === c.id && m.user_id === userId),
      }));
    },
  });
}

export type ChannelRow = {
  id: string;
  community_id: string;
  name: string;
  topic: string | null;
  position: number;
};

export function useChannels(communityId: string | undefined) {
  return useQuery({
    queryKey: ["channels", communityId],
    enabled: !!communityId,
    queryFn: async (): Promise<ChannelRow[]> => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, community_id, name, topic, position")
        .eq("community_id", communityId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as ChannelRow[];
    },
  });
}

export type ChatAuthor = {
  id: string;
  display_name: string;
  username: string;
  equipped_nametag: string | null;
  equipped_badge: string | null;
  equipped_frame: string | null;
  equipped_effect: string | null;
  avatar_url: string | null;
};

export type ChatMessage = {
  id: string;
  body: string;
  created_at: string;
  audio_url?: string | null;
  audio_ms?: number | null;
  author: ChatAuthor | null;
};

/**
 * Newest first, capped at the 100 most recent — the database trims anything
 * older, so a long-running chat never turns into an endless scroll.
 */
export function useDirectMessages(friendshipId: string | undefined) {
  return useQuery({
    queryKey: ["messages", friendshipId],
    enabled: !!friendshipId,
    refetchInterval: 4000,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(`id, body, audio_url, audio_ms, created_at, author:profiles!messages_sender_id_fkey (${AUTHOR_FIELDS})`)
        .eq("friendship_id", friendshipId!)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as ChatMessage[];
    },
  });
}

export function useChannelMessages(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-messages", channelId],
    enabled: !!channelId,
    refetchInterval: 4000,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("community_messages")
        .select(
          `id, body, audio_url, audio_ms, created_at, author:profiles!community_messages_user_id_fkey (${AUTHOR_FIELDS})`,
        )
        .eq("channel_id", channelId!)
        .order("created_at")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ChatMessage[];
    },
  });
}

export type XpEvent = {
  id: string;
  user_id: string;
  source: string;
  amount: number;
  label: string | null;
  created_at: string;
  author: {
    username: string;
    display_name: string;
    equipped_nametag: string | null;
    equipped_badge: string | null;
  } | null;
};

/** Your XP log plus your friends' — the only "live feed" that exists. */
export function useXpFeed(userId: string | undefined) {
  return useQuery({
    queryKey: ["xp-feed", userId],
    enabled: !!userId,
    refetchInterval: 10000,
    queryFn: async (): Promise<XpEvent[]> => {
      const { data, error } = await supabase
        .from("xp_events")
        .select(
          "id, user_id, source, amount, label, created_at, author:profiles!xp_events_user_id_fkey (username, display_name, equipped_nametag, equipped_badge)",
        )
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as unknown as XpEvent[];
    },
  });
}

/** Counts used for challenges — read straight from your own XP log. */
export function useMyXpEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-xp-events", userId],
    enabled: !!userId,
    refetchInterval: 10000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("xp_events")
        .select("source, created_at")
        .eq("user_id", userId!)
        .gte("created_at", since);
      if (error) throw error;
      return (data ?? []) as { source: string; created_at: string }[];
    },
  });
}

export function countEvents(
  events: { source: string; created_at: string }[] | undefined,
  source: string,
  cadence: "daily" | "weekly",
): number {
  if (!events) return 0;
  const cutoff = Date.now() - (cadence === "daily" ? 24 : 7 * 24) * 3600 * 1000;
  return events.filter((e) => e.source === source && Date.parse(e.created_at) > cutoff).length;
}

export function usePlayerStats(userId: string | undefined, totalXp: number): PlayerStats {
  const friends = useFriendships(userId);
  const communities = useCommunities(userId);
  const events = useMyXpEvents(userId);

  const accepted = (friends.data ?? []).filter((f) => f.status === "accepted");
  const all = events.data ?? [];

  return {
    level: levelFromTotalXp(totalXp).level,
    totalXp,
    friends: accepted.length,
    messagesSent: all.filter((e) => e.source === "message").length,
    communities: (communities.data ?? []).filter((c) => c.isMember).length,
    activities: all.filter((e) => e.source === "activity" || e.source === "arcade").length,
    discoveries: all.filter((e) => e.source === "discovery").length,
    bestFriendshipLevel: accepted.reduce(
      (best, f) => Math.max(best, friendshipLevel(f.friendshipXp).level),
      0,
    ),
  };
}

/** Invalidate everything that depends on progression after an action. */
export function useRefreshDimted() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["friendships"] });
    void qc.invalidateQueries({ queryKey: ["communities"] });
    void qc.invalidateQueries({ queryKey: ["xp-feed"] });
    void qc.invalidateQueries({ queryKey: ["my-xp-events"] });
  };
}

export async function searchProfiles(query: string, excludeId: string): Promise<PublicProfile[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .neq("id", excludeId)
    .limit(12);
  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

export function useNewestProfiles(userId: string | undefined) {
  return useQuery({
    queryKey: ["newest-profiles", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .neq("id", userId!)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as PublicProfile[];
    },
  });
}

/** The whole cosmetic catalogue — the shop and every preview read this. */
export function useCosmetics() {
  return useQuery({
    queryKey: ["cosmetics"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Cosmetic[]> => {
      const { data, error } = await supabase
        .from("cosmetics")
        .select("slug, name, slot, rarity, description, price_sparks, required_level, featured, pool, available_until")
        .order("price_sparks");
      if (error) throw error;
      return (data ?? []) as Cosmetic[];
    },
  });
}

/** What a given player owns. Used for your own inventory and other profiles. */
export function useInventory(userId: string | undefined) {
  return useQuery({
    queryKey: ["inventory", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("inventory")
        .select("cosmetic_slug")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => (r as { cosmetic_slug: string }).cosmetic_slug);
    },
  });
}

/** Public profile lookup by handle — only real signed-up accounts resolve. */
export function useProfileByUsername(username: string | undefined) {
  return useQuery({
    queryKey: ["profile-by-username", username],
    enabled: !!username,
    queryFn: async (): Promise<PublicProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .eq("username", username!)
        .maybeSingle();
      if (error) throw error;
      return (data as PublicProfile | null) ?? null;
    },
  });
}

/** How many accounts exist in total — Lumo never pads this number. */
export function usePlayerCount() {
  return useQuery({
    queryKey: ["player-count"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/* ------------------------------------------------------------- notifications */

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  actor: {
    username: string;
    display_name: string;
    equipped_nametag: string | null;
    equipped_badge: string | null;
    avatar_url: string | null;
  } | null;
};

/** Your inbox. Polled often so a new DM shows up without a refresh. */
export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 8000,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, kind, title, body, link, read_at, created_at, actor:profiles!notifications_actor_id_fkey (username, display_name, equipped_nametag, equipped_badge, avatar_url)",
        )
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as Notification[];
    },
  });
}

/* -------------------------------------------------------------------- quests */

export type Quest = {
  slug: string;
  title: string;
  cadence: "daily" | "weekly";
  source: string;
  goal: number;
  reward_xp: number;
  reward_sparks: number;
  rarity: Rarity;
};

export function useQuests() {
  return useQuery({
    queryKey: ["quests"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Quest[]> => {
      const { data, error } = await supabase
        .from("quests")
        .select("slug, title, cadence, source, goal, reward_xp, reward_sparks, rarity")
        .order("cadence")
        .order("reward_xp");
      if (error) throw error;
      return (data ?? []) as unknown as Quest[];
    },
  });
}

export type QuestClaim = { quest_slug: string; period_key: string; created_at: string };

export function useQuestClaims(userId: string | undefined) {
  return useQuery({
    queryKey: ["quest-claims", userId],
    enabled: !!userId,
    queryFn: async (): Promise<QuestClaim[]> => {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("quest_claims")
        .select("quest_slug, period_key, created_at")
        .gte("created_at", since);
      if (error) throw error;
      return (data ?? []) as QuestClaim[];
    },
  });
}

/** Same period keys the server uses when it records a claim. */
export function periodKeyFor(cadence: "daily" | "weekly", now = new Date()): string {
  if (cadence === "daily") return now.toISOString().slice(0, 10);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Everything a public profile shows: best scores and campaign progress. */
export function usePublicPlayerDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["public-player-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [scores, campaign] = await Promise.all([
        supabase.from("game_scores").select("game, score, created_at").eq("user_id", userId!),
        supabase.from("game_progress").select("game, level, stars, best_ms").eq("user_id", userId!),
      ]);
      if (scores.error) throw scores.error;
      return {
        scores: (scores.data ?? []) as { game: string; score: number; created_at: string }[],
        campaign: (campaign.data ?? []) as {
          game: string;
          level: number;
          stars: number;
          best_ms: number | null;
        }[],
      };
    },
  });
}


/* ------------------------------------------------- community administration */

export type MemberRow = {
  user_id: string;
  role: string;
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

/** Members of one community, for the manage panel. */
export function useCommunityMembers(communityId: string | undefined) {
  return useQuery({
    queryKey: ["community-members", communityId],
    enabled: !!communityId,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from("community_members")
        .select(
          "user_id, role, profile:profiles!community_members_user_id_fkey (id, username, display_name, last_active_at, activity_context, equipped_nametag, equipped_badge, equipped_frame, equipped_effect, avatar_url)",
        )
        .eq("community_id", communityId!);
      if (error) throw error;
      return (data ?? []) as unknown as MemberRow[];
    },
  });
}

export type InviteRow = {
  user_id: string;
  created_at: string;
  profile: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
};

/** Outstanding invites for a private community. */
export function useCommunityInvites(communityId: string | undefined) {
  return useQuery({
    queryKey: ["community-invites", communityId],
    enabled: !!communityId,
    queryFn: async (): Promise<InviteRow[]> => {
      const { data, error } = await supabase
        .from("community_invites")
        .select(
          "user_id, created_at, profile:profiles!community_invites_user_id_fkey (id, username, display_name, avatar_url)",
        )
        .eq("community_id", communityId!);
      if (error) throw error;
      return (data ?? []) as unknown as InviteRow[];
    },
  });
}

/** Global XP ladder — every real account, ranked by total XP. */
export function useXpLeaderboard(limit = 50) {
  return useQuery({
    queryKey: ["xp-leaderboard", limit],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .order("total_xp", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as PublicProfile[];
    },
  });
}
