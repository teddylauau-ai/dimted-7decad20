/**
 * Dimted progression model.
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

/** XP required to move from `level` to `level + 1`. Grows steeply. */
export function xpForLevel(level: number): number {
  return Math.round((260 + 180 * Math.pow(level - 1, 1.32)) / 10) * 10;
}

export function levelFromTotalXp(totalXp: number): {
  level: number;
  intoLevel: number;
  needed: number;
} {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (level < 200 && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, intoLevel: remaining, needed: xpForLevel(level) };
}

export const RANKS: { from: number; name: string }[] = [
  { from: 1, name: "Newcomer" },
  { from: 2, name: "Explorer" },
  { from: 3, name: "Regular" },
  { from: 5, name: "Connected" },
  { from: 10, name: "Veteran" },
  { from: 15, name: "Elite" },
  { from: 25, name: "Legend" },
  { from: 50, name: "Mythic" },
];

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

export const UNLOCKS: Unlock[] = [
  {
    level: 2,
    name: "Profile customisation",
    detail: "Rearrange your profile and pick an accent.",
    kind: "cosmetic",
    rarity: "common",
  },
  {
    level: 3,
    name: "Custom status effects",
    detail: "Animated status states beside your name.",
    kind: "cosmetic",
    rarity: "common",
  },
  {
    level: 5,
    name: "Profile banner",
    detail: "A wide banner across the top of your profile.",
    kind: "cosmetic",
    rarity: "uncommon",
  },
  {
    level: 7,
    name: "Animated decorations",
    detail: "Orbiting avatar decorations.",
    kind: "cosmetic",
    rarity: "uncommon",
  },
  {
    level: 10,
    name: "Personal profile theme",
    detail: "Recolour your whole profile surface.",
    kind: "cosmetic",
    rarity: "rare",
  },
  {
    level: 12,
    name: "Special chat effects",
    detail: "Subtle message entrances in DMs.",
    kind: "chat",
    rarity: "rare",
  },
  {
    level: 15,
    name: "Entrance animation",
    detail: "Your arrival in a channel gets a signature.",
    kind: "chat",
    rarity: "rare",
  },
  {
    level: 20,
    name: "Arcade high-score frame",
    detail: "Your leaderboard rows get a signature glow.",
    kind: "cosmetic",
    rarity: "epic",
  },
  {
    level: 25,
    name: "Rare profile cosmetics",
    detail: "Frames and titles reserved for Legends.",
    kind: "cosmetic",
    rarity: "epic",
  },
  {
    level: 30,
    name: "Advanced community tools",
    detail: "Deep customisation for communities you run.",
    kind: "social",
    rarity: "epic",
  },
  {
    level: 40,
    name: "Legendary cosmetics",
    detail: "Aurora frames, living banners.",
    kind: "cosmetic",
    rarity: "legendary",
  },
  {
    level: 50,
    name: "Mythic profile status",
    detail: "Your name renders differently everywhere.",
    kind: "cosmetic",
    rarity: "mythic",
  },
];

export function nextUnlock(level: number): Unlock | undefined {
  return UNLOCKS.find((u) => u.level > level);
}

export function unlockAt(level: number): Unlock | undefined {
  return UNLOCKS.find((u) => u.level === level);
}

/** XP sources. Cooldowns and caps are enforced server-side, not here. */
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

export const XP_SOURCES: XpSource[] = [
  {
    id: "message",
    label: "Meaningful message",
    xp: 4,
    cooldownLabel: "max 15 / hour",
    note: "Counted once a minute at most, so volume alone earns nothing.",
  },
  {
    id: "conversation",
    label: "Two-way conversation",
    xp: 40,
    cooldownLabel: "3 / day",
    note: "Both people have to actually reply.",
  },
  {
    id: "community",
    label: "Community participation",
    xp: 60,
    cooldownLabel: "5 / day",
    note: "Posting in a channel you haven't touched recently.",
  },
  {
    id: "friend",
    label: "New friend",
    xp: 120,
    cooldownLabel: "5 / week",
    note: "Awarded when a friend request is accepted.",
  },
  {
    id: "arcade",
    label: "Arcade run",
    xp: 200,
    cooldownLabel: "18 / day",
    note: "Scales with your score. Beat your personal best for a bonus — no other players needed.",
  },
  {
    id: "activity",
    label: "Social activity",
    xp: 100,
    cooldownLabel: "4 / day",
    note: "Doing something with another real account.",
  },
  {
    id: "challenge",
    label: "Challenge complete",
    xp: 150,
    cooldownLabel: "6 / day",
    note: "Daily and weekly challenge rewards.",
  },
  {
    id: "discovery",
    label: "Discovery",
    xp: 80,
    cooldownLabel: "6 / day",
    note: "Finding a new community or secret.",
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
  communities: number;
  activities: number;
  discoveries: number;
  bestFriendshipLevel: number;
};

export const EMPTY_STATS: PlayerStats = {
  level: 1,
  totalXp: 0,
  friends: 0,
  messagesSent: 0,
  communities: 0,
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
    detail: "Create a community.",
    rarity: "rare",
    earned: (s) => s.communities >= 1,
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
  { id: "i1", name: "First Light", type: "Badge", rarity: "common", requiredLevel: 1, source: "Joining Dimted" },
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
