import { Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { RarityChip } from "@/components/dimted/primitives";
import { rarityBorder, rarityText } from "@/components/dimted/rarity";
import type { Cosmetic } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

/**
 * The profile showcase: up to three cosmetics the owner hand-picked to show
 * off, starred from the Armory. Renders nothing when nothing is starred.
 */
export function Showcase({
  slugs,
  cosmetics,
  editable = false,
}: {
  slugs: string[] | null | undefined;
  cosmetics: Cosmetic[];
  editable?: boolean;
}) {
  const items = (slugs ?? [])
    .map((s) => cosmetics.find((c) => c.slug === s))
    .filter((c): c is Cosmetic => !!c)
    .slice(0, 3);

  if (items.length === 0 && !editable) return null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <p className="eyebrow flex items-center gap-1.5">
          <Star className="size-3 text-gold" /> Showcase
        </p>
        {editable ? (
          <Link to="/armory" className="text-primary font-mono text-[11px] hover:underline">
            Star items in the Armory →
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Nothing starred yet — pick your three favourite pieces in the Armory.
        </p>
      ) : (
        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.slug}
              className={cn("bg-background/40 rounded-xl border px-3 py-2.5", rarityBorder[item.rarity])}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={cn("truncate text-sm", rarityText[item.rarity])}>{item.name}</p>
                <RarityChip rarity={item.rarity} />
              </div>
              <p className="text-muted-foreground mt-1 truncate font-mono text-[10px] uppercase">
                {item.slot}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
