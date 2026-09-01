import { supabase } from "@/integrations/supabase/client";

/** Friend requests are stored with a canonical ordering of the two ids. */
export async function sendFriendRequest(myId: string, targetId: string) {
  const [user_a, user_b] = [myId, targetId].sort();
  const { error } = await supabase
    .from("friendships")
    .insert({ user_a: user_a!, user_b: user_b!, requester_id: myId, status: "pending" });
  if (error) throw error;
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean) {
  if (!accept) {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", last_exchange_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) throw error;
}

export async function sendDirectMessage(friendshipId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .insert({ friendship_id: friendshipId, sender_id: senderId, body });
  if (error) throw error;
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "community"
  );
}

export async function createCommunity(ownerId: string, name: string, tagline: string) {
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("communities")
    .insert({ owner_id: ownerId, name, tagline: tagline || null, slug })
    .select("id")
    .single();
  if (error) throw error;

  const communityId = (data as { id: string }).id;
  await supabase
    .from("community_members")
    .insert({ community_id: communityId, user_id: ownerId, role: "owner" });
  await supabase.from("channels").insert([
    { community_id: communityId, name: "general", topic: "Everything starts here.", position: 0 },
    { community_id: communityId, name: "activities", topic: "Run activities together.", position: 1 },
  ]);
  return communityId;
}

export async function joinCommunity(communityId: string, userId: string) {
  const { error } = await supabase
    .from("community_members")
    .insert({ community_id: communityId, user_id: userId, role: "member" });
  if (error) throw error;
}

export async function leaveCommunity(communityId: string, userId: string) {
  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function postChannelMessage(
  communityId: string,
  channelId: string,
  userId: string,
  body: string,
) {
  const { error } = await supabase
    .from("community_messages")
    .insert({ community_id: communityId, channel_id: channelId, user_id: userId, body });
  if (error) throw error;
}

export type PurchaseStatus =
  | "purchased"
  | "owned"
  | "locked"
  | "insufficient"
  | "unknown_item"
  | "no_profile"
  | "error";

/** Buying happens entirely on the server: level, balance and ownership checked there. */
export async function purchaseCosmetic(slug: string): Promise<{
  status: PurchaseStatus;
  sparks?: number;
  price?: number;
  required_level?: number;
}> {
  const { data, error } = await supabase.rpc("purchase_cosmetic", { _slug: slug });
  if (error) return { status: "error" };
  return (data ?? { status: "error" }) as { status: PurchaseStatus; sparks?: number };
}

/** One item per slot; pass null to take the slot off (the RPC accepts NULL). */
export async function equipCosmetic(slug: string | null, slot: string) {
  const { error } = await supabase.rpc("equip_cosmetic", {
    _slug: slug as unknown as string,
    _slot: slot,
  });
  if (error) throw error;
}

export async function updateProfile(
  userId: string,
  patch: { display_name?: string; bio?: string; title?: string; realm_name?: string },
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}
