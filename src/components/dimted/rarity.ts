import type { Rarity } from "@/lib/dimted";

/** Rarity → token-based utility classes. Keeps colour decisions in one place. */
export const rarityText: Record<Rarity, string> = {
  common: "text-common",
  uncommon: "text-uncommon",
  rare: "text-rare",
  epic: "text-epic",
  legendary: "text-legendary",
  mythic: "text-mythic",
};

export const rarityBorder: Record<Rarity, string> = {
  common: "border-common/25",
  uncommon: "border-uncommon/35",
  rare: "border-rare/35",
  epic: "border-epic/40",
  legendary: "border-legendary/45",
  mythic: "border-mythic/50",
};

export const rarityBg: Record<Rarity, string> = {
  common: "bg-common/10",
  uncommon: "bg-uncommon/10",
  rare: "bg-rare/10",
  epic: "bg-epic/12",
  legendary: "bg-legendary/12",
  mythic: "bg-mythic/12",
};

export const rarityDot: Record<Rarity, string> = {
  common: "bg-common",
  uncommon: "bg-uncommon",
  rare: "bg-rare",
  epic: "bg-epic",
  legendary: "bg-legendary",
  mythic: "bg-mythic",
};
