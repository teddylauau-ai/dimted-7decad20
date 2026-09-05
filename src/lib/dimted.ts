/**
 * Lazu progression model.
 * Pure data + math — no React, no mock people, safe to import anywhere.
 *
 * Everything here is a *definition* (a ladder, a catalogue, a rule).
 * Every actual value — XP, levels, friends, communities, messages —
 * comes from the signed-in account in the database.
 */

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

/**
 * The ladder tops out here, and the whole curve is tuned so a real person can
 * actually walk it: an active day is worth roughly 2–4k XP (arcade runs, chat,
 * quests, Pulse clears), so the last rank lands around two months of play
 * instead of the mathematically impossible grind the old curve implied.
 */
export const MAX_LEVEL = 100;

/**
 * XP required to move from `level` to `level + 1`. Two-stage curve: levels 1–69
 * are deliberately breezy (a single arcade run covers the first few), then the
 * climb from 70 to 100 turns into a real grind that carries most of the total.
 */
export function xpForLevel(level: number): number {
  const l = Math.min(Math.max(level, 1), MAX_LEVEL);
  if (l < 70) return Math.round((40 + 4 * Math.pow(l - 1, 1.35)) / 10) * 10;
  return Math.round((1200 + 174 * Math.pow(l - 69, 1.35)) / 10) * 10;
}


/** Total XP needed to reach a level from scratch — used for planning/UI. */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) sum += xpForLevel(l);
  return sum;
}

/**
 * The hard XP ceiling: exactly the XP needed for Level 100. Nothing — earning,
 * quests or an Owner grant — can push an account past this, so a total like
 * 100,000 over the cap can never happen.
 */
export const MAX_TOTAL_XP = totalXpForLevel(MAX_LEVEL);

/** True once an account has topped the ladder — the bar shows full / "MAXED". */
export function isMaxed(level: number): boolean {
  return level >= MAX_LEVEL;
}

/** Bar caption: "MAXED" at the top of the ladder, otherwise "into / needed XP". */
export function xpLabel(level: number, intoLevel: number, needed: number): string {
  if (isMaxed(level)) return "MAXED";
  return `${intoLevel.toLocaleString()} / ${needed.toLocaleString()} XP`;
}

export function levelFromTotalXp(totalXp: number): {
  level: number;
  intoLevel: number;
  needed: number;
} {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (level < MAX_LEVEL && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  // At the top of the ladder there is no Level 101 to fill towards, so the bar
  // reads as complete instead of dangling an unreachable requirement.
  if (level >= MAX_LEVEL) {
    const cap = xpForLevel(MAX_LEVEL - 1);
    return { level: MAX_LEVEL, intoLevel: cap, needed: cap };
  }
  return { level, intoLevel: remaining, needed: xpForLevel(level) };
}


export const RANKS: { from: number; name: string }[] = [
  { from: 1, name: "Newcomer" },
  { from: 2, name: "Drifter" },
  { from: 3, name: "Signal" },
  { from: 5, name: "Regular" },
  { from: 7, name: "Connected" },
  { from: 10, name: "Veteran" },
  { from: 13, name: "Nightwatch" },
  { from: 16, name: "Vanguard" },
  { from: 20, name: "Elite" },
  { from: 25, name: "Luminary" },
  { from: 30, name: "Ascendant" },
  { from: 35, name: "Paragon" },
  { from: 40, name: "Legend" },
  { from: 45, name: "Eclipse" },
  { from: 50, name: "Mythic" },
  { from: 60, name: "Astral" },
  { from: 75, name: "Voidwalker" },
  { from: 90, name: "Sovereign" },
  { from: 100, name: "Apex Prime" },
];

/** The next rank you haven't reached yet — used to dangle the carrot. */
export function nextRank(level: number): { from: number; name: string } | undefined {
  return RANKS.find((r) => r.from > level);
}

export function rankForLevel(level: number): string {
  let name = RANKS[0]!.name;
  for (const r of RANKS) if (level >= r.from) name = r.name;
  return name;
}

export type Unlock = {
  level: number;
  name: string;
  detail: string;
  kind: "cosmetic" | "arcade" | "social" | "chat" | "secret";
  rarity: Rarity;
};

/**
 * The real level ladder. Every entry below MUST describe something the app
 * actually does at that level — no teasers, no "coming soon", no free items
 * that are really Sparks purchases.
 */
export const UNLOCKS: Unlock[] = [
  {
    level: 2,
    name: "Profile editing",
    detail: "The Edit profile button turns on: display name, bio, avatar, banner.",
    kind: "cosmetic",
    rarity: "common",
  },
  {
    level: 3,
    name: "Profile widgets",
    detail: "Rearrange the widget grid on your profile and pick what it shows.",
    kind: "cosmetic",
    rarity: "common",
  },
  {
    level: 5,
    name: "Uncommon shop stock",
    detail: "Uncommon frames and banners become buyable in the shop with Sparks.",
    kind: "cosmetic",
    rarity: "uncommon",
  },
  {
    level: 10,
    name: "Rank: Veteran",
    detail: "New rank pill beside your name, plus rare shop stock unlocks (bought with Sparks).",
    kind: "social",
    rarity: "rare",
  },
  {
    level: 11,
    name: "Title: Night Owl",
    detail: "A free title you can equip under your name from your profile.",
    kind: "cosmetic",
    rarity: "rare",
  },
  {
    level: 16,
    name: "Title: Arcade Regular + rank Vanguard",
    detail: "Free title, new rank pill. Rare shop items up to Level 16 are all buyable.",
    kind: "social",
    rarity: "rare",
  },
  {
    level: 18,
    name: "Epic shop stock",
    detail: "Epic frames, nametags and banners appear in the shop — Sparks price, not free.",
    kind: "cosmetic",
    rarity: "epic",
  },
  {
    level: 20,
    name: "Rank: Elite + title World Explorer",
    detail: "Free title, Elite rank pill, and Elite styling on leaderboard rows.",
    kind: "social",
    rarity: "epic",
  },
  {
    level: 25,
    name: "Rank: Luminary + legendary shop stock",
    detail: "Free title Social Architect, and legendary shop items become buyable with Sparks.",
    kind: "cosmetic",
    rarity: "legendary",
  },
  {
    level: 30,
    name: "Rank: Ascendant + title Conversation Master",
    detail: "Free title and rank pill. Weekly legendary rotation is fully available to you.",
    kind: "social",
    rarity: "legendary",
  },
  {
    level: 40,
    name: "Rank: Legend + mythic shop stock",
    detail: "Free Legend title, Legend rank, and the first mythic items unlock in the shop (Sparks).",
    kind: "cosmetic",
    rarity: "mythic",
  },
  {
    level: 50,
    name: "Rank: Mythic",
    detail: "Mythic rank styling everywhere, and every mythic shop item is level-unlocked.",
    kind: "cosmetic",
    rarity: "mythic",
  },
  {
    level: 60,
    name: "Rank: Astral",
    detail: "Astral rank pill and ladder styling.",
    kind: "social",
    rarity: "mythic",
  },
  {
    level: 75,
    name: "Rank: Voidwalker",
    detail: "Voidwalker rank pill and ladder styling.",
    kind: "social",
    rarity: "mythic",
  },
  {
    level: 90,
    name: "Rank: Sovereign",
    detail: "Sovereign rank pill and ladder styling.",
    kind: "social",
    rarity: "mythic",
  },
  {
    level: 100,
    name: "Rank: Apex Prime (max)",
    detail: "Your bar reads MAXED and your ladder row shows how early you got there.",
    kind: "social",
    rarity: "mythic",
  },
];

export function nextUnlock(level: number): Unlock | undefined {
  return UNLOCKS.find((u) => u.level > level);
}

export function unlockAt(level: number): Unlock | undefined {
  return UNLOCKS.find((u) => u.level === level);
}

/**
 * Exactly what a player receives on reaching `level`, derived from the same
 * data the app enforces. Used so the ladder never promises anything extra.
 */
export function rewardsAtLevel(level: number): string[] {
  const out: string[] = [];
  const rank = RANKS.find((r) => r.from === level);
  if (rank) out.push(`Rank: ${rank.name}`);
  for (const t of TITLES) if (t.requiredLevel === level) out.push(`Free title: ${t.name}`);
  for (const i of ITEMS) if (i.requiredLevel === level) out.push(`Free ${i.type.toLowerCase()}: ${i.name}`);
  const u = unlockAt(level);
  if (u && !u.name.startsWith("Rank:")) out.push(u.name);
  if (level === 2) out.push("Profile editing turns on");
  if (level === 3) out.push("Profile widget layout editing");
  return out;
}


/** XP sources. Awarded server-side every time, with no cooldowns or caps. */
export type XpSourceId =
  | "message"
  | "conversation"
  | "community"
  | "friend"
  | "activity"
  | "arcade"
  | "challenge"
  | "discovery";

export type XpSource = {
  id: XpSourceId;
  label: string;
  xp: number;
  cooldownLabel: string;
  note: string;
};

/**
 * These numbers are the real server-side base amounts used by the `award_xp`
 * and `award_arcade_xp` database functions. Keep them in sync — the login page
 * and Home ladder advertise them directly.
 *
 * Every award is scaled by +4% per level you already have, and doubled while a
 * Surge is active.
 */
export const XP_SOURCES: XpSource[] = [
  {
    id: "message",
    label: "Message sent",
    xp: 12,
    cooldownLabel: "no limit",
    note: "Every message in a DM, General or crew chat. Voice notes and images count too.",
  },
  {
    id: "conversation",
    label: "Two-way conversation",
    xp: 90,
    cooldownLabel: "no limit",
    note: "Both people have to actually reply.",
  },
  {
    id: "community",
    label: "General chat post",
    xp: 110,
    cooldownLabel: "no limit",
    note: "Posting in the shared General chat.",
  },
  {
    id: "friend",
    label: "New friend",
    xp: 220,
    cooldownLabel: "no limit",
    note: "Awarded when a friend request is accepted.",
  },
  {
    id: "arcade",
    label: "Arcade or Pulse Rush run",
    xp: 55,
    cooldownLabel: "no limit",
    note: "55 base plus 4.4 per √score, up to 650. A new personal best adds 90.",
  },
  {
    id: "activity",
    label: "Social activity",
    xp: 180,
    cooldownLabel: "no limit",
    note: "Doing something with another real account.",
  },
  {
    id: "challenge",
    label: "Quest complete",
    xp: 260,
    cooldownLabel: "no limit",
    note: "Daily and weekly quest rewards.",
  },
  {
    id: "discovery",
    label: "Discovery",
    xp: 140,
    cooldownLabel: "no limit",
    note: "Finding a new crew or secret.",
  },
];

/* ---------------------------------------------------------------- friendship */

export const FRIENDSHIP_TIERS = [
  { level: 1, name: "Met" },
  { level: 2, name: "Familiar" },
  { level: 3, name: "Connected" },
  { level: 5, name: "Close" },
  { level: 10, name: "Legendary Duo" },
];

export function friendshipLevel(xp: number): {
  level: number;
  into: number;
  needed: number;
  name: string;
} {
  let level = 1;
  let remaining = Math.max(0, xp);
  let needed = 200;
  while (level < 10 && remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = Math.round((200 + 120 * Math.pow(level - 1, 1.25)) / 10) * 10;
  }
  let name = FRIENDSHIP_TIERS[0]!.name;
  for (const t of FRIENDSHIP_TIERS) if (level >= t.level) name = t.name;
  return { level, into: remaining, needed, name };
}

/* ---------------------------------------------------------------- community */

export function communityLevel(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let remaining = Math.max(0, xp);
  let needed = 400;
  while (level < 100 && remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = Math.round((400 + 260 * Math.pow(level - 1, 1.3)) / 10) * 10;
  }
  return { level, into: remaining, needed };
}

export const COMMUNITY_UNLOCKS: { level: number; name: string }[] = [
  { level: 2, name: "Extra channels" },
  { level: 5, name: "Custom role colours" },
  { level: 10, name: "Community decorations" },
  { level: 15, name: "Animated community background" },
  { level: 25, name: "Larger shared space" },
];

export function nextCommunityUnlock(level: number) {
  return COMMUNITY_UNLOCKS.find((u) => u.level > level);
}

/* ---------------------------------------------------------------- challenges */

export type ChallengeDef = {
  id: string;
  cadence: "daily" | "weekly";
  title: string;
  source: XpSourceId;
  goal: number;
  rewardXp: number;
  rarity: Rarity;
};

/** Progress is counted from your real XP log, never stored as a fake number. */
export const CHALLENGES: ChallengeDef[] = [
  {
    id: "d-message",
    cadence: "daily",
    title: "Have a conversation with someone",
    source: "conversation",
    goal: 1,
    rewardXp: 100,
    rarity: "common",
  },
  {
    id: "d-community",
    cadence: "daily",
    title: "Post in a community channel",
    source: "community",
    goal: 1,
    rewardXp: 150,
    rarity: "uncommon",
  },
  {
    id: "d-activity",
    cadence: "daily",
    title: "Play 3 arcade runs",
    source: "activity",
    goal: 1,
    rewardXp: 100,
    rarity: "uncommon",
  },
  {
    id: "w-community",
    cadence: "weekly",
    title: "Take part in 3 community sessions",
    source: "community",
    goal: 3,
    rewardXp: 400,
    rarity: "rare",
  },
  {
    id: "w-activity",
    cadence: "weekly",
    title: "Play 5 arcade runs",
    source: "arcade",
    goal: 5,
    rewardXp: 500,
    rarity: "rare",
  },
  {
    id: "w-friend",
    cadence: "weekly",
    title: "Make a new friend",
    source: "friend",
    goal: 1,
    rewardXp: 300,
    rarity: "uncommon",
  },
  {
    id: "w-discovery",
    cadence: "weekly",
    title: "Discover 3 new things",
    source: "discovery",
    goal: 3,
    rewardXp: 250,
    rarity: "epic",
  },
];

/* ---------------------------------------------------------------- activities */

/* -------------------------------------------------------------- achievements */

/** Live counters read from the database, used to decide what you've earned. */
export type PlayerStats = {
  level: number;
  totalXp: number;
  friends: number;
  messagesSent: number;
  crews: number;
  activities: number;
  discoveries: number;
  bestFriendshipLevel: number;
};

export const EMPTY_STATS: PlayerStats = {
  level: 1,
  totalXp: 0,
  friends: 0,
  messagesSent: 0,
  crews: 0,
  activities: 0,
  discoveries: 0,
  bestFriendshipLevel: 0,
};

export type Achievement = {
  id: string;
  category: "Social" | "Community" | "Exploration" | "Gaming" | "Collection" | "Progression" | "Secret";
  name: string;
  detail: string;
  rarity: Rarity;
  earned: (s: PlayerStats) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "a1",
    category: "Social",
    name: "First Connection",
    detail: "Send your first message.",
    rarity: "common",
    earned: (s) => s.messagesSent >= 1,
  },
  {
    id: "a2",
    category: "Social",
    name: "Close Quarters",
    detail: "Reach Friendship Level 5 with anyone.",
    rarity: "uncommon",
    earned: (s) => s.bestFriendshipLevel >= 5,
  },
  {
    id: "a3",
    category: "Social",
    name: "Five Deep",
    detail: "Make five friends.",
    rarity: "uncommon",
    earned: (s) => s.friends >= 5,
  },
  {
    id: "a4",
    category: "Community",
    name: "Founder",
    detail: "Create or join a crew.",
    rarity: "rare",
    earned: (s) => s.crews >= 1,
  },
  {
    id: "a5",
    category: "Exploration",
    name: "Off The Path",
    detail: "Make three discoveries.",
    rarity: "rare",
    earned: (s) => s.discoveries >= 3,
  },
  {
    id: "a6",
    category: "Gaming",
    name: "Steady Hand",
    detail: "Finish three arcade runs.",
    rarity: "uncommon",
    earned: (s) => s.activities >= 3,
  },
  {
    id: "a7",
    category: "Collection",
    name: "Curator",
    detail: "Unlock ten items.",
    rarity: "rare",
    earned: (s) => s.level >= 20,
  },
  {
    id: "a8",
    category: "Progression",
    name: "Elite",
    detail: "Reach Level 15.",
    rarity: "epic",
    earned: (s) => s.level >= 15,
  },
  {
    id: "a9",
    category: "Progression",
    name: "Mythic",
    detail: "Reach Level 50.",
    rarity: "mythic",
    earned: (s) => s.level >= 50,
  },
  {
    id: "a10",
    category: "Secret",
    name: "???",
    detail: "Something is waiting here.",
    rarity: "mythic",
    earned: () => false,
  },
];

/* ------------------------------------------------------------------ catalogue */

export type Item = {
  id: string;
  name: string;
  type:
    | "Badge"
    | "Decoration"
    | "Trophy"
    | "Frame"
    | "Effect"
    | "Title"
    | "Companion"
    | "Collectible";
  rarity: Rarity;
  requiredLevel: number;
  source: string;
};

/** You own an item once you've reached the level that unlocks it. */
export const ITEMS: Item[] = [
  { id: "i1", name: "First Light", type: "Badge", rarity: "common", requiredLevel: 1, source: "Joining Lazu" },
  { id: "i2", name: "Quiet Bell", type: "Trophy", rarity: "common", requiredLevel: 2, source: "Level 2" },
  { id: "i3", name: "Tideline", type: "Frame", rarity: "uncommon", requiredLevel: 5, source: "Level 5" },
  { id: "i4", name: "Low Hum", type: "Effect", rarity: "uncommon", requiredLevel: 7, source: "Level 7" },
  { id: "i5", name: "Lantern Moth", type: "Companion", rarity: "rare", requiredLevel: 9, source: "Level 9" },
  { id: "i6", name: "Night Owl", type: "Title", rarity: "uncommon", requiredLevel: 11, source: "Level 11" },
  { id: "i7", name: "Sealed Door", type: "Trophy", rarity: "rare", requiredLevel: 16, source: "Level 16" },
  { id: "i8", name: "Duo Sigil", type: "Decoration", rarity: "epic", requiredLevel: 20, source: "Level 20" },
  { id: "i9", name: "Drift Pennant", type: "Decoration", rarity: "rare", requiredLevel: 24, source: "Level 24" },
  { id: "i10", name: "Conversation Master", type: "Title", rarity: "epic", requiredLevel: 30, source: "Level 30" },
  { id: "i11", name: "Aurora Frame", type: "Frame", rarity: "legendary", requiredLevel: 40, source: "Level 40" },
  { id: "i12", name: "The First Dawn", type: "Collectible", rarity: "mythic", requiredLevel: 50, source: "Level 50" },
];

export const TITLES: { name: string; requiredLevel: number }[] = [
  { name: "Newcomer", requiredLevel: 1 },
  { name: "Explorer", requiredLevel: 2 },
  { name: "Regular", requiredLevel: 3 },
  { name: "Night Owl", requiredLevel: 11 },
  { name: "Arcade Regular", requiredLevel: 16 },
  { name: "World Explorer", requiredLevel: 20 },
  { name: "Social Architect", requiredLevel: 25 },
  { name: "Conversation Master", requiredLevel: 30 },
  { name: "Legend", requiredLevel: 40 },
];

export type Secret = {
  id: string;
  hint: string;
  requiredLevel: number;
};

export const SECRETS: Secret[] = [
  { id: "s1", hint: "Something is waiting here…", requiredLevel: 5 },
  { id: "s2", hint: "A door that only opens after dark…", requiredLevel: 12 },
  { id: "s3", hint: "Nobody has reported this one yet…", requiredLevel: 19 },
  { id: "s4", hint: "It appears once your arcade streak is long enough…", requiredLevel: 30 },
];
