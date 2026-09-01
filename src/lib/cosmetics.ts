/**
 * Cosmetics are pure presentation: a slug from the database maps to token-based
 * classes here. Nothing in this file affects XP, energy or standing — cosmetics
 * are earned with Sparks and worn, never bought with money and never pay-to-win.
 */
import type { Rarity } from "./dimted";

export type CosmeticSlot = "nametag" | "badge" | "frame" | "banner" | "effect";

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
};

/** Nametag → classes applied to the name text. */
export const NAMETAG_CLASS: Record<string, string> = {
  "tag-frost": "text-rare",
  "tag-aurora": "cos-gradient cos-gradient-aurora",
  "tag-ember": "cos-gradient cos-gradient-ember",
  "tag-violet": "text-epic cos-glow-violet",
  "tag-prism": "cos-gradient cos-gradient-prism cos-shimmer",
  "tag-eclipse": "cos-gradient cos-gradient-eclipse cos-shimmer",
  "tag-mythos": "cos-gradient cos-gradient-mythos cos-shimmer cos-glow-mythos",
};

/** Badge → the glyph drawn after the name. */
export const BADGE_GLYPH: Record<string, string> = {
  "badge-spark": "✦",
  "badge-owl": "◗",
  "badge-founder": "⌁",
  "badge-crown": "♛",
  "badge-void": "◍",
};

export const BADGE_CLASS: Record<string, string> = {
  "badge-spark": "text-common",
  "badge-owl": "text-uncommon",
  "badge-founder": "text-rare",
  "badge-crown": "text-legendary",
  "badge-void": "text-secret",
};

/** Frame → ring classes on the avatar wrapper. */
export const FRAME_CLASS: Record<string, string> = {
  "frame-hairline": "ring-2 ring-common/50",
  "frame-pulse": "ring-2 ring-uncommon/60 animate-breathe",
  "frame-orbit": "ring-2 ring-rare/70 cos-glow-rare",
  "frame-halo": "ring-2 ring-epic/70 cos-glow-epic",
  "frame-relic": "ring-2 ring-mythic/80 cos-glow-mythic",
};

/** Banner → background style for the profile header. */
export const BANNER_STYLE: Record<string, string> = {
  "banner-drift":
    "linear-gradient(120deg, oklch(0.24 0.05 262), oklch(0.16 0.032 258))",
  "banner-aurora":
    "radial-gradient(70% 130% at 18% 120%, oklch(0.5 0.12 190 / 0.75), transparent 70%), linear-gradient(120deg, oklch(0.22 0.045 262), oklch(0.15 0.032 258))",
  "banner-solar":
    "radial-gradient(65% 120% at 78% 130%, oklch(0.62 0.14 78 / 0.7), transparent 70%), linear-gradient(120deg, oklch(0.23 0.05 60), oklch(0.15 0.032 258))",
  "banner-nebula":
    "radial-gradient(60% 110% at 30% 0%, oklch(0.5 0.16 305 / 0.6), transparent 70%), radial-gradient(60% 110% at 80% 120%, oklch(0.45 0.14 250 / 0.6), transparent 70%), linear-gradient(120deg, oklch(0.2 0.05 280), oklch(0.14 0.03 258))",
  "banner-signal":
    "repeating-linear-gradient(0deg, oklch(0.28 0.04 258 / 0.9) 0 2px, transparent 2px 5px), linear-gradient(120deg, oklch(0.22 0.04 258), oklch(0.14 0.03 258))",
};

export const DEFAULT_BANNER =
  "radial-gradient(60% 120% at 20% 120%, oklch(0.42 0.1 200 / 0.5), transparent 70%), linear-gradient(120deg, oklch(0.21 0.04 262), oklch(0.15 0.032 258))";

/** Message effect → animation classes on a chat row. */
export const EFFECT_CLASS: Record<string, string> = {
  "fx-fade": "animate-pop-in",
  "fx-slide": "animate-rise",
  "fx-spark": "animate-pop-in cos-spark-row",
  "fx-ripple": "animate-rise cos-ripple-row",
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
