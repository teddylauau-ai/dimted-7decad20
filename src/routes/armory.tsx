import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shield, Coins, Crown, ShoppingBag, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelHead, RarityChip } from "@/components/dimted/primitives";
import { Avatar, Nametag } from "@/components/dimted/Identity";
import { useDimted } from "@/lib/dimted-store";
import { useCosmetics, useInventory } from "@/lib/dimted-queries";
import { useMyRole } from "@/lib/roles-queries";
import { claimArmoryMilestone, equipCosmetic } from "@/lib/dimted-actions";
import { toggleShowcase } from "@/lib/chat-extras";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SLOTS,
  bannerFor,
  formatSparks,
  type Cosmetic,
  type CosmeticSlot,
} from "@/lib/cosmetics";
import { rarityBorder } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/armory")({
  head: () => ({
    meta: [
      { title: "Armory — your Lazu locker" },
      {
        name: "description",
        content:
          "Every cosmetic you own in one locker: nametags, badges, frames, banners and message effects, with a live preview and one-tap equipping.",
      },
      { property: "og:title", content: "Armory — your Lazu locker" },
      {
        property: "og:description",
        content: "Preview and equip every cosmetic you've earned in Lazu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArmoryPage,
});

function SlotPreview({ slug, slot }: { slug: string; slot: CosmeticSlot }) {
  const { profile } = useDimted();
  const preview = {
    username: profile?.username ?? "you",
    display_name: profile?.display_name ?? "You",
    equipped_nametag: slot === "nametag" ? slug : (profile?.equipped_nametag ?? null),
    equipped_badge: slot === "badge" ? slug : (profile?.equipped_badge ?? null),
    equipped_frame: slot === "frame" ? slug : (profile?.equipped_frame ?? null),
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

function ArmoryPage() {
  const { profile, sparks, refreshProfile } = useDimted();
  const { isOwner, isStaff } = useMyRole(profile?.id);
  const cosmetics = useCosmetics();
  const inventory = useInventory(profile?.id);
  const [slot, setSlot] = useState<CosmeticSlot | "vault" | "admin">("nametag");

  const owned = useMemo(() => new Set(inventory.data ?? []), [inventory.data]);
  const all = cosmetics.data ?? [];
  const ownedItems = useMemo(() => all.filter((i) => owned.has(i.slug)), [all, owned]);

  const equipped: Record<CosmeticSlot, string | null> = {
    nametag: profile?.equipped_nametag ?? null,
    badge: profile?.equipped_badge ?? null,
    frame: profile?.equipped_frame ?? null,
    banner: profile?.equipped_banner ?? null,
    effect: profile?.equipped_effect ?? null,
  };

  const vaultItems = useMemo(
    () => (isOwner ? ownedItems.filter((i) => i.pool === "owner") : []),
    [ownedItems, isOwner],
  );
  const adminItems = useMemo(
    () => (isStaff ? ownedItems.filter((i) => i.pool === "admin") : []),
    [ownedItems, isStaff],
  );
  const isVault = slot === "vault";
  const isAdmin = slot === "admin";
  const isExclusive = isVault || isAdmin;
  const list = isVault
    ? vaultItems
    : isAdmin
      ? adminItems
      : ownedItems.filter((i) => i.slot === slot);
  const activeSlug = isExclusive ? null : equipped[slot as CosmeticSlot];
  const meta = isVault
    ? { label: "Owner's Vault", blurb: "One-of-a-kind pieces bound to your account only" }
    : isAdmin
      ? { label: "Admin Vault", blurb: "Staff-issue regalia, granted with your admin role" }
      : SLOTS.find((s) => s.slot === slot);

  async function equip(item: Cosmetic) {
    const isOn = equipped[item.slot] === item.slug;
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
        eyebrow="Everything you've earned"
        title="Armory"
        blurb="Your locker. Preview any piece against your own name, wear it in one tap, and strip a slot back to bare whenever you like."
        aside={
          <div className="glass-raised rounded-2xl px-4 py-3 text-right">
            <p className="eyebrow">Owned / Sparks</p>
            <p className="numeral mt-1 flex items-center justify-end gap-3 text-2xl">
              <span className="text-primary flex items-center gap-1.5">
                <Sparkles className="size-4" /> {ownedItems.length}
              </span>
              <span className="text-gold flex items-center gap-1.5">
                <Coins className="size-4" /> {formatSparks(sparks)}
              </span>
            </p>
          </div>
        }
      />

      <Milestones owned={ownedItems.length} userId={profile?.id ?? null} />

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Live look */}
        <Panel className="border-primary/25 overflow-hidden p-0">
          <div className="h-24 w-full" style={{ background: bannerFor(equipped.banner) }} />
          <div className="-mt-9 flex flex-col items-center px-4 pb-5">
            <Avatar profile={profile} size={68} />
            <Nametag profile={profile} className="mt-2 text-base" />
            <p className="text-muted-foreground font-mono text-[10px]">
              @{profile?.username ?? "you"}
            </p>

            <div className="mt-4 w-full space-y-1.5">
              {SLOTS.map((s) => {
                const on = equipped[s.slot];
                const item = all.find((c) => c.slug === on);
                const count = ownedItems.filter((i) => i.slot === s.slot).length;
                return (
                  <button
                    key={s.slot}
                    onClick={() => setSlot(s.slot)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      slot === s.slot
                        ? "border-primary/45 bg-primary/10"
                        : "border-border/60 hover:bg-secondary/50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="text-muted-foreground block font-mono text-[10px] tracking-[0.14em] uppercase">
                        {s.label}
                        <span className="ml-1.5 opacity-60">{count}</span>
                      </span>
                      <span
                        className={cn(
                          "block truncate text-[12px]",
                          item ? "text-foreground" : "text-muted-foreground/60",
                        )}
                      >
                        {item?.name ?? "empty"}
                      </span>
                    </span>
                    {item ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void clearSlot(s.slot);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            void clearSlot(s.slot);
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive font-mono text-[10px] tracking-[0.12em] uppercase"
                      >
                        clear
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {vaultItems.length ? (
              <button
                onClick={() => setSlot("vault")}
                className={cn(
                  "mt-2 flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  isVault
                    ? "border-gold/60 bg-gold/10"
                    : "border-gold/35 hover:bg-gold/5",
                )}
              >
                <span className="min-w-0">
                  <span className="text-gold block font-mono text-[10px] tracking-[0.14em] uppercase">
                    Owner's Vault
                    <span className="ml-1.5 opacity-70">{vaultItems.length}</span>
                  </span>
                  <span className="text-muted-foreground block truncate text-[12px]">
                    exclusive to you
                  </span>
                </span>
                <Crown className="text-gold size-3.5 shrink-0" />
              </button>
            ) : null}

            {adminItems.length ? (
              <button
                onClick={() => setSlot("admin")}
                className={cn(
                  "mt-2 flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  isAdmin
                    ? "border-primary/60 bg-primary/10"
                    : "border-primary/35 hover:bg-primary/5",
                )}
              >
                <span className="min-w-0">
                  <span className="text-primary block font-mono text-[10px] tracking-[0.14em] uppercase">
                    Admin Vault
                    <span className="ml-1.5 opacity-70">{adminItems.length}</span>
                  </span>
                  <span className="text-muted-foreground block truncate text-[12px]">
                    staff issue only
                  </span>
                </span>
                <Shield className="text-primary size-3.5 shrink-0" />
              </button>
            ) : null}

            <Button asChild size="sm" variant="outline" className="mt-4 w-full">
              <Link to="/shop">
                <ShoppingBag className="size-3.5" /> Find more in the Shop
              </Link>
            </Button>
          </div>
        </Panel>

        {/* Slot contents */}
        <Panel className={cn("p-5", isVault && "border-gold/40", isAdmin && "border-primary/40")} delay={40}>
          <PanelHead
            eyebrow={meta?.label ?? "Locker"}
            title={meta?.blurb ?? "Your gear"}
            aside={`${list.length} owned`}
          />

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
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
            {vaultItems.length ? (
              <button
                onClick={() => setSlot("vault")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
                  isVault
                    ? "border-gold/60 bg-gold/15 text-gold"
                    : "border-gold/35 text-gold/80 hover:text-gold",
                )}
              >
                <Crown className="size-3" /> Vault
                <span className="opacity-70">{vaultItems.length}</span>
              </button>
            ) : null}
            {adminItems.length ? (
              <button
                onClick={() => setSlot("admin")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
                  isAdmin
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-primary/35 text-primary/80 hover:text-primary",
                )}
              >
                <Shield className="size-3" /> Admin
                <span className="opacity-70">{adminItems.length}</span>
              </button>
            ) : null}
            {activeSlug && !isExclusive ? (
              <button
                onClick={() => void clearSlot(slot as CosmeticSlot)}
                className="text-muted-foreground hover:text-destructive ml-auto font-mono text-[10px] tracking-[0.12em] uppercase"
              >
                Unequip slot
              </button>
            ) : null}
          </div>

          {cosmetics.isLoading || inventory.isLoading ? (
            <p className="text-muted-foreground mt-5 font-mono text-xs">Opening the locker…</p>
          ) : list.length === 0 ? (
            <div className="border-border/60 mt-5 rounded-xl border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-sm">
                {isVault
                  ? "No owner-exclusive pieces on this account."
                  : isAdmin
                  ? "No admin-issue pieces on this account."
                  : "Nothing in this slot yet — earn Sparks by playing and pick something up."}
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/shop">Open the Shop</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((item) => {
                const on = equipped[item.slot] === item.slug;
                return (
                  <button
                    key={item.slug}
                    onClick={() => void equip(item)}
                    className={cn(
                      "bg-background/40 hover:border-primary/40 flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors",
                      on ? "border-primary/60 bg-primary/10" : rarityBorder[item.rarity],
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display truncate text-[13px] font-semibold">
                          {item.name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                          {item.description}
                        </p>
                      </div>
                      <RarityChip rarity={item.rarity} />
                    </div>
                    <SlotPreview slug={item.slug} slot={item.slot} />
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
        </Panel>
      </div>
    </div>
  );
}

const MILESTONES = [
  { slug: "m-collector-5", goal: 5, label: "Collector I", xp: 200, sparks: 150 },
  { slug: "m-collector-15", goal: 15, label: "Collector II", xp: 500, sparks: 350 },
  { slug: "m-collector-30", goal: 30, label: "Collector III", xp: 1200, sparks: 800 },
  { slug: "armory-collector-4", goal: 50, label: "Curator", xp: 1500, sparks: 700 },
  { slug: "armory-collector-5", goal: 75, label: "Vault Master", xp: 2500, sparks: 1200 },
];

/** Collection milestones: one-time rewards for growing your locker. */
function Milestones({ owned, userId }: { owned: number; userId: string | null }) {
  const qc = useQueryClient();
  const { syncXp } = useDimted();
  const claims = useQuery({
    queryKey: ["armory-milestones", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_claims")
        .select("quest_slug")
        .in(
          "quest_slug",
          MILESTONES.map((m) => m.slug),
        );
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.quest_slug));
    },
  });

  async function claim(slug: string) {
    try {
      const res = await claimArmoryMilestone(slug);
      if (res?.status && res.status !== "granted" && res.status !== "awarded") {
        toast.error("Not ready to claim yet.");
        return;
      }
      syncXp(
        { gained: res?.reward_xp ?? 0, sparks_gained: res?.reward_sparks ?? 0 },
        "Collection milestone",
      );
      toast.success(`Milestone claimed: +${res?.reward_xp ?? 0} XP`);
      void qc.invalidateQueries({ queryKey: ["armory-milestones", userId] });
    } catch {
      toast.error("Couldn't claim that milestone.");
    }
  }

  return (
    <Panel className="p-4" delay={20}>
      <PanelHead
        eyebrow="Collection milestones"
        title="Rewards for building your locker"
        aside={`${owned} owned`}
      />
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {MILESTONES.map((m) => {
          const done = owned >= m.goal;
          const claimed = claims.data?.has(m.slug) ?? false;
          const pct = Math.min(100, Math.round((owned / m.goal) * 100));
          return (
            <div
              key={m.slug}
              className={cn(
                "bg-background/40 rounded-xl border p-3",
                claimed ? "border-border/60 opacity-70" : done ? "border-primary/50" : "border-border/60",
              )}
            >
              <p className="font-display text-sm font-semibold">{m.label}</p>
              <p className="text-muted-foreground text-xs">Own {m.goal} cosmetics</p>
              <div className="bg-secondary/60 mt-2 h-1.5 overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-muted-foreground numeral text-[11px]">
                  +{m.xp} XP · +{m.sparks} Sparks
                </span>
                <Button
                  size="sm"
                  variant={done && !claimed ? "default" : "outline"}
                  disabled={!done || claimed}
                  onClick={() => void claim(m.slug)}
                >
                  {claimed ? "Claimed" : done ? "Claim" : `${owned}/${m.goal}`}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
