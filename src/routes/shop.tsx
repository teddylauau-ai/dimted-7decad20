import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Coins, Lock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, PanelHead, RarityChip } from "@/components/dimted/primitives";
import { Avatar, Nametag } from "@/components/dimted/Identity";
import { useDimted } from "@/lib/dimted-store";
import { useCosmetics, useInventory } from "@/lib/dimted-queries";
import { equipCosmetic, purchaseCosmetic } from "@/lib/dimted-actions";
import {
  BADGE_CLASS,
  BADGE_GLYPH,
  FRAME_CLASS,
  NAMETAG_CLASS,
  SLOTS,
  bannerFor,
  formatSparks,
  type Cosmetic,
  type CosmeticSlot,
} from "@/lib/cosmetics";
import { rarityBorder } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — DIMTED Sparks & cosmetics" },
      {
        name: "description",
        content:
          "Spend Sparks you earned by chatting on nametags, badges, avatar frames, banners and message effects. Nothing here costs real money.",
      },
      { property: "og:title", content: "Shop — DIMTED Sparks & cosmetics" },
      {
        property: "og:description",
        content: "Earned currency, worn cosmetics, zero pay-to-win.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

function PreviewName({ slug, slot }: { slug: string; slot: CosmeticSlot }) {
  const { profile } = useDimted();
  const preview = {
    username: profile?.username ?? "you",
    display_name: profile?.display_name ?? "You",
    equipped_nametag: slot === "nametag" ? slug : profile?.equipped_nametag ?? null,
    equipped_badge: slot === "badge" ? slug : profile?.equipped_badge ?? null,
    equipped_frame: slot === "frame" ? slug : profile?.equipped_frame ?? null,
  };

  if (slot === "banner") {
    return (
      <div
        className="h-12 w-full rounded-lg"
        style={{ background: bannerFor(slug) }}
        aria-label="Banner preview"
      />
    );
  }

  return (
    <div className="bg-background/50 flex items-center gap-2 rounded-lg px-2 py-1.5">
      <Avatar profile={preview} size={26} />
      <Nametag profile={preview} className="text-sm" />
    </div>
  );
}

function ItemCard({
  item,
  owned,
  equipped,
  level,
  sparks,
  onBuy,
  onEquip,
}: {
  item: Cosmetic;
  owned: boolean;
  equipped: boolean;
  level: number;
  sparks: number;
  onBuy: () => void;
  onEquip: () => void;
}) {
  const levelLocked = level < item.required_level;
  const affordable = sparks >= item.price_sparks;

  return (
    <div
      className={cn(
        "bg-background/40 flex flex-col gap-3 rounded-xl border p-3.5",
        rarityBorder[item.rarity],
        levelLocked && !owned && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display truncate text-sm font-semibold">{item.name}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{item.description}</p>
        </div>
        <RarityChip rarity={item.rarity} />
      </div>

      <PreviewName slug={item.slug} slot={item.slot} />

      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px]">
          {owned ? (
            <>
              <Check className="text-uncommon size-3.5" /> Owned
            </>
          ) : levelLocked ? (
            <>
              <Lock className="size-3.5" /> Level {item.required_level}
            </>
          ) : (
            <>
              <Coins className="text-gold size-3.5" /> {formatSparks(item.price_sparks)}
            </>
          )}
        </span>

        {owned ? (
          <Button size="sm" variant={equipped ? "secondary" : "outline"} onClick={onEquip}>
            {equipped ? "Take off" : "Equip"}
          </Button>
        ) : (
          <Button size="sm" disabled={levelLocked || !affordable} onClick={onBuy}>
            {levelLocked ? "Locked" : affordable ? "Buy" : "Not enough"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ShopPage() {
  const { profile, level, sparks, refreshProfile } = useDimted();
  const cosmetics = useCosmetics();
  const inventory = useInventory(profile?.id);
  const qc = useQueryClient();
  const [slot, setSlot] = useState<CosmeticSlot | "all">("all");

  const owned = useMemo(() => new Set(inventory.data ?? []), [inventory.data]);
  const items = (cosmetics.data ?? []).filter((i) => slot === "all" || i.slot === slot);
  const featured = (cosmetics.data ?? []).filter((i) => i.featured);

  const equippedSlug: Record<CosmeticSlot, string | null> = {
    nametag: profile?.equipped_nametag ?? null,
    badge: profile?.equipped_badge ?? null,
    frame: profile?.equipped_frame ?? null,
    banner: profile?.equipped_banner ?? null,
    effect: profile?.equipped_effect ?? null,
  };

  async function buy(item: Cosmetic) {
    const res = await purchaseCosmetic(item.slug);
    if (res.status === "purchased") {
      toast.success(`${item.name} is yours.`);
      await refreshProfile();
      void qc.invalidateQueries({ queryKey: ["inventory"] });
      return;
    }
    if (res.status === "insufficient") toast.error("Not enough Sparks yet — keep talking.");
    else if (res.status === "locked") toast.error(`Unlocks at Level ${item.required_level}.`);
    else if (res.status === "owned") toast.info("You already own that.");
    else toast.error("Couldn't complete that purchase.");
  }

  async function equip(item: Cosmetic) {
    const isOn = equippedSlug[item.slot] === item.slug;
    try {
      await equipCosmetic(isOn ? null : item.slug, item.slot);
      await refreshProfile();
      toast.success(isOn ? `${item.name} taken off.` : `${item.name} equipped.`);
    } catch {
      toast.error("Couldn't equip that.");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Earned, never bought with money"
        title="Shop"
        blurb="Sparks come from playing DIMTED — chatting, streaks, activities, levelling. Cosmetics change how you look, never how you rank."
        aside={
          <div className="glass-raised rounded-2xl px-4 py-3 text-right">
            <p className="eyebrow">Your Sparks</p>
            <p className="numeral text-gold mt-1 flex items-center justify-end gap-2 text-2xl">
              <Coins className="size-4" /> {formatSparks(sparks)}
            </p>
          </div>
        }
      />

      {featured.length ? (
        <Panel className="p-5">
          <PanelHead eyebrow="Featured this rotation" title="Worth the Sparks" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((item) => (
              <ItemCard
                key={item.slug}
                item={item}
                owned={owned.has(item.slug)}
                equipped={equippedSlug[item.slot] === item.slug}
                level={level}
                sparks={sparks}
                onBuy={() => void buy(item)}
                onEquip={() => void equip(item)}
              />
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel className="p-5" delay={80}>
        <PanelHead
          eyebrow={`${owned.size} owned`}
          title="Everything in the shop"
          aside={
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...SLOTS.map((s) => s.slot)] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSlot(s)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
                    slot === s
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          }
        />

        {cosmetics.isLoading ? (
          <p className="text-muted-foreground mt-4 font-mono text-xs">Loading the catalogue…</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <ItemCard
                key={item.slug}
                item={item}
                owned={owned.has(item.slug)}
                equipped={equippedSlug[item.slot] === item.slug}
                level={level}
                sparks={sparks}
                onBuy={() => void buy(item)}
                onEquip={() => void equip(item)}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-5" delay={120}>
        <PanelHead eyebrow="How the slots work" title="One item per slot" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {SLOTS.map((s) => {
            const on = equippedSlug[s.slot];
            const item = (cosmetics.data ?? []).find((c) => c.slug === on);
            return (
              <div key={s.slot} className="border-border bg-background/40 rounded-xl border p-3.5">
                <p className="eyebrow">{s.label}</p>
                <p className="mt-1.5 text-sm">{item?.name ?? "Nothing equipped"}</p>
                <p className="text-muted-foreground mt-1 text-xs">{s.blurb}</p>
                {s.slot === "nametag" && on && NAMETAG_CLASS[on] ? (
                  <p className={cn("mt-2 text-sm", NAMETAG_CLASS[on])}>
                    {profile?.display_name ?? "You"}
                  </p>
                ) : null}
                {s.slot === "badge" && on && BADGE_GLYPH[on] ? (
                  <p className={cn("mt-2 text-sm", BADGE_CLASS[on])}>{BADGE_GLYPH[on]}</p>
                ) : null}
                {s.slot === "frame" && on && FRAME_CLASS[on] ? (
                  <span className={cn("bg-secondary mt-2 block size-8 rounded-lg", FRAME_CLASS[on])} />
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
