import { supabase } from "@/integrations/supabase/client";

export type CrewRole = "owner" | "captain" | "member";

export type CrewAccent = "teal" | "violet" | "amber" | "rose" | "emerald" | "sky" | "slate";

export const CREW_ACCENTS: { key: CrewAccent; label: string; dot: string; glow: string; ring: string }[] = [
  { key: "teal", label: "Aurora", dot: "bg-teal-400", glow: "from-teal-400/25", ring: "ring-teal-400/40" },
  { key: "violet", label: "Nebula", dot: "bg-violet-400", glow: "from-violet-400/25", ring: "ring-violet-400/40" },
  { key: "amber", label: "Ember", dot: "bg-amber-400", glow: "from-amber-400/25", ring: "ring-amber-400/40" },
  { key: "rose", label: "Nova", dot: "bg-rose-400", glow: "from-rose-400/25", ring: "ring-rose-400/40" },
  { key: "emerald", label: "Verdant", dot: "bg-emerald-400", glow: "from-emerald-400/25", ring: "ring-emerald-400/40" },
  { key: "sky", label: "Cirrus", dot: "bg-sky-400", glow: "from-sky-400/25", ring: "ring-sky-400/40" },
  { key: "slate", label: "Obsidian", dot: "bg-slate-400", glow: "from-slate-400/25", ring: "ring-slate-400/40" },
];

export const CREW_EMOJI = [
  "🛡️","⚡","🔥","🌊","🦅","🐺","🐉","👾","🚀","🌌","💠","🎯","🎧","🧿","⚔️","🪐","🥇","🧠","🌠","☄️",
];

export function accentOf(accent: string | null | undefined) {
  return CREW_ACCENTS.find((a) => a.key === accent) ?? CREW_ACCENTS[0];
}

/** Crew level: shared XP pool, 1500 XP per level with gentle scaling. */
export function crewLevel(totalXp: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, totalXp) / 900)) + 1);
  const floor = 900 * (level - 1) ** 2;
  const next = 900 * level ** 2;
  return { level, floor, next, pct: Math.min(100, Math.round(((totalXp - floor) / (next - floor)) * 100)) };
}

export type CrewRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  badge_emoji: string;
  accent: CrewAccent;
  banner_url: string | null;
  join_policy: "open" | "invite";
  member_limit: number;
  visibility: "public" | "private";
  total_xp: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
  memberCount: number;
  isMember: boolean;
};

export type CrewMember = {
  crew_id: string;
  user_id: string;
  role: CrewRole;
  joined_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    equipped_frame: string | null;
    equipped_badge: string | null;
    last_active_at: string;
    activity_context: string | null;
  };
};

export type CrewInvite = {
  id: string;
  crew_id: string;
  user_id: string;
  invited_by: string | null;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  inviter: {
    id: string;
    username: string;
    display_name: string;
  } | null;
  crew: {
    id: string;
    slug: string;
    name: string;
    badge_emoji: string;
  } | null;
};

export type CrewMessage = {
  id: string;
  crew_id: string;
  user_id: string;
  body: string;
  reply_to_id: string | null;
  audio_url: string | null;
  audio_ms: number | null;
  image_url: string | null;
  created_at: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    equipped_nametag: string | null;
    equipped_badge: string | null;
    equipped_frame: string | null;
    equipped_effect: string | null;
  } | null;
};

const PROFILE_FIELDS =
  "id, username, display_name, avatar_url, equipped_frame, equipped_badge, last_active_at, activity_context";

const AUTHOR_FIELDS =
  "id, username, display_name, avatar_url, equipped_nametag, equipped_badge, equipped_frame, equipped_effect";

export async function fetchCrews(userId: string | undefined): Promise<CrewRow[]> {
  const [{ data: crews, error }, { data: members }] = await Promise.all([
    supabase.from("crews").select("*").order("total_xp", { ascending: false }),
    supabase.from("crew_members").select("crew_id, user_id"),
  ]);
  if (error) throw error;

  const rows = (members ?? []) as { crew_id: string; user_id: string }[];
  return (crews ?? []).map((c) => ({
    ...(c as Omit<CrewRow, "memberCount" | "isMember">),
    memberCount: rows.filter((m) => m.crew_id === c.id).length,
    isMember: rows.some((m) => m.crew_id === c.id && m.user_id === userId),
  }));
}

export async function fetchMyCrews(userId: string | undefined): Promise<CrewRow[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("crew_members")
    .select("crew:crews(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as { crew: CrewRow }[]).map((d) => d.crew);
}

export async function fetchCrewBySlug(slug: string): Promise<CrewRow | null> {
  const { data, error } = await supabase.from("crews").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as CrewRow | null) ?? null;
}

export async function fetchCrewMembers(crewId: string): Promise<CrewMember[]> {
  const { data, error } = await supabase
    .from("crew_members")
    .select(`crew_id, user_id, role, joined_at, profile:profiles!crew_members_user_id_fkey (${PROFILE_FIELDS})`)
    .eq("crew_id", crewId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CrewMember[];
}

export async function fetchCrewInvites(crewId: string): Promise<CrewInvite[]> {
  const { data, error } = await supabase
    .from("crew_invites")
    .select(
      `id, crew_id, user_id, invited_by, created_at,
       profile:profiles!crew_invites_user_id_fkey (id, username, display_name, avatar_url),
       inviter:profiles!crew_invites_invited_by_fkey (id, username, display_name)`,
    )
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CrewInvite[];
}

export async function fetchMyCrewInvites(userId: string | undefined): Promise<CrewInvite[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("crew_invites")
    .select(
      `id, crew_id, user_id, invited_by, created_at,
       crew:crews (id, slug, name, badge_emoji),
       inviter:profiles!crew_invites_invited_by_fkey (id, username, display_name)`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CrewInvite[];
}

export async function fetchCrewMessages(crewId: string): Promise<CrewMessage[]> {
  const { data, error } = await supabase
    .from("crew_messages")
    .select(
      `id, crew_id, user_id, body, reply_to_id, audio_url, audio_ms, image_url, created_at,
       author:profiles!crew_messages_user_id_fkey (${AUTHOR_FIELDS})`,
    )
    .eq("crew_id", crewId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as CrewMessage[];
}

export async function createCrew(input: {
  name: string;
  tagline: string;
  description: string;
  badge_emoji: string;
  accent: CrewAccent;
  visibility: "public" | "private";
  join_policy: "open" | "invite";
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_crew", {
    _name: input.name,
    _tagline: input.tagline,
    _description: input.description,
    _badge_emoji: input.badge_emoji,
    _accent: input.accent,
    _visibility: input.visibility,
    _join_policy: input.join_policy,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; id?: string; error?: string };
  if (!res.ok || !res.id) throw new Error(res.error ?? "Couldn't create that crew");
  return res.id;
}

export async function joinCrew(crewId: string) {
  const { data, error } = await supabase.rpc("join_crew", { _crew_id: crewId });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(res.error ?? "Couldn't join that crew");
}

export async function updateCrew(
  crewId: string,
  patch: Partial<{
    name: string;
    tagline: string;
    description: string;
    badge_emoji: string;
    banner_url: string;
    accent: CrewAccent;
    visibility: "public" | "private";
    join_policy: "open" | "invite";
  }>,
) {
  const { data, error } = await supabase.rpc("update_crew", { _crew_id: crewId, _patch: patch });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(res.error ?? "Couldn't save those changes");
}

export async function uploadCrewBanner(crewId: string, userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image");
  if (file.size > 8 * 1024 * 1024) throw new Error("Images must be under 8MB");
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/crew-banner-${crewId}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("voice")
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: true });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage.from("voice").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Couldn't read that image back");
  await updateCrew(crewId, { banner_url: data.signedUrl });
  return data.signedUrl;
}

export async function inviteToCrew(crewId: string, userId: string, invitedBy: string) {
  const { error } = await supabase
    .from("crew_invites")
    .insert({ crew_id: crewId, user_id: userId, invited_by: invitedBy });
  if (error) throw error;
}

export async function revokeCrewInvite(crewId: string, userId: string) {
  const { error } = await supabase.from("crew_invites").delete().eq("crew_id", crewId).eq("user_id", userId);
  if (error) throw error;
}

export async function acceptCrewInvite(crewId: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase.rpc("add_member_to_crew", {
    _crew_id: crewId,
    _user_id: userId,
    _role: "member",
  });
  if (error) throw error;
  return (data ?? { ok: false }) as { ok: boolean; error?: string };
}

export async function leaveCrew(crewId: string, userId: string) {
  const { error } = await supabase.from("crew_members").delete().eq("crew_id", crewId).eq("user_id", userId);
  if (error) throw error;
}

export async function removeCrewMember(crewId: string, userId: string) {
  const { error } = await supabase.from("crew_members").delete().eq("crew_id", crewId).eq("user_id", userId);
  if (error) throw error;
}

export async function promoteCrewMember(crewId: string, userId: string, role: CrewRole) {
  const { error } = await supabase.from("crew_members").update({ role }).eq("crew_id", crewId).eq("user_id", userId);
  if (error) throw error;
}

export async function postCrewMessage(
  crewId: string,
  userId: string,
  body: string,
  replyToId?: string | null,
) {
  const { error } = await supabase
    .from("crew_messages")
    .insert({ crew_id: crewId, user_id: userId, body, reply_to_id: replyToId ?? null });
  if (error) throw error;
}

export async function postCrewVoiceMessage(crewId: string, userId: string, blob: Blob, durationMs: number) {
  const audio_url = await uploadCrewVoiceClip(userId, blob);
  const { error } = await supabase.from("crew_messages").insert({
    crew_id: crewId,
    user_id: userId,
    body: "🎤 Voice message",
    audio_url,
    audio_ms: Math.round(durationMs),
  });
  if (error) throw error;
}

export async function postCrewImageMessage(crewId: string, userId: string, file: File) {
  const image_url = await uploadCrewImage(userId, file);
  const { error } = await supabase.from("crew_messages").insert({
    crew_id: crewId,
    user_id: userId,
    body: "📷 Image",
    image_url,
  });
  if (error) throw error;
}

async function uploadCrewVoiceClip(userId: string, blob: Blob): Promise<string> {
  if (blob.size > 10 * 1024 * 1024) throw new Error("Voice messages must be under 10MB");
  const type = blob.type.split(";")[0] || "audio/webm";
  const ext = type.includes("mp4") ? "mp4" : type.includes("mpeg") ? "mp3" : type.includes("wav") ? "wav" : "webm";
  const path = `${userId}/crew-voice-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("voice")
    .upload(path, blob, { cacheControl: "31536000", contentType: type, upsert: true });
  if (upErr) throw upErr;

  const { data, error } = await supabase.storage.from("voice").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Couldn't read that recording back");
  return data.signedUrl;
}

async function uploadCrewImage(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image");
  if (file.size > 8 * 1024 * 1024) throw new Error("Images must be under 8MB");
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/crew-img-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("voice")
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: true });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage.from("voice").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Couldn't read that image back");
  return data.signedUrl;
}
