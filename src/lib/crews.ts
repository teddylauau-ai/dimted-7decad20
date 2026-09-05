import type React from "react";
import { supabase } from "@/integrations/supabase/client";

export type CrewRole = "owner" | "captain" | "lieutenant" | "member" | "recruit";

/** Crew rank ladder — Captain is the top of a crew. */
export const CREW_RANKS: {
  key: CrewRole;
  label: string;
  level: number;
  blurb: string;
  cls: string;
}[] = [
  {
    key: "owner",
    label: "Captain",
    level: 5,
    blurb: "Leads the crew. Full control of settings, ranks and members.",
    cls: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
  },
  {
    key: "captain",
    label: "First Mate",
    level: 4,
    blurb: "Second in command. Can customise the crew, invite and set lower ranks.",
    cls: "bg-teal-400/15 text-teal-300 ring-1 ring-teal-400/30",
  },
  {
    key: "lieutenant",
    label: "Lieutenant",
    level: 3,
    blurb: "Trusted veteran. Keeps the chat tidy and welcomes new faces.",
    cls: "bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/30",
  },
  {
    key: "member",
    label: "Crewmate",
    level: 2,
    blurb: "Full member — chats, plays and banks crew XP.",
    cls: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30",
  },
  {
    key: "recruit",
    label: "Recruit",
    level: 1,
    blurb: "Just joined. Prove yourself and climb the ladder.",
    cls: "bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/30",
  },
];

export function rankOf(role: CrewRole | null | undefined) {
  return CREW_RANKS.find((r) => r.key === role) ?? CREW_RANKS[3]!;
}

export function rankLevel(role: CrewRole | null | undefined) {
  return rankOf(role).level;
}

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

export type CrewBadgeStyle = "plain" | "ring" | "plate" | "crest" | "holo" | "pulse";
export type CrewNametag = "none" | "accent" | "glow" | "gradient" | "outline" | "mono";
export type CrewTextEffect = "none" | "glow" | "shimmer" | "sharp" | "soft" | "wave";
export type CrewChatBg = "none" | "grid" | "aurora" | "stars" | "waves" | "circuit" | "glass";

/** Crew badge shells — how the crew emoji/picture is framed everywhere. */
export const CREW_BADGE_STYLES: { key: CrewBadgeStyle; label: string; unlock: number; cls: string }[] = [
  { key: "plain", label: "Plain", unlock: 1, cls: "" },
  { key: "ring", label: "Ring", unlock: 1, cls: "ring-2 ring-offset-2 ring-offset-background" },
  { key: "plate", label: "Plate", unlock: 3, cls: "ring-1 shadow-lg shadow-black/30" },
  { key: "crest", label: "Crest", unlock: 6, cls: "ring-2 rotate-3 shadow-lg shadow-black/40" },
  { key: "holo", label: "Holo", unlock: 12, cls: "ring-2 shadow-[0_0_18px_-2px_currentColor]" },
  { key: "pulse", label: "Pulse", unlock: 18, cls: "ring-2 animate-pulse shadow-[0_0_22px_-4px_currentColor]" },
];

/** Crew nametags — applied to member names inside crew chat. */
export const CREW_NAMETAGS: { key: CrewNametag; label: string; unlock: number; cls: string }[] = [
  { key: "none", label: "Default", unlock: 1, cls: "" },
  { key: "accent", label: "Accent", unlock: 1, cls: "font-semibold" },
  { key: "glow", label: "Glow", unlock: 4, cls: "font-semibold drop-shadow-[0_0_6px_currentColor]" },
  { key: "gradient", label: "Gradient", unlock: 8, cls: "font-bold bg-gradient-to-r from-current to-foreground bg-clip-text text-transparent" },
  { key: "outline", label: "Outline", unlock: 12, cls: "font-bold [-webkit-text-stroke:0.6px_currentColor]" },
  { key: "mono", label: "Terminal", unlock: 16, cls: "font-mono text-[11px] uppercase tracking-[0.14em]" },
];

/** Crew message text effects. */
export const CREW_TEXT_EFFECTS: { key: CrewTextEffect; label: string; unlock: number; cls: string }[] = [
  { key: "none", label: "Clean", unlock: 1, cls: "" },
  { key: "glow", label: "Glow", unlock: 2, cls: "drop-shadow-[0_0_8px_rgba(45,212,191,0.45)]" },
  { key: "shimmer", label: "Shimmer", unlock: 7, cls: "crew-fx-shimmer" },
  { key: "sharp", label: "Sharp", unlock: 5, cls: "font-medium tracking-tight" },
  { key: "soft", label: "Soft", unlock: 5, cls: "italic opacity-90" },
  { key: "wave", label: "Wave", unlock: 14, cls: "crew-fx-wave" },
];

/** Crew chat backgrounds. */
export const CREW_CHAT_BGS: { key: CrewChatBg; label: string; unlock: number }[] = [
  { key: "none", label: "None", unlock: 1 },
  { key: "grid", label: "Grid", unlock: 1 },
  { key: "aurora", label: "Aurora", unlock: 2 },
  { key: "stars", label: "Starfield", unlock: 5 },
  { key: "waves", label: "Waves", unlock: 9 },
  { key: "circuit", label: "Circuit", unlock: 13 },
  { key: "glass", label: "Frosted", unlock: 1 },
];

/** CSS for a chat background preset (accent-tinted, always subtle). */
export function chatBgStyle(bg: CrewChatBg): React.CSSProperties {
  switch (bg) {
    case "grid":
      return {
        backgroundImage:
          "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
        backgroundSize: "38px 38px",
        opacity: 0.07,
      };
    case "aurora":
      return {
        backgroundImage:
          "radial-gradient(60% 45% at 20% 0%, currentColor 0%, transparent 70%), radial-gradient(50% 40% at 85% 100%, currentColor 0%, transparent 70%)",
        opacity: 0.18,
      };
    case "stars":
      return {
        backgroundImage:
          "radial-gradient(currentColor 1px, transparent 1.4px), radial-gradient(currentColor 1px, transparent 1.4px)",
        backgroundSize: "70px 70px, 110px 110px",
        backgroundPosition: "0 0, 35px 55px",
        opacity: 0.16,
      };
    case "waves":
      return {
        backgroundImage:
          "repeating-radial-gradient(circle at 50% 120%, currentColor 0 1px, transparent 1px 26px)",
        opacity: 0.1,
      };
    case "circuit":
      return {
        backgroundImage:
          "linear-gradient(45deg, currentColor 1px, transparent 1px), linear-gradient(-45deg, currentColor 1px, transparent 1px)",
        backgroundSize: "26px 26px",
        opacity: 0.08,
      };
    case "glass":
      return { backdropFilter: "blur(2px)", backgroundImage: "linear-gradient(180deg, currentColor, transparent)", opacity: 0.08 };
    default:
      return { opacity: 0 };
  }
}

/** Tailwind text-colour class for an accent, used to tint chat backgrounds/nametags. */
export const ACCENT_TEXT: Record<CrewAccent, string> = {
  teal: "text-teal-400",
  violet: "text-violet-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  emerald: "text-emerald-400",
  sky: "text-sky-400",
  slate: "text-slate-400",
};

export const CREW_EMOJI = [
  "🛡️","⚡","🔥","🌊","🦅","🐺","🐉","👾","🚀","🌌","💠","🎯","🎧","🧿","⚔️","🪐","🥇","🧠","🌠","☄️",
];

const DEFAULT_ACCENT = CREW_ACCENTS[0] as { key: CrewAccent; label: string; dot: string; glow: string; ring: string };

export function accentOf(accent: string | null | undefined) {
  return CREW_ACCENTS.find((a) => a.key === accent) ?? DEFAULT_ACCENT;
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
  avatar_url: string | null;
  join_policy: "open" | "invite";
  member_limit: number;
  visibility: "public" | "private";
  badge_style: CrewBadgeStyle;
  nametag_style: CrewNametag;
  text_effect: CrewTextEffect;
  chat_bg: CrewChatBg;
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
    .limit(120);
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
    avatar_url: string;
    accent: CrewAccent;
    visibility: "public" | "private";
    join_policy: "open" | "invite";
    badge_style: CrewBadgeStyle;
    nametag_style: CrewNametag;
    text_effect: CrewTextEffect;
    chat_bg: CrewChatBg;
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
  await joinCrew(crewId);
  return { ok: true } as { ok: boolean; error?: string };
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

/** Upload a crew picture (avatar) and save it on the crew. */
export async function uploadCrewAvatar(crewId: string, userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image");
  if (file.size > 8 * 1024 * 1024) throw new Error("Images must be under 8MB");
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/crew-avatar-${crewId}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("voice")
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: true });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage.from("voice").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Couldn't read that image back");
  await updateCrew(crewId, { avatar_url: data.signedUrl });
  return data.signedUrl;
}

export type InvitablePerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  equipped_frame: string | null;
  equipped_badge: string | null;
  last_active_at: string;
  activity_context: string | null;
  total_xp: number;
};

/** Everyone on the server, so invites can be picked from a list instead of typed. */
export async function fetchInvitablePeople(): Promise<InvitablePerson[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(`${PROFILE_FIELDS}, total_xp`)
    .order("total_xp", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as InvitablePerson[];
}

/** Add XP to a crew's shared pool (server checks membership and clamps the amount). */
export async function contributeCrewXp(crewId: string, amount: number) {
  const { data, error } = await supabase.rpc("crew_contribute_xp", {
    _crew_id: crewId,
    _amount: Math.max(0, Math.round(amount)),
  } as never);
  if (error) throw error;
  return (data ?? {}) as { ok?: boolean; added?: number; total_xp?: number; error?: string };
}

export type CrewPerk = { level: number; title: string; blurb: string };

/** What a crew earns as its shared pool grows. */
export const CREW_PERKS: CrewPerk[] = [
  { level: 1, title: "Crew formed", blurb: "Private crew chat, voice notes, images and replies." },
  { level: 2, title: "Crew colour", blurb: "Pick your accent theme — it tints the whole crew panel." },
  { level: 3, title: "Crew picture", blurb: "Swap the emoji badge for a real crew picture." },
  { level: 4, title: "Skyward unlocked", blurb: "The crew minigame starts banking XP into the pool." },
  { level: 5, title: "Crew banner", blurb: "Upload a wide banner across the top of your crew." },
  { level: 6, title: "Captains", blurb: "Promote up to two captains who can invite and customise." },
  { level: 8, title: "Voice & video rooms", blurb: "Crew calls with everyone in one room." },
  { level: 10, title: "Roster boost", blurb: "Member limit rises — bring more people in." },
  { level: 12, title: "Crew Anchor badge", blurb: "Epic badge unlocked for every member to wear." },
  { level: 15, title: "Crew Sigil banner", blurb: "Epic profile banner shared across the crew." },
  { level: 18, title: "Ladder spotlight", blurb: "Your crew is highlighted on the crew ladder." },
  { level: 20, title: "Skyward multiplier", blurb: "Skyward runs bank 1.5x XP into the crew pool." },
  { level: 25, title: "Legend crest", blurb: "A permanent legendary crest next to the crew name." },
  { level: 30, title: "Apex crew", blurb: "Top-tier status: gold ladder trim and bragging rights." },
];

export function perksUpTo(level: number) {
  return CREW_PERKS.filter((p) => p.level <= level);
}

/* --------------------------------------------------------- owner overrides */

/** Owner-only: wipe a crew completely (chat, invites, roster, crew row). */
export async function ownerDeleteCrew(crewId: string) {
  const { data, error } = await supabase.rpc("owner_delete_crew", { _crew_id: crewId });
  if (error) throw error;
  return data as unknown as { status: string; crew?: string };
}

/** Owner-only: change any field on any crew, including its shared XP pool. */
export async function ownerEditCrew(crewId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("owner_edit_crew", {
    _crew_id: crewId,
    _patch: patch as never,
  });
  if (error) throw error;
  return data as unknown as { status: string };
}

/** Owner-only: pull anyone out of any crew. */
export async function ownerRemoveCrewMember(crewId: string, userId: string) {
  const { data, error } = await supabase.rpc("owner_remove_crew_member", {
    _crew_id: crewId,
    _user_id: userId,
  });
  if (error) throw error;
  return data as unknown as { status: string };
}

/** Owner-only: hand a crew's leadership to someone else. */
export async function ownerTransferCrew(crewId: string, userId: string) {
  const { data, error } = await supabase.rpc("owner_transfer_crew", {
    _crew_id: crewId,
    _user_id: userId,
  });
  if (error) throw error;
  return data as unknown as { status: string };
}

/** Staff: delete any crew message. */
export async function staffDeleteCrewMessage(messageId: string) {
  const { data, error } = await supabase.rpc("mod_delete_crew_message", { _message_id: messageId });
  if (error) throw error;
  return data as unknown as { status: string };
}
