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
  patch: { display_name?: string; bio?: string; title?: string; realm_name?: string; avatar_url?: string | null; banner_url?: string | null },
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

/**
 * Profile picture upload. Files live in a private bucket under the owner's
 * folder, and we store a long-lived signed URL on the profile so every
 * surface (chat rows, leaderboards, public profiles) can render it directly.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be under 5MB");

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { cacheControl: "31536000", upsert: true, contentType: file.type });
  if (upErr) throw upErr;

  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Couldn't read that image back");

  await updateProfile(userId, { avatar_url: data.signedUrl });
  return data.signedUrl;
}

export async function removeAvatar(userId: string) {
  await updateProfile(userId, { avatar_url: null });
}

/** Custom banner image upload (same private bucket, banner-* filenames). */
export async function uploadBanner(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image");
  if (file.size > 8 * 1024 * 1024) throw new Error("Banners must be under 8MB");

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/banner-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { cacheControl: "31536000", upsert: true, contentType: file.type });
  if (upErr) throw upErr;

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Couldn't read that image back");

  await updateProfile(userId, { banner_url: data.signedUrl });
  return data.signedUrl;
}

export async function removeBanner(userId: string) {
  await updateProfile(userId, { banner_url: null });
}

/* ------------------------------------------------------------------ presence */

/** Tell the server we're alive and what screen we're on. Status is derived. */
export async function touchPresence(context: string) {
  await supabase.rpc("touch_presence", { _context: context });
}

/* ------------------------------------------------------------- notifications */

export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export async function clearNotifications(userId: string) {
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId);
  if (error) throw error;
}

/* ------------------------------------------------------------------- quests */

export type ClaimQuestResult = {
  status:
    | "claimed_now"
    | "claimed"
    | "incomplete"
    | "unknown_quest"
    | "no_profile"
    | "forbidden"
    | "error";
  reward_xp?: number;
  reward_sparks?: number;
  progress?: number;
  goal?: number;
};

/** Rewards are validated on the server against your real activity log. */
export async function claimQuest(slug: string): Promise<ClaimQuestResult> {
  const { data, error } = await supabase.rpc("claim_quest", { _slug: slug });
  if (error) return { status: "error" };
  return (data ?? { status: "error" }) as ClaimQuestResult;
}
