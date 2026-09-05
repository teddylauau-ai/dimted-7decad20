import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Ban,
  Crown,
  Gem,
  MicOff,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserMinus,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { Avatar, IdentityRow } from "@/components/dimted/Identity";
import { useDimted } from "@/lib/dimted-store";
import { useCosmetics } from "@/lib/dimted-queries";
import { usePulseItems } from "@/lib/pulse-queries";
import { LEVELS } from "@/lib/pulse";
import { MAX_TOTAL_XP } from "@/lib/dimted";
import {
  ROLE_LABEL,
  ROLE_ORDER,
  ROLE_POWERS,
  ROLE_RANK,
  useAllAccounts,
  useEditProfile,
  useForceSurge,
  useCompletePulse,
  useGrantCosmetic,
  useGrantPulse,
  useGrantCurrency,
  useGrantRole,
  useMyRole,
  useRevokeRole,
  useRoles,
  useSetBan,
  useSetMute,
  useSetTitle,
  useStaffLog,
  useTitles,
  type AppRole,
  type ProfilePatch,
} from "@/lib/roles-queries";
import { ownerDeleteAccount } from "@/lib/dimted-actions";
import { OwnerCrewControl } from "@/components/dimted/OwnerCrewControl";

import { GAMES } from "@/lib/games";
import { useDeleteScore, useLeaderboard } from "@/lib/games-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Control panel — Lazu" },
      {
        name: "description",
        content:
          "Staff controls for Lazu: role hierarchy, bans and mutes, XP and sparks grants, cosmetics, crews and the audit log.",
      },
      { property: "og:title", content: "Lazu control panel" },
      { property: "og:description", content: "Roles, sanctions and grants for Lazu staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const ROLE_BADGE: Record<AppRole, string> = {
  owner: "text-gold border-gold/40 bg-gold/10",
  admin: "text-primary border-primary/40 bg-primary/10",
  moderator: "text-xp border-xp/40 bg-xp/10",
  member: "text-muted-foreground border-border bg-secondary/40",
};

function RoleChip({ role }: { role: AppRole }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] uppercase",
        ROLE_BADGE[role],
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

const EDIT_FIELDS: { key: keyof ProfilePatch; label: string; numeric?: boolean }[] = [
  { key: "display_name", label: "Display name" },
  { key: "username", label: "Username" },
  { key: "title", label: "Title" },
  { key: "bio", label: "Bio" },
  { key: "avatar_url", label: "Avatar URL" },
  { key: "total_xp", label: "Total XP", numeric: true },
  { key: "sparks", label: "Sparks", numeric: true },
  { key: "energy", label: "Energy (0-100)", numeric: true },
  { key: "streak", label: "Streak", numeric: true },
  { key: "equipped_nametag", label: "Equipped nametag" },
  { key: "equipped_badge", label: "Equipped badge" },
  { key: "equipped_frame", label: "Equipped frame" },
  { key: "equipped_banner", label: "Equipped banner" },
  { key: "equipped_effect", label: "Equipped effect" },
];

function sanctionLabel(until: string | null | undefined) {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.round(ms / 86_400_000);
  if (days > 365) return "permanent";
  if (days >= 1) return `${days}d left`;
  const mins = Math.max(1, Math.round(ms / 60_000));
  return mins >= 60 ? `${Math.round(mins / 60)}h left` : `${mins}m left`;
}

type AdminTab = "people" | "grants" | "roles" | "crews" | "logs";

/** Tabs are filtered by real rank: moderators get people + logs only. */
const TABS: { key: AdminTab; label: string; min: "mod" | "staff" | "owner"; needsTarget?: boolean }[] = [
  { key: "people", label: "People", min: "mod", needsTarget: true },
  { key: "grants", label: "Grants", min: "staff", needsTarget: true },
  { key: "roles", label: "Roles", min: "staff", needsTarget: true },
  { key: "crews", label: "Crews", min: "owner" },
  { key: "logs", label: "Logs", min: "mod" },
];

function AdminPage() {
  const { profile } = useDimted();
  const me = useMyRole(profile?.id);
  const roles = useRoles();
  const titles = useTitles();
  const cosmetics = useCosmetics();
  const pulseItems = usePulseItems();
  const log = useStaffLog();
  const accounts = useAllAccounts(me.isModerator);

  const grant = useGrantRole();
  const revoke = useRevokeRole();
  const grantCurrency = useGrantCurrency();
  const grantCosmetic = useGrantCosmetic();
  const grantPulse = useGrantPulse();
  const completePulse = useCompletePulse();
  const setTitle = useSetTitle();
  const forceSurge = useForceSurge();
  const setBan = useSetBan();
  const setMute = useSetMute();
  const editProfile = useEditProfile();

  const [tab, setTab] = useState<AdminTab>("people");
  const [filter, setFilter] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [xp, setXp] = useState("1000");
  const [pulseSlug, setPulseSlug] = useState("");
  const [pulseCoins, setPulseCoins] = useState("5000");
  const [sparks, setSparks] = useState("500");
  const [titleSlug, setTitleSlug] = useState("");
  const [cosmeticSlug, setCosmeticSlug] = useState("");
  const [reason, setReason] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showEditor, setShowEditor] = useState(false);
  const [game, setGame] = useState(GAMES[0]!.id);
  const board = useLeaderboard(game);
  const removeScore = useDeleteScore();

  const everyone = useMemo(() => accounts.data ?? [], [accounts.data]);
  const target = everyone.find((p) => p.id === (targetId ?? profile?.id)) ?? null;

  if (me.loading) {
    return <p className="text-muted-foreground p-4 font-mono text-xs">Checking your access…</p>;
  }

  if (!me.isModerator) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Staff"
          title="Not your door"
          blurb="This panel is for the owner, admins and moderators."
        />
        <Panel className="p-5">
          <p className="text-sm">
            You're signed in as <span className="font-medium">{profile?.display_name}</span> with the{" "}
            <span className="font-medium">{ROLE_LABEL[me.role]}</span> role. Ask the owner if you need
            access.
          </p>
        </Panel>
      </div>
    );
  }

  const myRank = ROLE_RANK[me.role];
  // Only the owner can create admins; everyone else stays strictly below their own rank.
  const grantable = (["admin", "moderator", "member"] as AppRole[]).filter((r) => ROLE_RANK[r] < myRank);

  const visibleTabs = TABS.filter((t) =>
    t.min === "owner" ? me.isOwner : t.min === "staff" ? me.isStaff : true,
  );
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : "people";
  const needsTarget = visibleTabs.find((t) => t.key === activeTab)?.needsTarget ?? false;

  const shown = everyone.filter(
    (p) =>
      !filter ||
      p.display_name.toLowerCase().includes(filter.toLowerCase()) ||
      p.username.toLowerCase().includes(filter.toLowerCase()),
  );

  function fail(e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "forbidden") toast.error("Your rank doesn't allow that.");
    else if (msg === "no_target") toast.error("That account no longer exists.");
    else toast.error("That didn't go through.");
  }

  async function doGrant(userId: string, role: AppRole) {
    try {
      await grant.mutateAsync({ userId, role });
      toast.success(`${ROLE_LABEL[role]} granted.`);
    } catch {
      toast.error("Couldn't grant that role — check the hierarchy.");
    }
  }

  async function doRevoke(id: string, label: string) {
    try {
      await revoke.mutateAsync(id);
      toast.success(`${label} removed.`);
    } catch {
      toast.error("Couldn't remove that role.");
    }
  }

  async function payOut(xpAmount: number, sparkAmount: number) {
    if (!target) return;
    try {
      await grantCurrency.mutateAsync({ userId: target.id, xp: xpAmount, sparks: sparkAmount });
      toast.success(
        `${target.display_name}: ${xpAmount >= 0 ? "+" : ""}${xpAmount.toLocaleString()} XP · ${sparkAmount >= 0 ? "+" : ""}${sparkAmount.toLocaleString()} sparks`,
      );
    } catch (e) {
      fail(e);
    }
  }

  async function givePulse(opts: { slug?: string; coins?: number }) {
    if (!target) return;
    try {
      const args: { userId: string; slug?: string; coins?: number } = { userId: target.id };
      if (opts.slug) args.slug = opts.slug;
      if (opts.coins) args.coins = opts.coins;
      const res = (await grantPulse.mutateAsync(args)) as { coins?: number };
      toast.success(`Pulse Rush updated · ${String(res.coins ?? 0)} coins`);
    } catch (e) {
      fail(e);
    }
  }

  async function unlock(slug: string) {
    if (!target) return;
    try {
      await grantCosmetic.mutateAsync({ userId: target.id, slug });
      toast.success(slug === "*" ? "Entire collection unlocked." : "Cosmetic unlocked.");
    } catch (e) {
      fail(e);
    }
  }

  async function applyTitle(slug: string) {
    if (!target) return;
    try {
      const res = (await setTitle.mutateAsync({ userId: target.id, title: slug })) as { title?: string };
      toast.success(`Title set to “${res?.title ?? slug}”.`);
    } catch (e) {
      fail(e);
    }
  }

  async function applyBan(minutes: number) {
    if (!target) return;
    try {
      await setBan.mutateAsync({ userId: target.id, minutes, reason: reason.trim() });
      toast.success(
        minutes === 0
          ? `${target.display_name} unbanned.`
          : `${target.display_name} banned${minutes < 0 ? " permanently" : ""}.`,
      );
    } catch (e) {
      fail(e);
    }
  }

  async function wipeAccount() {
    if (!target) return;
    if (
      !confirm(
        `Permanently delete ${target.display_name} (@${target.username})? This erases their messages, scores and sign-in and cannot be undone.`,
      )
    )
      return;
    try {
      const res = await ownerDeleteAccount(target.id);
      if (res.status !== "ok") {
        toast.error(
          res.status === "forbidden" ? "You can't delete that account" : "That account no longer exists",
        );
        return;
      }
      toast.success(`${target.display_name} deleted`);
      setTargetId(null);
    } catch (e) {
      fail(e);
    }
  }

  async function applyMute(minutes: number) {
    if (!target) return;
    try {
      await setMute.mutateAsync({ userId: target.id, minutes, reason: reason.trim() });
      toast.success(minutes === 0 ? `${target.display_name} unmuted.` : `${target.display_name} muted.`);
    } catch (e) {
      fail(e);
    }
  }

  async function saveEdits() {
    if (!target) return;
    const patch: Record<string, string | number> = {};
    for (const field of EDIT_FIELDS) {
      const raw = edits[field.key as string];
      if (raw === undefined) continue;
      patch[field.key as string] = field.numeric ? Number(raw) || 0 : raw;
    }
    if (Object.keys(patch).length === 0) {
      toast.error("Change a field first.");
      return;
    }
    try {
      await editProfile.mutateAsync({ userId: target.id, patch: patch as ProfilePatch });
      setEdits({});
      toast.success(`${target.display_name}'s account updated.`);
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Staff"
        title="Control panel"
        blurb={
          me.isOwner
            ? "Owner: every account field, uncapped grants, titles, roles, crews and permanent bans."
            : me.isStaff
              ? "Admin: bans, mutes, grants up to 25,000 per action, cosmetics and moderator roles. Titles, account editing, crews and admin roles stay with the owner."
              : "Moderator: mutes up to 24 hours, direct-message clean-up and the audit log."
        }
        aside={
          <span className="flex items-center gap-2">
            {me.isOwner ? <Crown className="text-gold size-4" /> : <ShieldCheck className="text-primary size-4" />}
            <RoleChip role={me.role} />
          </span>
        }
      />

      {/* ---- Section tabs ---- */}
      <div className="border-border bg-background/40 flex flex-wrap gap-1 rounded-2xl border p-1">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-xl px-3 py-1.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors",
              activeTab === t.key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Slim account picker (only where a target matters) ---- */}
      {needsTarget ? (
        <Panel className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
              Target
            </span>
            <span className="text-sm font-medium">{target ? target.display_name : "pick an account"}</span>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search accounts…"
              className="ml-auto h-8 w-full sm:w-52"
            />
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {shown.map((p) => {
              const active = p.id === target?.id;
              const banned = sanctionLabel(p.banned_until);
              const muted = sanctionLabel(p.muted_until);
              return (
                <button
                  key={p.id}
                  onClick={() => setTargetId(p.id)}
                  className={cn(
                    "border-border bg-background/40 hover:bg-secondary/50 flex shrink-0 items-center gap-1.5 rounded-xl border px-2 py-1 text-left transition-colors",
                    active && "border-primary/60 bg-primary/10",
                  )}
                >
                  <Avatar profile={p} size={20} />
                  <span className="text-xs font-medium">{p.display_name}</span>
                  {banned ? (
                    <span className="text-destructive font-mono text-[9px] uppercase">banned</span>
                  ) : muted ? (
                    <span className="text-gold font-mono text-[9px] uppercase">muted</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {needsTarget && target ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ---- People: sanctions ---- */}
          {activeTab === "people" ? (
            <Panel className="p-4">
              <PanelHead
                eyebrow="Moderation"
                title={target.display_name}
                aside={me.isStaff ? "bans + mutes" : "mutes to 24h"}
              />
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                Ban: <span className="text-foreground">{sanctionLabel(target.banned_until) ?? "clean"}</span> ·
                Mute: <span className="text-foreground">{sanctionLabel(target.muted_until) ?? "clean"}</span>
                {target.ban_reason ? ` · “${target.ban_reason}”` : ""}
              </p>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)…"
                maxLength={120}
                className="mt-2 h-9"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => void applyMute(60)}>
                  <MicOff className="size-4" /> Mute 1h
                </Button>
                <Button size="sm" variant="outline" onClick={() => void applyMute(1440)}>
                  Mute 24h
                </Button>
                {me.isStaff ? (
                  <Button size="sm" variant="outline" onClick={() => void applyMute(10080)}>
                    Mute 7d
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => void applyMute(0)}>
                  Unmute
                </Button>
              </div>
              {me.isStaff ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => void applyBan(1440)}>
                    <Ban className="size-4" /> Ban 24h
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void applyBan(10080)}>
                    Ban 7d
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void applyBan(-1)}>
                    Ban forever
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void applyBan(0)}>
                    Lift ban
                  </Button>
                </div>
              ) : null}
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                A ban stops all messaging and XP; a mute only stops messaging. Neither works on an account
                at or above your own rank.
              </p>
              {me.isOwner ? (
                <div className="border-destructive/30 mt-3 flex flex-wrap items-center gap-2 rounded-xl border p-2.5">
                  <span className="text-destructive font-mono text-[10px] tracking-[0.16em] uppercase">
                    Danger zone
                  </span>
                  <Button size="sm" variant="destructive" className="ml-auto" onClick={() => void wipeAccount()}>
                    <Trash2 className="size-4" /> Delete account
                  </Button>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {/* ---- People: owner-only account editor ---- */}
          {activeTab === "people" && me.isOwner ? (
            <Panel className="p-4">
              <div className="flex items-center gap-2">
                <PanelHead eyebrow="Owner" title="Edit any field" />
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => setShowEditor((v) => !v)}
                >
                  <Pencil className="size-4" /> {showEditor ? "Hide" : "Open editor"}
                </Button>
              </div>
              {showEditor ? (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {EDIT_FIELDS.map((field) => {
                      const key = field.key as string;
                      const current = (target as unknown as Record<string, unknown>)[key];
                      return (
                        <label key={key} className="space-y-1">
                          <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                            {field.label}
                          </span>
                          <Input
                            className="h-9"
                            value={edits[key] ?? (current === null || current === undefined ? "" : String(current))}
                            inputMode={field.numeric ? "numeric" : undefined}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button size="sm" onClick={() => void saveEdits()} disabled={editProfile.isPending}>
                      Save changes
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEdits({})}>
                      Reset fields
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  Rewrite {target.display_name}'s name, handle, title, XP, sparks, energy, streak, avatar and
                  equipped cosmetics.
                </p>
              )}
            </Panel>
          ) : null}

          {/* ---- Grants: XP, sparks, surge ---- */}
          {activeTab === "grants" && me.isStaff ? (
            <Panel className="p-4">
              <PanelHead
                eyebrow="Economy"
                title="XP and sparks"
                aside={me.isOwner ? `max ${MAX_TOTAL_XP.toLocaleString()} XP` : "±25,000 each"}
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input className="h-9" value={xp} inputMode="numeric" onChange={(e) => setXp(e.target.value)} />
                <Input
                  className="h-9"
                  value={sparks}
                  inputMode="numeric"
                  onChange={(e) => setSparks(e.target.value)}
                />
              </div>
              <p className="text-muted-foreground mt-1 font-mono text-[10px] uppercase">XP · sparks</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  onClick={() => void payOut(Number(xp) || 0, Number(sparks) || 0)}
                  disabled={grantCurrency.isPending}
                >
                  <Sparkles className="size-4" /> Grant
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void payOut(-(Number(xp) || 0), -(Number(sparks) || 0))}
                >
                  Take back
                </Button>
                {me.isOwner ? (
                  <Button size="sm" variant="outline" onClick={() => void payOut(MAX_TOTAL_XP, 50000)}>
                    Max out
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!target) return;
                    try {
                      await forceSurge.mutateAsync({ userId: target.id, minutes: 60 });
                      toast.success("Double XP surge running for 60 minutes.");
                    } catch (e) {
                      fail(e);
                    }
                  }}
                >
                  <Zap className="size-4" /> Surge 1h
                </Button>
              </div>
            </Panel>
          ) : null}

          {/* ---- Grants: cosmetics ---- */}
          {activeTab === "grants" && me.isStaff ? (
            <Panel className="p-4">
              <PanelHead
                eyebrow="Wardrobe"
                title="Unlock cosmetics"
                aside={`${(cosmetics.data ?? []).length} items`}
              />
              <select
                value={cosmeticSlug}
                onChange={(e) => setCosmeticSlug(e.target.value)}
                className="border-border bg-secondary/40 focus-visible:ring-ring mt-3 w-full rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">Choose an item…</option>
                {(cosmetics.data ?? []).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name} · {c.slot} · {c.rarity}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  disabled={!cosmeticSlug || grantCosmetic.isPending}
                  onClick={() => void unlock(cosmeticSlug)}
                >
                  <Gem className="size-4" /> Unlock item
                </Button>
                {me.isOwner ? (
                  <Button size="sm" variant="outline" onClick={() => void unlock("*")}>
                    Unlock everything
                  </Button>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                Items land in their inventory — they still choose what to equip. Owner and admin vault items
                stay locked to those ranks.
              </p>
            </Panel>
          ) : null}

          {/* ---- Grants: Pulse Rush ---- */}
          {activeTab === "grants" && me.isStaff ? (
            <Panel className="p-4">
              <PanelHead
                eyebrow="Pulse Rush"
                title="Coins and locker"
                aside={`${(pulseItems.data ?? []).length} items`}
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input
                  className="h-9"
                  value={pulseCoins}
                  inputMode="numeric"
                  onChange={(e) => setPulseCoins(e.target.value)}
                />
                <select
                  value={pulseSlug}
                  onChange={(e) => setPulseSlug(e.target.value)}
                  className="border-border bg-secondary/40 focus-visible:ring-ring w-full rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="">Choose a locker item…</option>
                  {(pulseItems.data ?? []).map((i) => (
                    <option key={i.slug} value={i.slug}>
                      {i.name} · {i.kind} · {i.rarity}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  disabled={grantPulse.isPending}
                  onClick={() => void givePulse({ coins: Number(pulseCoins) || 0 })}
                >
                  <Sparkles className="size-4" /> Give coins
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pulseSlug || grantPulse.isPending}
                  onClick={() => void givePulse({ slug: pulseSlug })}
                >
                  <Gem className="size-4" /> Unlock item
                </Button>
                {me.isOwner ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void givePulse({ slug: "*", coins: 100000 })}
                    >
                      Whole locker
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={completePulse.isPending}
                      onClick={async () => {
                        if (!target) return;
                        try {
                          await completePulse.mutateAsync({ userId: target.id, levels: LEVELS.length });
                          toast.success(`All ${LEVELS.length} levels cleared with every secret coin.`);
                        } catch (e) {
                          fail(e);
                        }
                      }}
                    >
                      <Zap className="size-4" /> Clear all {LEVELS.length}
                    </Button>
                  </>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {/* ---- Grants: titles (owner only, hidden otherwise) ---- */}
          {activeTab === "grants" && me.isOwner ? (
            <Panel className="p-4">
              <PanelHead eyebrow="Titles" title="The line under their name" aside="owner only" />
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                Currently: <span className="text-foreground font-medium">{target.title ?? "Newcomer"}</span>.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(titles.data ?? []).map((t) => (
                  <Button
                    key={t.slug}
                    size="sm"
                    variant={target.title === t.label ? "default" : "outline"}
                    onClick={() => void applyTitle(t.slug)}
                  >
                    <span className="text-gold font-mono text-[10px]">T{t.tier}</span> {t.label}
                  </Button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  className="h-9"
                  value={titleSlug}
                  onChange={(e) => setTitleSlug(e.target.value)}
                  placeholder="Custom title…"
                  maxLength={40}
                />
                <Button size="sm" variant="outline" disabled={!titleSlug.trim()} onClick={() => void applyTitle(titleSlug)}>
                  Set
                </Button>
              </div>
            </Panel>
          ) : null}

          {/* ---- Roles ---- */}
          {activeTab === "roles" && me.isStaff ? (
            <Panel className="p-4">
              <PanelHead eyebrow="Hierarchy" title="Who holds what" aside="owner › admin › moderator" />
              <ul className="mt-3 grid gap-1.5">
                {(roles.data ?? []).map((r) => (
                  <li
                    key={r.id}
                    className="border-border bg-background/40 flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      {r.profile ? (
                        <IdentityRow profile={r.profile} size={26} />
                      ) : (
                        <span className="text-muted-foreground font-mono text-[11px]">unknown account</span>
                      )}
                    </div>
                    <RoleChip role={r.role} />
                    {ROLE_RANK[r.role] < myRank ? (
                      <button
                        onClick={() => void doRevoke(r.id, ROLE_LABEL[r.role])}
                        aria-label="Remove role"
                        className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
                      >
                        <UserMinus className="size-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 font-mono text-[10px] tracking-[0.14em] uppercase">
                Grant to {target.display_name}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {grantable.map((role) => {
                  const held = (roles.data ?? []).filter((r) => r.user_id === target.id).map((r) => r.role);
                  return (
                    <Button
                      key={role}
                      size="sm"
                      variant="outline"
                      disabled={held.includes(role) || held.includes("owner")}
                      onClick={() => void doGrant(target.id, role)}
                    >
                      + {ROLE_LABEL[role]}
                    </Button>
                  );
                })}
              </div>
              {!me.isOwner ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Admin is owner-only — you can hand out moderator and member.
                </p>
              ) : null}
            </Panel>
          ) : null}

          {/* ---- Roles: what each rank really does ---- */}
          {activeTab === "roles" ? (
            <Panel className="p-4">
              <PanelHead eyebrow="Reference" title="What each rank can do" aside="enforced in the database" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ROLE_ORDER.map((role) => (
                  <div
                    key={role}
                    className={cn(
                      "border-border bg-background/40 rounded-xl border p-2.5",
                      role === me.role && "border-primary/50 bg-primary/5",
                    )}
                  >
                    <RoleChip role={role} />
                    <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-xs leading-relaxed">
                      {ROLE_POWERS[role].map((power) => (
                        <li key={power}>· {power}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* ---- Owner: crews ---- */}
      {activeTab === "crews" && me.isOwner && profile?.id ? (
        <OwnerCrewControl userId={profile.id} />
      ) : null}

      {/* ---- Logs: arcade scores + audit ---- */}
      {activeTab === "logs" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-4">
            <PanelHead eyebrow="Moderation" title="Arcade scores" aside="staff can delete" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {GAMES.map((g) => (
                <Button
                  key={g.id}
                  size="sm"
                  variant={g.id === game ? "default" : "outline"}
                  onClick={() => setGame(g.id)}
                >
                  {g.name}
                </Button>
              ))}
            </div>
            <ul className="mt-2 space-y-1.5">
              {(board.data ?? []).length === 0 ? (
                <li className="text-muted-foreground text-sm">No scores yet.</li>
              ) : null}
              {(board.data ?? []).map((row) => (
                <li
                  key={row.id}
                  className="border-border bg-background/40 flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    {row.profile ? <IdentityRow profile={row.profile} size={26} /> : null}
                  </div>
                  <span className="numeral text-sm">{row.score.toLocaleString()}</span>
                  {me.isStaff ? (
                    <button
                      onClick={() => void removeScore.mutateAsync(row.id)}
                      aria-label="Delete score"
                      className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-4">
            <PanelHead eyebrow="Audit" title="Recent staff actions" />
            <ul className="mt-3 space-y-1">
              {(log.data ?? []).length === 0 ? (
                <li className="text-muted-foreground text-sm">Nothing logged yet.</li>
              ) : null}
              {(log.data ?? []).map((a) => {
                const actor = everyone.find((p) => p.id === a.actor_id)?.display_name ?? "staff";
                const to = everyone.find((p) => p.id === a.target_id)?.display_name ?? "someone";
                return (
                  <li key={a.id} className="text-muted-foreground font-mono text-[11px]">
                    <span className="text-foreground">{actor}</span> → {to} · {a.action}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
