/**
 * Cosmetics are pure presentation: a slug from the database maps to token-based
 * classes here. Nothing in this file affects XP, energy or standing — cosmetics
 * are earned with Sparks and worn, never bought with money and never pay-to-win.
 */
import type { Rarity } from "./dimted";

export type CosmeticSlot = "nametag" | "badge" | "frame" | "banner" | "effect";

/** Which shelf of the shop an item lives on. */
export type CosmeticPool = "core" | "daily" | "weekly" | "limited" | "admin" | "founder" | "owner";

export const SLOTS: { slot: CosmeticSlot; label: string; blurb: string }[] = [
  { slot: "nametag", label: "Nametags", blurb: "How your name reads everywhere you speak." },
  { slot: "badge", label: "Badges", blurb: "A small mark beside your name." },
  { slot: "frame", label: "Avatar frames", blurb: "Rings and glows around your avatar." },
  { slot: "banner", label: "Banners", blurb: "The header art on your profile." },
  { slot: "effect", label: "Message effects", blurb: "How your messages arrive in chat." },
];

export type Cosmetic = {
  slug: string;
  name: string;
  slot: CosmeticSlot;
  rarity: Rarity;
  description: string;
  price_sparks: number;
  required_level: number;
  featured: boolean;
  pool: CosmeticPool;
  available_until: string | null;
};

/** Nametag → classes applied to the name text. */
export const NAMETAG_CLASS: Record<string, string> = {
  "tag-frost": "text-rare",
  "tag-mint": "text-uncommon",
  "tag-sky": "text-[oklch(0.84_0.11_222)]",
  "tag-ink": "text-[oklch(0.72_0.02_258)]",
  "tag-coral": "text-[oklch(0.79_0.14_25)]",
  "tag-aurora": "cos-gradient cos-gradient-aurora",
  "tag-ember": "cos-gradient cos-gradient-ember",
  "tag-glacier": "cos-gradient cos-gradient-glacier",
  "tag-violet": "text-epic cos-glow-violet",
  "tag-neon": "cos-gradient cos-gradient-neon cos-shimmer",
  "tag-sunset": "cos-gradient cos-gradient-sunset",
  "tag-toxic": "cos-gradient cos-gradient-toxic",
  "tag-blood": "cos-gradient cos-gradient-blood cos-glow-mythos",
  "tag-prism": "cos-gradient cos-gradient-prism cos-shimmer",
  "tag-royal": "cos-gradient cos-gradient-royal cos-shimmer",
  "tag-chrome": "cos-gradient cos-gradient-chrome cos-shimmer",
  "tag-eclipse": "cos-gradient cos-gradient-eclipse cos-shimmer",
  "tag-solar": "cos-gradient cos-gradient-solar cos-shimmer",
  "tag-holo": "cos-gradient cos-gradient-holo cos-shimmer",
  "tag-void": "cos-gradient cos-gradient-void cos-glow-violet",
  "tag-mythos": "cos-gradient cos-gradient-mythos cos-shimmer cos-glow-mythos",
  "tag-abyss": "cos-gradient cos-gradient-abyss cos-shimmer cos-glow-mythos",
  "tag-vanta": "cos-gradient cos-gradient-vanta cos-shimmer",
  "tag-founder-halo": "cos-gradient cos-gradient-founder-halo cos-shimmer cos-glow-founder",
  "tag-founder-genesis": "cos-gradient cos-gradient-founder-genesis cos-shimmer cos-glow-founder",
  "tag-founder-obsidian": "cos-gradient cos-gradient-founder-obsidian cos-shimmer",
  "tag-sov-liquid": "cos-gradient cos-sov cos-sov-liquid",
  "tag-sov-sunforge": "cos-gradient cos-sov cos-sov-sunforge",
  "tag-sov-starlit": "cos-gradient cos-sov cos-sov-starlit",
  "tag-sov-obsidian": "cos-gradient cos-sov cos-sov-obsidian",
  "tag-sov-halo": "cos-gradient cos-sov cos-sov-halo",
  "tag-admin-cipher": "cos-gradient cos-gradient-admin-cipher cos-shimmer cos-glow-founder",
  "tag-admin-tidecall": "cos-gradient cos-gradient-admin-tidecall cos-shimmer",
};

/** Badge → the glyph drawn after the name. */
export const BADGE_GLYPH: Record<string, string> = {
  "badge-spark": "✦",
  "badge-bolt": "⚡",
  "badge-star": "★",
  "badge-owl": "◗",
  "badge-moon": "☾",
  "badge-leaf": "☘",
  "badge-founder": "⌁",
  "badge-comet": "☄",
  "badge-anchor": "♆",
  "badge-hex": "⬢",
  "badge-flare": "✹",
  "badge-gem": "❖",
  "badge-crown": "♛",
  "badge-flag": "⚑",
  "badge-void": "◍",
  "badge-sigil": "✜",
  "badge-founder-crest": "⟡",
  "badge-founder-key": "⚿",
  "badge-sov-crown": "♛",
  "badge-sov-sun": "☀",
  "badge-sov-star": "✦",
  "badge-sov-seal": "❂",
  "badge-admin-shield": "⛨",
};

export const BADGE_CLASS: Record<string, string> = {
  "badge-spark": "text-common",
  "badge-bolt": "text-common",
  "badge-star": "text-common",
  "badge-owl": "text-uncommon",
  "badge-moon": "text-uncommon",
  "badge-leaf": "text-uncommon",
  "badge-founder": "text-rare",
  "badge-comet": "text-rare",
  "badge-anchor": "text-rare",
  "badge-hex": "text-epic",
  "badge-flare": "text-epic",
  "badge-gem": "text-epic",
  "badge-crown": "text-legendary",
  "badge-flag": "text-legendary",
  "badge-void": "text-secret",
  "badge-sigil": "text-mythic cos-glow-mythos",
  "badge-founder-crest": "cos-gradient cos-gradient-founder-halo cos-shimmer cos-glow-founder",
  "badge-founder-key": "text-primary cos-glow-founder",
  "badge-sov-crown": "cos-sov-badge cos-sov-badge-crown",
  "badge-sov-sun": "cos-sov-badge cos-sov-badge-sun",
  "badge-sov-star": "cos-sov-badge cos-sov-badge-star",
  "badge-sov-seal": "cos-sov-badge cos-sov-badge-seal",
  "badge-admin-shield": "cos-gradient cos-gradient-admin-cipher cos-shimmer",
};

/**
 * Frame → classes on the avatar wrapper.
 * Every frame draws INSIDE the wrapper's own box (a border, or a ::before ring
 * layer) so it is always a complete circle around the picture and can never be
 * clipped by a parent or knocked off-centre. Nothing here rotates the picture —
 * spinning frames animate their ring layer only.
 */
export const FRAME_CLASS: Record<string, string> = {
  "frame-hairline": "cos-ring border-common/50",
  "frame-pulse": "cos-ring border-uncommon/60 animate-breathe",
  "frame-tide": "cos-ring border-primary/60 cos-glow-primary",
  "frame-orbit": "cos-ring border-rare/70 cos-glow-rare",
  "frame-ember": "cos-ring border-energy/70 cos-glow-ember",
  "frame-halo": "cos-ring border-epic/70 cos-glow-epic",
  "frame-neon": "cos-ring border-epic/80 cos-glow-epic animate-breathe",
  "frame-glitch": "cos-frame cos-frame-glitch",
  "frame-gilded": "cos-ring border-gold/80 cos-glow-gold",
  "frame-eclipse": "cos-ring border-foreground/70 cos-glow-gold",
  "frame-cometcrown": "cos-ring border-gold/70 cos-glow-gold animate-breathe",
  "frame-relic": "cos-ring border-mythic/80 cos-glow-mythic",
  "frame-prismatic": "cos-frame cos-frame-prismatic",
  "frame-founder-aureate": "cos-frame cos-frame-aureate",
  "frame-founder-orbital": "cos-frame cos-frame-orbital",
  "frame-sov-ascension": "cos-frame cos-frame-sov-ascension",
  "frame-sov-corona": "cos-frame cos-frame-sov-corona",
  "frame-sov-mirror": "cos-frame cos-frame-sov-mirror",
  "frame-sov-eclipse": "cos-frame cos-frame-sov-eclipse",
  "frame-admin-scanline": "cos-frame cos-frame-scanline",
};

/** Banner → background style for the profile header. */
export const BANNER_STYLE: Record<string, string> = {
  "banner-drift": "linear-gradient(120deg, oklch(0.24 0.05 262), oklch(0.16 0.032 258))",
  "banner-signal":
    "repeating-linear-gradient(0deg, oklch(0.28 0.04 258 / 0.9) 0 2px, transparent 2px 5px), linear-gradient(120deg, oklch(0.22 0.04 258), oklch(0.14 0.03 258))",
  "banner-grid":
    "repeating-linear-gradient(0deg, oklch(0.6 0.05 230 / 0.14) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, oklch(0.6 0.05 230 / 0.14) 0 1px, transparent 1px 22px), linear-gradient(120deg, oklch(0.2 0.04 250), oklch(0.14 0.03 258))",
  "banner-aurora":
    "radial-gradient(70% 130% at 18% 120%, oklch(0.5 0.12 190 / 0.75), transparent 70%), linear-gradient(120deg, oklch(0.22 0.045 262), oklch(0.15 0.032 258))",
  "banner-solar":
    "radial-gradient(65% 120% at 78% 130%, oklch(0.62 0.14 78 / 0.7), transparent 70%), linear-gradient(120deg, oklch(0.23 0.05 60), oklch(0.15 0.032 258))",
  "banner-nebula":
    "radial-gradient(60% 110% at 30% 0%, oklch(0.5 0.16 305 / 0.6), transparent 70%), radial-gradient(60% 110% at 80% 120%, oklch(0.45 0.14 250 / 0.6), transparent 70%), linear-gradient(120deg, oklch(0.2 0.05 280), oklch(0.14 0.03 258))",
  "banner-tide":
    "linear-gradient(180deg, oklch(0.18 0.03 258) 0%, oklch(0.3 0.08 210) 62%, oklch(0.55 0.11 195) 66%, oklch(0.2 0.05 240) 100%)",
  "banner-ember":
    "radial-gradient(120% 90% at 50% 130%, oklch(0.62 0.18 40 / 0.8), transparent 65%), linear-gradient(120deg, oklch(0.18 0.04 40), oklch(0.13 0.03 258))",
  "banner-circuit":
    "repeating-linear-gradient(45deg, oklch(0.7 0.12 190 / 0.12) 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, oklch(0.7 0.12 300 / 0.1) 0 1px, transparent 1px 18px), linear-gradient(120deg, oklch(0.19 0.04 250), oklch(0.13 0.03 258))",
  "banner-mono":
    "linear-gradient(100deg, oklch(0.12 0.02 258) 0 46%, oklch(0.92 0.02 250) 46% 48%, oklch(0.16 0.03 258) 48%)",
  "banner-mirage":
    "repeating-linear-gradient(0deg, oklch(0.82 0.12 82 / 0.1) 0 3px, transparent 3px 9px), radial-gradient(80% 120% at 50% 120%, oklch(0.7 0.14 60 / 0.55), transparent 70%), linear-gradient(120deg, oklch(0.2 0.04 60), oklch(0.14 0.03 258))",
  "banner-glacier":
    "linear-gradient(115deg, oklch(0.9 0.05 220 / 0.35) 0 12%, transparent 12% 30%, oklch(0.8 0.08 200 / 0.3) 30% 40%, transparent 40%), linear-gradient(120deg, oklch(0.24 0.05 230), oklch(0.15 0.03 258))",
  "banner-inferno":
    "radial-gradient(100% 120% at 20% 130%, oklch(0.72 0.2 35 / 0.9), transparent 60%), radial-gradient(90% 110% at 80% 130%, oklch(0.85 0.18 75 / 0.75), transparent 60%), linear-gradient(120deg, oklch(0.19 0.05 30), oklch(0.12 0.03 258))",
  "banner-galaxy":
    "radial-gradient(35% 60% at 25% 30%, oklch(0.85 0.1 300 / 0.5), transparent 70%), radial-gradient(50% 80% at 70% 80%, oklch(0.6 0.16 265 / 0.7), transparent 70%), repeating-radial-gradient(circle at 60% 40%, oklch(1 0 0 / 0.14) 0 1px, transparent 1px 26px), linear-gradient(120deg, oklch(0.16 0.05 280), oklch(0.1 0.03 258))",
  /* ---- Sovereign banners (owner only) ---- */
  "banner-sov-dawn":
    "radial-gradient(circle at 50% 104%, oklch(1 0.06 98) 0 9%, oklch(0.95 0.15 88 / 0.95) 10% 13%, oklch(0.85 0.17 78 / 0.55) 14% 22%, transparent 40%), repeating-conic-gradient(from 0deg at 50% 104%, oklch(1 0.05 96 / 0.11) 0 3deg, transparent 3deg 11deg), radial-gradient(80% 60% at 50% 100%, oklch(0.55 0.13 70 / 0.7), transparent 70%), linear-gradient(180deg, oklch(0.05 0.01 262), oklch(0.13 0.03 60) 70%, oklch(0.3 0.08 66))",
  "banner-sov-goldrain":
    "repeating-linear-gradient(90deg, transparent 0 17px, oklch(1 0.06 98 / 0.55) 17px 18px, transparent 18px 43px, oklch(0.9 0.15 86 / 0.35) 43px 44px, transparent 44px 71px, oklch(0.97 0.09 94 / 0.6) 71px 72px, transparent 72px 97px), linear-gradient(180deg, transparent 0 20%, oklch(0.06 0.01 262 / 0.7) 55%, oklch(0.06 0.01 262) 78%), radial-gradient(120% 100% at 50% 0%, oklch(0.75 0.15 80 / 0.55), transparent 60%), linear-gradient(180deg, oklch(0.22 0.05 70), oklch(0.05 0.01 262) 78%, oklch(0.4 0.1 72))",
  "banner-sov-throne":
    "repeating-linear-gradient(90deg, oklch(0.95 0.12 90 / 0.28) 0 2px, oklch(0.6 0.1 72 / 0.18) 2px 5px, transparent 5px 52px), radial-gradient(70% 70% at 50% 120%, oklch(1 0.08 96 / 0.85), oklch(0.9 0.15 86 / 0.35) 40%, transparent 65%), radial-gradient(80% 50% at 50% -10%, oklch(0.9 0.13 88 / 0.35), transparent 70%), linear-gradient(180deg, oklch(0.05 0.01 262), oklch(0.12 0.025 262) 65%, oklch(0.24 0.06 70))",
  "banner-sov-blacksun":
    "radial-gradient(circle at 50% 58%, oklch(0.03 0 0) 0 25%, oklch(1 0.08 96) 25.5% 27.5%, oklch(0.9 0.16 86 / 0.55) 28% 33%, transparent 46%), repeating-conic-gradient(from 8deg at 50% 58%, oklch(0.95 0.14 88 / 0.14) 0 2deg, transparent 2deg 9deg), radial-gradient(90% 90% at 50% 58%, oklch(0.35 0.08 70 / 0.55), transparent 70%), linear-gradient(180deg, oklch(0.04 0.006 258), oklch(0.09 0.02 262))",

  "banner-founder-firstlight":
    "radial-gradient(70% 130% at 50% 135%, oklch(0.9 0.15 88 / 0.85), transparent 62%), radial-gradient(60% 110% at 12% -10%, oklch(0.7 0.13 300 / 0.45), transparent 70%), linear-gradient(180deg, oklch(0.16 0.04 268), oklch(0.3 0.09 40) 72%, oklch(0.62 0.14 66))",
  "banner-founder-vault":
    "repeating-linear-gradient(90deg, oklch(0.88 0.13 88 / 0.13) 0 1px, transparent 1px 26px), repeating-linear-gradient(0deg, oklch(0.88 0.13 88 / 0.1) 0 1px, transparent 1px 26px), radial-gradient(70% 120% at 50% 120%, oklch(0.78 0.13 84 / 0.45), transparent 68%), linear-gradient(120deg, oklch(0.17 0.035 262), oklch(0.12 0.025 258))",
    
  "banner-admin-controlroom":
    "repeating-linear-gradient(0deg, oklch(0.8 0.12 198 / 0.1) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, oklch(0.8 0.12 198 / 0.1) 0 1px, transparent 1px 18px), radial-gradient(60% 110% at 50% 120%, oklch(0.7 0.14 200 / 0.45), transparent 68%), linear-gradient(180deg, oklch(0.11 0.02 258), oklch(0.17 0.04 240))",
  "banner-eventide":
    "linear-gradient(180deg, oklch(0.32 0.09 285), oklch(0.6 0.14 30) 70%, oklch(0.85 0.13 82))",
};

export const DEFAULT_BANNER =
  "radial-gradient(60% 120% at 20% 120%, oklch(0.42 0.1 200 / 0.5), transparent 70%), linear-gradient(120deg, oklch(0.21 0.04 262), oklch(0.15 0.032 258))";

/** Message effect → animation classes on a chat row. */
export const EFFECT_CLASS: Record<string, string> = {
  "fx-fade": "animate-pop-in",
  "fx-slide": "animate-rise",
  "fx-spark": "animate-pop-in cos-spark-row",
  "fx-ripple": "animate-rise cos-ripple-row",
  "fx-glow": "animate-pop-in cos-glow-row",
  "fx-static": "animate-rise cos-static-row",
  "fx-shockwave": "animate-pop-in cos-wave-row",
  "fx-comet": "animate-rise cos-comet-row",
  "fx-aurora": "animate-pop-in cos-aurora-row",
  "fx-void": "animate-pop-in cos-void-row",
  "fx-founder-arrival": "animate-rise cos-founder-row",
  "fx-sov-coronation": "cos-sov-coronation-row",
  "fx-sov-decree": "cos-sov-decree-row",
  "fx-sov-goldwave": "cos-sov-goldwave-row",
  "fx-admin-dispatch": "animate-rise cos-admin-dispatch-row",
};

export type WornCosmetics = {
  nametag?: string | null | undefined;
  badge?: string | null | undefined;
  frame?: string | null | undefined;
  banner?: string | null | undefined;
  effect?: string | null | undefined;
};

export function bannerFor(slug?: string | null): string {
  return (slug && BANNER_STYLE[slug]) || DEFAULT_BANNER;
}

export function formatSparks(n: number): string {
  return n.toLocaleString();
}

/* ------------------------------------------------------------- rotation math */

/** Stable string hash — same key always produces the same shuffle. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function weekKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

/**
 * Deterministic pick from a pool for a given period key. Everyone sees the
 * same rotation on the same day/week, and it changes on its own — no cron job,
 * no server state, nothing to drift out of sync.
 */
export function rotate<T extends { slug: string }>(items: T[], key: string, count: number): T[] {
  return [...items]
    .sort((a, b) => hash(key + a.slug) - hash(key + b.slug))
    .slice(0, count);
}

/** Seconds until the current daily rotation flips (UTC midnight). */
export function secondsUntilDailyReset(now = Date.now()): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(0, Math.round((next.getTime() - now) / 1000));
}

/** Seconds until the weekly rotation flips (UTC Monday 00:00). */
export function secondsUntilWeeklyReset(now = Date.now()): number {
  const next = new Date(now);
  const daysAhead = (8 - (next.getUTCDay() || 7)) % 7 || 7;
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + daysAhead);
  return Math.max(0, Math.round((next.getTime() - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function isExpired(item: Cosmetic, now = Date.now()): boolean {
  return !!item.available_until && Date.parse(item.available_until) < now;
}
