import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Clock, Coins, Lock } from "lucide-react";
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
  dayKey,
  formatCountdown,
  formatSparks,
  isExpired,
  rotate,
  secondsUntilDailyReset,
  secondsUntilWeeklyReset,
  weekKey,
  type Cosmetic,
  type CosmeticSlot,
} from "@/lib/cosmetics";
import { rarityBorder } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Dimted Sparks & cosmetics" },
      {
        name: "description",
        content:
          "Spend Sparks you earned by chatting on nametags, badges, avatar frames, banners and message effects. Nothing here costs real money.",
      },
      { property: "og:title", content: "Shop — Dimted Sparks & cosmetics" },
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

      {item.available_until ? (
        <p className="text-gold flex items-center gap-1 font-mono text-[10px]">
          <Clock className="size-3" />
          leaves in{" "}
          {formatCountdown(
            Math.max(0, Math.round((Date.parse(item.available_until) - Date.now()) / 1000)),
          )}
        </p>
      ) : null}

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

/** The Armory: everything you own, one tap from being worn. */
function Armory({
  all,
  owned,
  equipped,
  onEquip,
  onClear,
}: {
  all: Cosmetic[];
  owned: Set<string>;
  equipped: Record<CosmeticSlot, string | null>;
  onEquip: (item: Cosmetic) => void;
  onClear: (slot: CosmeticSlot) => void;
}) {
  const { profile } = useDimted();
  const ownedItems = all.filter((i) => owned.has(i.slug));
  const [slot, setSlot] = useState<CosmeticSlot>("nametag");
  const list = ownedItems.filter((i) => i.slot === slot);
  const activeSlug = equipped[slot];

  return (
    <Panel className="border-primary/25 p-5" delay={20}>
      <PanelHead
        eyebrow="Armory"
        title="Your locker"
        aside={`${ownedItems.length} owned`}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Live look */}
        <div className="border-border bg-background/40 overflow-hidden rounded-xl border">
          <div className="h-20 w-full" style={{ background: bannerFor(equipped.banner) }} />
          <div className="-mt-7 flex flex-col items-center px-4 pb-4">
            <Avatar profile={profile} size={56} />
            <Nametag profile={profile} className="mt-2 text-sm" />
            <p className="text-muted-foreground font-mono text-[10px]">
              @{profile?.username ?? "you"}
            </p>
            <div className="mt-3 w-full space-y-1">
              {SLOTS.map((s) => {
                const on = equipped[s.slot];
                const item = all.find((c) => c.slug === on);
                return (
                  <button
                    key={s.slot}
                    onClick={() => setSlot(s.slot)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                      slot === s.slot
                        ? "border-primary/45 bg-primary/10"
                        : "border-border/60 hover:bg-secondary/50",
                    )}
                  >
                    <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                      {s.label}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 truncate text-[12px]",
                        item ? "text-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {item?.name ?? "empty"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Slot contents */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {SLOTS.map((s) => (
              <button
                key={s.slot}
                onClick={() => setSlot(s.slot)}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
                  slot === s.slot
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
                <span className="ml-1.5 opacity-60">
                  {ownedItems.filter((i) => i.slot === s.slot).length}
                </span>
              </button>
            ))}
            {activeSlug ? (
              <button
                onClick={() => onClear(slot)}
                className="text-muted-foreground hover:text-destructive ml-auto font-mono text-[10px] tracking-[0.12em] uppercase"
              >
                Unequip slot
              </button>
            ) : null}
          </div>

          {list.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Nothing in this slot yet — buy one below and it lands here instantly.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((item) => {
                const on = activeSlug === item.slug;
                return (
                  <button
                    key={item.slug}
                    onClick={() => onEquip(item)}
                    className={cn(
                      "bg-background/40 hover:border-primary/40 group flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                      on ? "border-primary/60 bg-primary/10" : rarityBorder[item.rarity],
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display min-w-0 truncate text-[13px] font-semibold">
                        {item.name}
                      </p>
                      <RarityChip rarity={item.rarity} />
                    </div>
                    <PreviewName slug={item.slug} slot={item.slot} />
                    <span
                      className={cn(
                        "font-mono text-[10px] tracking-[0.14em] uppercase",
                        on ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {on ? "✓ worn — tap to remove" : "tap to equip"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function ShopPage() {

  const { profile, level, sparks, refreshProfile } = useDimted();
  const cosmetics = useCosmetics();
  const inventory = useInventory(profile?.id);
  const qc = useQueryClient();
  const [slot, setSlot] = useState<CosmeticSlot | "all">("all");

  const owned = useMemo(() => new Set(inventory.data ?? []), [inventory.data]);
  const all = cosmetics.data ?? [];

  // Rotations are derived from the date, not stored — everyone sees the same
  // daily/weekly shelf and it turns over on its own. Each shelf shows far fewer
  // items than its pool holds, so the stock genuinely changes every flip.
  const daily = useMemo(() => rotate(all.filter((i) => i.pool === "daily"), dayKey(), 5), [all]);
  const weekly = useMemo(() => rotate(all.filter((i) => i.pool === "weekly"), weekKey(), 5), [all]);
  const limited = useMemo(
    () =>
      rotate(
        all.filter((i) => i.pool === "limited" && !isExpired(i)),
        `limited-${weekKey()}`,
        2,
      ),
    [all],
  );

  // The permanent shelf: core stock plus anything you already own.
  const stock = useMemo(
    () => all.filter((i) => i.pool === "core" || owned.has(i.slug)),
    [all, owned],
  );
  const items = stock.filter((i) => slot === "all" || i.slot === slot);

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

  async function clearSlot(s: CosmeticSlot) {
    try {
      await equipCosmetic(null, s);
      await refreshProfile();
      toast.success("Slot cleared.");
    } catch {
      toast.error("Couldn't clear that slot.");
    }
  }


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Earned, never bought with money"
        title="Shop"
        blurb="Sparks come from playing Dimted — chatting, streaks, activities, levelling. Cosmetics change how you look, never how you rank."
        aside={
          <div className="glass-raised rounded-2xl px-4 py-3 text-right">
            <p className="eyebrow">Your Sparks</p>
            <p className="numeral text-gold mt-1 flex items-center justify-end gap-2 text-2xl">
              <Coins className="size-4" /> {formatSparks(sparks)}
            </p>
          </div>
        }
      />

      <Armory
        all={all}
        owned={owned}
        equipped={equippedSlug}
        onEquip={(item) => void equip(item)}
        onClear={(s) => void clearSlot(s)}
      />



      {limited.length ? (
        <Panel className="border-gold/30 p-5">
          <PanelHead
            eyebrow="Limited time"
            title="Gone when the clock runs out"
            aside="never restocked"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {limited.map((item) => (
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

      {daily.length ? (
        <Panel className="p-5" delay={40}>
          <PanelHead
            eyebrow="Daily rotation"
            title="Five picks, today only"
            aside={`rotates in ${formatCountdown(secondsUntilDailyReset())}`}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {daily.map((item) => (
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

      {weekly.length ? (
        <Panel className="p-5" delay={60}>
          <PanelHead
            eyebrow="Weekly feature"
            title="This week's shelf"
            aside={`rotates in ${formatCountdown(secondsUntilWeeklyReset())}`}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {weekly.map((item) => (
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
          title="Always in stock"
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
            const item = all.find((c) => c.slug === on);
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
