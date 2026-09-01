/**
 * DIMTED progression model.
 * Pure data + math — no React, safe to import anywhere.
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
  let remaining = totalXp;
  // Cap keeps the loop bounded even for absurd XP values.
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
  let name = RANKS[0].name;
  for (const r of RANKS) if (level >= r.from) name = r.name;
  return name;
}

export type Unlock = {
  level: number;
  name: string;
  detail: string;
  kind: "cosmetic" | "realm" | "social" | "chat" | "secret";
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
    name: 'Personal "Space"',
    detail: "A visitable public wing of your Realm.",
    kind: "realm",
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

/** XP sources — with cooldowns so nothing rewards spam. */
export type XpSource = {
  id: string;
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
    note: "Only counted once per minute, per conversation.",
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
    cooldownLabel: "per community, daily",
    note: "Posting in a channel you haven't touched today.",
  },
  {
    id: "friend",
    label: "New friend",
    xp: 120,
    cooldownLabel: "5 / week",
    note: "Awarded after your first real exchange.",
  },
  {
    id: "activity",
    label: "DIMTED activity",
    xp: 100,
    cooldownLabel: "4 / day",
    note: "Finishing a social activity with someone.",
  },
  {
    id: "challenge",
    label: "Challenge complete",
    xp: 150,
    cooldownLabel: "per challenge",
    note: "Daily and weekly challenge rewards.",
  },
  {
    id: "discovery",
    label: "Discovery",
    xp: 80,
    cooldownLabel: "once each",
    note: "Finding a new community, realm or secret.",
  },
];

export type Friend = {
  id: string;
  name: string;
  handle: string;
  title: string;
  level: number;
  friendshipXp: number;
  streak: number;
  online: boolean;
  accent: Rarity;
  lastMessage: string;
  unread: number;
};

export const FRIENDSHIP_TIERS = [
  { level: 1, name: "Met" },
  { level: 2, name: "Familiar" },
  { level: 3, name: "Connected" },
  { level: 5, name: "Close" },
  { level: 10, name: "Legendary Duo" },
];

export function friendshipLevel(xp: number): { level: number; into: number; needed: number; name: string } {
  let level = 1;
  let remaining = xp;
  let needed = 200;
  while (level < 10 && remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = Math.round((200 + 120 * Math.pow(level - 1, 1.25)) / 10) * 10;
  }
  let name = FRIENDSHIP_TIERS[0].name;
  for (const t of FRIENDSHIP_TIERS) if (level >= t.level) name = t.name;
  return { level, into: remaining, needed, name };
}

export const FRIENDS: Friend[] = [
  {
    id: "alex",
    name: "Alex Rhen",
    handle: "@alexr",
    title: "Realm Builder",
    level: 22,
    friendshipXp: 1180,
    streak: 12,
    online: true,
    accent: "rare",
    lastMessage: "found a sealed door under your east terrace 👀",
    unread: 2,
  },
  {
    id: "sam",
    name: "Samira Ode",
    handle: "@sami",
    title: "Conversation Master",
    level: 20,
    friendshipXp: 760,
    streak: 5,
    online: true,
    accent: "epic",
    lastMessage: "quickdraw rematch. you owe me one.",
    unread: 0,
  },
  {
    id: "jordan",
    name: "Jordan Vale",
    handle: "@jvale",
    title: "World Explorer",
    level: 17,
    friendshipXp: 420,
    streak: 0,
    online: false,
    accent: "uncommon",
    lastMessage: "the third portal only opens at night, apparently",
    unread: 1,
  },
  {
    id: "taylor",
    name: "Taylor Bex",
    handle: "@tbex",
    title: "Night Owl",
    level: 11,
    friendshipXp: 240,
    streak: 3,
    online: true,
    accent: "common",
    lastMessage: "chaos questions when you're free?",
    unread: 0,
  },
  {
    id: "chris",
    name: "Chris Nolde",
    handle: "@nolde",
    title: "Social Architect",
    level: 9,
    friendshipXp: 90,
    streak: 1,
    online: false,
    accent: "common",
    lastMessage: "made a community event for saturday",
    unread: 0,
  },
];

export type Community = {
  id: string;
  name: string;
  tagline: string;
  level: number;
  xpInto: number;
  xpNeeded: number;
  members: number;
  online: number;
  accent: Rarity;
  channels: { name: string; topic: string; live?: boolean }[];
  unlockNext: string;
};

export const COMMUNITIES: Community[] = [
  {
    id: "driftworks",
    name: "Driftworks",
    tagline: "Slow-built worlds and long conversations.",
    level: 14,
    xpInto: 4200,
    xpNeeded: 6000,
    members: 1284,
    online: 96,
    accent: "epic",
    channels: [
      { name: "atrium", topic: "say something true", live: true },
      { name: "realm-showcase", topic: "post your builds" },
      { name: "late-shift", topic: "for the 2am people" },
      { name: "challenge-hall", topic: "community challenge: 62%" },
    ],
    unlockNext: "Level 15 · animated community background",
  },
  {
    id: "signal",
    name: "Signal Garden",
    tagline: "Small, quiet, deliberately unhurried.",
    level: 8,
    xpInto: 1100,
    xpNeeded: 2400,
    members: 212,
    online: 18,
    accent: "rare",
    channels: [
      { name: "greenhouse", topic: "one thought per day" },
      { name: "shared-realm", topic: "our co-owned space", live: true },
      { name: "questions", topic: "chaos questions archive" },
    ],
    unlockNext: "Level 10 · custom role colours",
  },
  {
    id: "cartographers",
    name: "The Cartographers",
    tagline: "Mapping every secret in DIMTED.",
    level: 21,
    xpInto: 8100,
    xpNeeded: 11000,
    members: 3410,
    online: 288,
    accent: "legendary",
    channels: [
      { name: "expedition", topic: "week 4: the first dimension", live: true },
      { name: "found", topic: "48 secrets confirmed" },
      { name: "rumours", topic: "unverified sightings" },
      { name: "duo-quests", topic: "find a partner" },
    ],
    unlockNext: "Level 25 · larger community space",
  },
];

export type Challenge = {
  id: string;
  cadence: "daily" | "weekly";
  title: string;
  progress: number;
  goal: number;
  rewardXp: number;
  rewardItem?: string;
  rarity: Rarity;
};

export const CHALLENGES: Challenge[] = [
  { id: "c1", cadence: "daily", title: "Talk with 3 friends", progress: 3, goal: 3, rewardXp: 100, rarity: "common" },
  {
    id: "c2",
    cadence: "daily",
    title: "Discover a new community",
    progress: 1,
    goal: 1,
    rewardXp: 150,
    rarity: "uncommon",
  },
  {
    id: "c3",
    cadence: "daily",
    title: "Play a DIMTED activity",
    progress: 0,
    goal: 1,
    rewardXp: 100,
    rewardItem: "Realm object",
    rarity: "uncommon",
  },
  {
    id: "c4",
    cadence: "weekly",
    title: "Participate in 3 communities",
    progress: 2,
    goal: 3,
    rewardXp: 400,
    rarity: "rare",
  },
  {
    id: "c5",
    cadence: "weekly",
    title: "Complete 5 social activities",
    progress: 3,
    goal: 5,
    rewardXp: 500,
    rewardItem: "Frame: Tidewalker",
    rarity: "rare",
  },
  {
    id: "c6",
    cadence: "weekly",
    title: "Invite a friend to your Realm",
    progress: 1,
    goal: 1,
    rewardXp: 300,
    rarity: "uncommon",
  },
  { id: "c7", cadence: "weekly", title: "Earn 2,000 XP", progress: 1240, goal: 2000, rewardXp: 250, rarity: "epic" },
];

export type Activity = {
  id: string;
  name: string;
  players: string;
  minutes: number;
  blurb: string;
  rewardXp: number;
  rarity: Rarity;
  requiredLevel?: number;
};

export const ACTIVITIES: Activity[] = [
  {
    id: "quickdraw",
    name: "Quickdraw",
    players: "2 friends",
    minutes: 2,
    blurb: "You both get the same strange prompt and 30 seconds to draw it. Then you compare the damage.",
    rewardXp: 100,
    rarity: "common",
  },
  {
    id: "guess",
    name: "Guess the Message",
    players: "3–12 in a community",
    minutes: 5,
    blurb: "An anonymous line from the channel appears. Everyone guesses who wrote it.",
    rewardXp: 120,
    rarity: "uncommon",
  },
  {
    id: "chaos",
    name: "Chaos Questions",
    players: "2–8 friends",
    minutes: 4,
    blurb: "Answer questions nobody should have to answer, then reveal all at once.",
    rewardXp: 110,
    rarity: "uncommon",
  },
  {
    id: "hidden",
    name: "Hidden Object",
    players: "2–4 in a Realm",
    minutes: 6,
    blurb: "Explore a friend's Realm looking for things they didn't know were there.",
    rewardXp: 140,
    rarity: "rare",
  },
  {
    id: "duo",
    name: "Duo Quest",
    players: "exactly 2",
    minutes: 8,
    blurb: "A short cooperative run. Raises your Friendship Level directly.",
    rewardXp: 180,
    rarity: "rare",
    requiredLevel: 8,
  },
  {
    id: "community-challenge",
    name: "Community Challenge",
    players: "whole community",
    minutes: 0,
    blurb: "Everyone contributes toward one shared goal. Progress carries over between days.",
    rewardXp: 220,
    rarity: "epic",
  },
  {
    id: "predict",
    name: "Predict",
    players: "3–10 friends",
    minutes: 5,
    blurb: "Guess what your friends will choose before anything is revealed.",
    rewardXp: 130,
    rarity: "uncommon",
  },
];

export type Achievement = {
  id: string;
  category: "Social" | "Community" | "Exploration" | "Gaming" | "Collection" | "Progression" | "Secret";
  name: string;
  detail: string;
  earned: boolean;
  rarity: Rarity;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "a1",
    category: "Social",
    name: "First Connection",
    detail: "You sent your first message.",
    earned: true,
    rarity: "common",
  },
  {
    id: "a2",
    category: "Social",
    name: "Seven Days With Alex",
    detail: "Held a conversation across seven days.",
    earned: true,
    rarity: "uncommon",
  },
  {
    id: "a3",
    category: "Community",
    name: "Community Explorer",
    detail: "Participated in five different channels.",
    earned: true,
    rarity: "uncommon",
  },
  {
    id: "a4",
    category: "Community",
    name: "Social Architect",
    detail: "Created your first community event.",
    earned: false,
    rarity: "rare",
  },
  {
    id: "a5",
    category: "Exploration",
    name: "Off The Path",
    detail: "Found an area nobody linked you to.",
    earned: true,
    rarity: "rare",
  },
  {
    id: "a6",
    category: "Gaming",
    name: "Steady Hand",
    detail: "Won three Quickdraws in a row.",
    earned: true,
    rarity: "uncommon",
  },
  {
    id: "a7",
    category: "Collection",
    name: "Curator",
    detail: "Collected 25 items.",
    earned: false,
    rarity: "rare",
  },
  {
    id: "a8",
    category: "Progression",
    name: "Elite",
    detail: "Reached Level 15.",
    earned: true,
    rarity: "epic",
  },
  {
    id: "a9",
    category: "Progression",
    name: "Mythic",
    detail: "Reached Level 50.",
    earned: false,
    rarity: "mythic",
  },
  {
    id: "a10",
    category: "Secret",
    name: "???",
    detail: "Something is waiting here.",
    earned: false,
    rarity: "secret" as Rarity,
  },
];

export type Item = {
  id: string;
  name: string;
  type: "Badge" | "Decoration" | "Realm object" | "Frame" | "Effect" | "Title" | "Companion" | "Collectible";
  rarity: Rarity;
  owned: boolean;
  source: string;
};

export const ITEMS: Item[] = [
  { id: "i1", name: "First Light", type: "Badge", rarity: "common", owned: true, source: "First message" },
  { id: "i2", name: "Tideline", type: "Frame", rarity: "uncommon", owned: true, source: "Level 5" },
  { id: "i3", name: "Low Hum", type: "Effect", rarity: "uncommon", owned: true, source: "Quickdraw x10" },
  { id: "i4", name: "Lantern Moth", type: "Companion", rarity: "rare", owned: true, source: "Hidden Object" },
  { id: "i5", name: "Sealed Door", type: "Realm object", rarity: "rare", owned: true, source: "Secret area" },
  { id: "i6", name: "Night Owl", type: "Title", rarity: "uncommon", owned: true, source: "50 late conversations" },
  { id: "i7", name: "Aurora Frame", type: "Frame", rarity: "legendary", owned: false, source: "Level 40" },
  { id: "i8", name: "Duo Sigil", type: "Decoration", rarity: "epic", owned: true, source: "Friendship Level 5" },
  { id: "i9", name: "The First Dawn", type: "Collectible", rarity: "mythic", owned: false, source: "Unknown" },
  { id: "i10", name: "Quiet Bell", type: "Realm object", rarity: "common", owned: true, source: "Daily challenge" },
  { id: "i11", name: "Drift Pennant", type: "Decoration", rarity: "rare", owned: true, source: "Driftworks Lv 10" },
  { id: "i12", name: "Conversation Master", type: "Title", rarity: "epic", owned: false, source: "300 conversations" },
];

export const TITLES = [
  { name: "Night Owl", owned: true },
  { name: "Explorer", owned: true },
  { name: "Realm Builder", owned: true },
  { name: "World Explorer", owned: false },
  { name: "Social Architect", owned: false },
  { name: "Community Veteran", owned: false },
  { name: "Conversation Master", owned: false },
  { name: "Legend", owned: false },
];

export type RealmObject = {
  id: string;
  name: string;
  kind: "Building" | "Decoration" | "Portal" | "Companion" | "Area" | "Secret";
  level: number;
  owned: boolean;
  rarity: Rarity;
  note: string;
  x: number;
  y: number;
  size: number;
};

export const REALM_OBJECTS: RealmObject[] = [
  { id: "r1", name: "The Quiet Shore", kind: "Area", level: 1, owned: true, rarity: "common", note: "Where you started.", x: 50, y: 74, size: 74 },
  { id: "r2", name: "Lamp Post", kind: "Decoration", level: 2, owned: true, rarity: "common", note: "First thing you placed.", x: 26, y: 66, size: 30 },
  { id: "r3", name: "Listening Room", kind: "Building", level: 6, owned: true, rarity: "uncommon", note: "Friends leave messages inside.", x: 68, y: 58, size: 58 },
  { id: "r4", name: "Lantern Moth", kind: "Companion", level: 9, owned: true, rarity: "rare", note: "Follows visitors around.", x: 41, y: 47, size: 26 },
  { id: "r5", name: "Tide Portal", kind: "Portal", level: 13, owned: true, rarity: "rare", note: "Leads to a friend's Realm.", x: 82, y: 40, size: 42 },
  { id: "r6", name: "Sealed Door", kind: "Secret", level: 16, owned: true, rarity: "epic", note: "Alex found it. Still sealed.", x: 15, y: 38, size: 34 },
  { id: "r7", name: "Personal Space", kind: "Area", level: 20, owned: false, rarity: "epic", note: "A public wing others can visit.", x: 58, y: 26, size: 62 },
  { id: "r8", name: "Observatory", kind: "Building", level: 24, owned: false, rarity: "epic", note: "See other Realms from above.", x: 33, y: 20, size: 50 },
  { id: "r9", name: "The First Dimension", kind: "Secret", level: 30, owned: false, rarity: "mythic", note: "Nobody will explain this one.", x: 74, y: 12, size: 36 },
];

export type FeedEvent = {
  id: string;
  who: string;
  what: string;
  highlight?: string;
  when: string;
  tone: Rarity;
};

export const FEED: FeedEvent[] = [
  { id: "f1", who: "Alex", what: "unlocked a new Realm area", highlight: "Observatory", when: "2m", tone: "rare" },
  { id: "f2", who: "Samira", what: "reached", highlight: "Level 20", when: "14m", tone: "legendary" },
  { id: "f3", who: "Jordan", what: "discovered a", highlight: "Secret Area", when: "38m", tone: "epic" },
  { id: "f4", who: "Chris & Taylor", what: "reached", highlight: "Friendship Level 5", when: "1h", tone: "uncommon" },
  { id: "f5", who: "The Cartographers", what: "completed a", highlight: "Community Challenge", when: "2h", tone: "rare" },
  { id: "f6", who: "Driftworks", what: "opened a new channel", highlight: "late-shift", when: "3h", tone: "common" },
  { id: "f7", who: "Samira", what: "won", highlight: "Quickdraw", when: "4h", tone: "common" },
];

export type Secret = {
  id: string;
  hint: string;
  requirement: string;
  unlocked: boolean;
  revealed?: string;
};

export const SECRETS: Secret[] = [
  { id: "s1", hint: "Something is waiting here…", requirement: "Reach Level 19", unlocked: false },
  { id: "s2", hint: "A door that only opens twice.", requirement: "Visit 5 Realms", unlocked: false },
  {
    id: "s3",
    hint: "The Sealed Door",
    requirement: "Found with a friend",
    unlocked: true,
    revealed: "Opens during THE FIRST DIMENSION event.",
  },
  { id: "s4", hint: "Heard, never seen.", requirement: "Talk after 3am, seven times", unlocked: false },
];

export const EVENTS = [
  {
    id: "e1",
    name: "The First Dimension",
    status: "Live now",
    blurb: "A mysterious area has appeared at the edge of every Realm. It is not the same for everyone.",
    ends: "6 days",
    rarity: "mythic" as Rarity,
  },
  {
    id: "e2",
    name: "Community War",
    status: "Starts Friday",
    blurb: "Communities pool their activity into cooperative challenges. Cooperative, not competitive-cruel.",
    ends: "in 3 days",
    rarity: "legendary" as Rarity,
  },
  {
    id: "e3",
    name: "Exploration Week",
    status: "Next month",
    blurb: "Hidden objects seeded across DIMTED. Finding them together counts double.",
    ends: "—",
    rarity: "epic" as Rarity,
  },
  {
    id: "e4",
    name: "Friendship Festival",
    status: "Next month",
    blurb: "Duo challenges and matching cosmetics for friendships of any level.",
    ends: "—",
    rarity: "rare" as Rarity,
  },
];

export type Conversation = {
  id: string;
  friendId: string;
  messages: { from: "me" | "them"; text: string; at: string }[];
  milestone?: string;
};

export const CONVERSATIONS: Conversation[] = [
  {
    id: "alex",
    friendId: "alex",
    milestone: "Conversation Milestone — 7 days talking with Alex",
    messages: [
      { from: "them", text: "ok so I was walking your east terrace", at: "19:02" },
      { from: "them", text: "found a sealed door under it 👀", at: "19:02" },
      { from: "me", text: "that wasn't there yesterday", at: "19:04" },
      { from: "them", text: "it says it opens twice. that's the whole hint.", at: "19:05" },
      { from: "me", text: "we're doing a Duo Quest first, then we open it together", at: "19:06" },
    ],
  },
  {
    id: "sam",
    friendId: "sam",
    messages: [
      { from: "them", text: "quickdraw rematch. you owe me one.", at: "18:40" },
      { from: "me", text: "the prompt was 'a polite storm'. nobody could draw that.", at: "18:41" },
      { from: "them", text: "I could.", at: "18:41" },
    ],
  },
  {
    id: "jordan",
    friendId: "jordan",
    messages: [
      { from: "them", text: "the third portal only opens at night, apparently", at: "16:12" },
      { from: "me", text: "night where though", at: "16:30" },
    ],
  },
  {
    id: "taylor",
    friendId: "taylor",
    messages: [{ from: "them", text: "chaos questions when you're free?", at: "14:05" }],
  },
  {
    id: "chris",
    friendId: "chris",
    messages: [{ from: "them", text: "made a community event for saturday", at: "11:20" }],
  },
];

export const DISCOVER_REALMS = [
  { id: "d1", name: "The Long Pier", owner: "Samira", level: 20, visitors: 412, rarity: "epic" as Rarity },
  { id: "d2", name: "Nine Small Rooms", owner: "Jordan", level: 17, visitors: 188, rarity: "rare" as Rarity },
  { id: "d3", name: "Greenhouse Ø", owner: "Signal Garden", level: 8, visitors: 96, rarity: "uncommon" as Rarity },
];
