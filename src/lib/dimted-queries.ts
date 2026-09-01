import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { friendshipLevel, levelFromTotalXp, type PlayerStats } from "./dimted";
import type { Cosmetic } from "./cosmetics";

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  title: string;
  total_xp: number;
  realm_name: string;
  last_active_at: string;
  created_at: string;
  equipped_nametag: string | null;
  equipped_badge: string | null;
  equipped_frame: string | null;
  equipped_banner: string | null;
  equipped_effect: string | null;
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
  "id, username, display_name, bio, title, total_xp, realm_name, last_active_at, created_at, equipped_nametag, equipped_badge, equipped_frame, equipped_banner, equipped_effect";

const AUTHOR_FIELDS =
  "id, display_name, username, equipped_nametag, equipped_badge, equipped_frame, equipped_effect";

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
          .select("id, slug, name, tagline, owner_id, total_xp, created_at")
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
};

export type ChatMessage = {
  id: string;
  body: string;
  created_at: string;
  author: ChatAuthor | null;
};

export function useDirectMessages(friendshipId: string | undefined) {
  return useQuery({
    queryKey: ["messages", friendshipId],
    enabled: !!friendshipId,
    refetchInterval: 4000,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(`id, body, created_at, author:profiles!messages_sender_id_fkey (${AUTHOR_FIELDS})`)
        .eq("friendship_id", friendshipId!)
        .order("created_at");
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
          `id, body, created_at, author:profiles!community_messages_user_id_fkey (${AUTHOR_FIELDS})`,
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
    activities: all.filter((e) => e.source === "activity").length,
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
        .select("slug, name, slot, rarity, description, price_sparks, required_level, featured")
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

/** How many accounts exist in total — Dimted never pads this number. */
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
