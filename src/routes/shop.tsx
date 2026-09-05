import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Clock, Coins, Lock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, PanelHead, RarityChip } from "@/components/dimted/primitives";
import { Avatar, Nametag } from "@/components/dimted/Identity";
import { useDimted } from "@/lib/dimted-store";
import { useCosmetics, useInventory } from "@/lib/dimted-queries";
import { useMyRole } from "@/lib/roles-queries";
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
      { title: "Shop — Lazu Sparks & cosmetics" },
      {
        name: "description",
        content:
          "Spend Sparks you earned by chatting on nametags, badges, avatar frames, banners and message effects. Nothing here costs real money.",
      },
      { property: "og:title", content: "Shop — Lazu Sparks & cosmetics" },
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
  const exclusive = item.pool === "admin" || item.pool === "owner";

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
          ) : exclusive ? (
            <>
              <Lock className="size-3.5" /> {item.pool === "owner" ? "Owner only" : "Admins only"}
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
        ) : exclusive ? (
          <Button size="sm" variant="outline" disabled>
            Sealed
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
  const [view, setView] = useState<"shop" | "vault">("shop");

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
        3,
      ),
    [all],
  );


  // The vaults are a secret shelf: normal accounts never learn they exist.
  // Owner sees both, admins see the staff vault only, everyone else sees neither.
  const { isOwner, isStaff } = useMyRole(profile?.id);
  const adminVault = useMemo(
    () => (isStaff ? all.filter((i) => i.pool === "admin") : []),
    [all, isStaff],
  );
  const ownsAdminVault = adminVault.some((i) => owned.has(i.slug));
  const ownerVault = useMemo(
    () => (isOwner ? all.filter((i) => i.pool === "owner") : []),
    [all, isOwner],
  );
  const ownsVault = ownerVault.some((i) => owned.has(i.slug));

  const hasVault = ownerVault.length > 0 || adminVault.length > 0;

  // The permanent shelf is core stock ONLY. Rotating and limited pieces live
  // exclusively on their own shelves — otherwise anything you already own would
  // sit here forever and the rotation would look fake. Owned pieces of any pool
  // are always reachable in the Armory.
  const stock = useMemo(() => all.filter((i) => i.pool === "core"), [all]);

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




  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Earned, never bought with money"
        title="Shop"
        blurb="Sparks come from playing Lazu — chatting, streaks, activities, levelling. Cosmetics change how you look, never how you rank."
        aside={
          <div className="glass-raised rounded-2xl px-4 py-3 text-right">
            <p className="eyebrow">Your Sparks</p>
            <p className="numeral text-gold mt-1 flex items-center justify-end gap-2 text-2xl">
              <Coins className="size-4" /> {formatSparks(sparks)}
            </p>
          </div>
        }
      />

      {hasVault ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setView("shop")}
            className={cn(
              "rounded-full border px-4 py-1.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors",
              view === "shop"
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Public shop
          </button>
          <button
            onClick={() => setView("vault")}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-4 py-1.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors",
              view === "vault"
                ? isOwner
                  ? "border-gold/60 bg-gold/15 text-gold"
                  : "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Lock className="size-3" /> {isOwner ? "Restricted vaults" : "Staff vault"}
            <span className="opacity-60">{ownerVault.length + adminVault.length}</span>
          </button>
        </div>
      ) : null}

      {view === "shop" ? (
      <Panel className="border-primary/25 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="eyebrow">Armory</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Everything you own lives in your locker — preview and equip it there.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/armory">Open the Armory</Link>
        </Button>
      </Panel>
      ) : null}



      {view === "vault" && ownerVault.length ? (
        <Panel className="border-gold/45 relative overflow-hidden p-5">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 130% at 88% -25%, oklch(0.9 0.15 86 / 0.2), transparent 62%), radial-gradient(50% 110% at 6% 120%, oklch(0.86 0.16 84 / 0.12), transparent 66%)",
            }}
          />
          <div className="relative">
            <PanelHead
              eyebrow="Owner's Vault"
              title={ownsVault ? "Bound to your account alone" : "Owner-exclusive — unobtainable"}
              aside="1 of 1"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              {ownsVault
                ? "Regalia minted for the owner of Lazu. It cannot be bought, traded, granted, or duplicated — not even by admins."
                : "These belong to the owner of Lazu. No level, price, or grant will ever unlock them for another account."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ownerVault.map((item) => (
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
          </div>
        </Panel>
      ) : null}

      {view === "vault" && adminVault.length ? (
        <Panel className="border-primary/40 relative overflow-hidden p-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(70% 120% at 12% -20%, oklch(0.72 0.13 195 / 0.16), transparent 65%), radial-gradient(50% 110% at 92% 120%, oklch(0.66 0.16 300 / 0.12), transparent 68%)",
            }}
          />
          <div className="relative">
            <PanelHead
              eyebrow="Admin Vault"
              title={ownsAdminVault ? "Issued with your admin role" : "Staff only — never for sale"}
              aside="not purchasable"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              {ownsAdminVault
                ? "Staff regalia. It arrives with the admin role and cannot be bought, traded, or level-unlocked."
                : "These are issued to Lazu admins only. No amount of Sparks or levels will unlock them."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {adminVault.map((item) => (
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
          </div>
        </Panel>
      ) : null}

      {view === "shop" && limited.length ? (
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

      {view === "shop" && daily.length ? (
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

      {view === "shop" && weekly.length ? (
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

      {view === "shop" ? (
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
      ) : null}

      {view === "shop" ? (
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
                  <span
                    style={{ ["--frame-w" as string]: "2px" }}
                    className={cn("relative isolate mt-2 grid size-8 place-items-center rounded-full", FRAME_CLASS[on])}
                  >
                    <span className="bg-secondary block size-7 rounded-full" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
      ) : null}
    </div>
  );
}
