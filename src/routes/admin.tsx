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
import {
  ROLE_LABEL,
  ROLE_ORDER,
  ROLE_POWERS,
  ROLE_RANK,
  useAllAccounts,
  useEditProfile,
  useForceSurge,
  useGrantCosmetic,
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
  type StaffAccount,
} from "@/lib/roles-queries";
import { GAMES } from "@/lib/games";
import { useDeleteScore, useLeaderboard } from "@/lib/games-queries";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Control panel — Dimted" },
      {
        name: "description",
        content:
          "Owner and admin controls for Dimted: role hierarchy, titles, XP and sparks grants, cosmetics and leaderboard moderation.",
      },
      { property: "og:title", content: "Dimted control panel" },
      { property: "og:description", content: "Roles, titles and grants for Dimted." },
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

type Person = StaffAccount;

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

function AdminPage() {
  const { profile } = useDimted();
  const me = useMyRole(profile?.id);
  const roles = useRoles();
  const titles = useTitles();
  const cosmetics = useCosmetics();
  const log = useStaffLog();
  const accounts = useAllAccounts(me.isModerator);

  const grant = useGrantRole();
  const revoke = useRevokeRole();
  const grantCurrency = useGrantCurrency();
  const grantCosmetic = useGrantCosmetic();
  const setTitle = useSetTitle();
  const forceSurge = useForceSurge();
  const setBan = useSetBan();
  const setMute = useSetMute();
  const editProfile = useEditProfile();

  const [filter, setFilter] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [xp, setXp] = useState("1000");
  const [sparks, setSparks] = useState("500");
  const [titleSlug, setTitleSlug] = useState("");
  const [cosmeticSlug, setCosmeticSlug] = useState("");
  const [reason, setReason] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
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
  // Only the owner can create admins; admins stay below their own rank.
  const grantable = (["admin", "moderator", "member"] as AppRole[]).filter((r) => ROLE_RANK[r] < myRank);

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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="Control panel"
        blurb={
          me.isOwner
            ? "Owner access: edit any account field, full grants, the title ladder, bans and the role hierarchy."
            : me.isStaff
              ? "Admin access: capped grants, bans, mutes and moderation. Titles, profile edits and admin roles are owner-only."
              : "Moderator access: mutes up to 24 hours and message clean-up. Grants and bans are for admins and the owner."
        }

        aside={
          <span className="flex items-center gap-2">
            {me.isOwner ? <Crown className="text-gold size-4" /> : <ShieldCheck className="text-primary size-4" />}
            <RoleChip role={me.role} />
          </span>
        }
      />

      {/* ---- Target picker ---- */}
      <Panel className="p-5">
        <PanelHead eyebrow="Grant desk" title="Pick an account" aside={`${everyone.length} real accounts`} />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search accounts…"
          className="mt-4"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {shown.map((p) => {
            const active = p.id === target?.id;
            const banned = sanctionLabel(p.banned_until);
            const muted = sanctionLabel(p.muted_until);
            return (
              <button
                key={p.id}
                onClick={() => setTargetId(p.id)}
                className={cn(
                  "border-border bg-background/40 hover:bg-secondary/50 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors",
                  active && "border-primary/60 bg-primary/10",
                )}
              >
                <Avatar profile={p} size={24} />
                <span className="text-sm font-medium">{p.display_name}</span>
                <span className="text-muted-foreground font-mono text-[10px]">@{p.username}</span>
                {banned ? (
                  <span className="text-destructive border-destructive/40 bg-destructive/10 rounded-full border px-1.5 font-mono text-[9px] uppercase">
                    banned
                  </span>
                ) : muted ? (
                  <span className="text-gold border-gold/40 bg-gold/10 rounded-full border px-1.5 font-mono text-[9px] uppercase">
                    muted
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Panel>

      {target ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ---- Sanctions ---- */}
          <Panel className="p-5">
            <PanelHead
              eyebrow="Moderation"
              title={`Sanction ${target.display_name}`}
              aside={me.isStaff ? "bans + mutes" : "mutes only"}
            />
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Ban: <span className="text-foreground">{sanctionLabel(target.banned_until) ?? "clean"}</span> ·
              Mute: <span className="text-foreground">{sanctionLabel(target.muted_until) ?? "clean"}</span>
              {target.ban_reason ? ` · “${target.ban_reason}”` : ""}
            </p>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)…"
              maxLength={120}
              className="mt-3"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void applyMute(60)}>
                <MicOff className="size-4" /> Mute 1h
              </Button>
              <Button size="sm" variant="outline" onClick={() => void applyMute(1440)}>
                Mute 24h
              </Button>
              <Button size="sm" variant="outline" onClick={() => void applyMute(0)}>
                Unmute
              </Button>
            </div>
            {me.isStaff ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void applyBan(1440)}>
                  <Ban className="size-4" /> Ban 24h
                </Button>
                <Button size="sm" variant="outline" onClick={() => void applyBan(10080)}>
                  Ban 7d
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void applyBan(-1)}>
                  Ban permanently
                </Button>
                <Button size="sm" variant="outline" onClick={() => void applyBan(0)}>
                  Lift ban
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground mt-2 text-xs">Bans are admin and owner only.</p>
            )}
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              A ban stops all messaging and XP. A mute only stops messaging. Neither can touch an account at
              or above your own rank.
            </p>
          </Panel>

          {/* ---- Owner: edit anything ---- */}
          {me.isOwner ? (
            <Panel className="p-5">
              <PanelHead eyebrow="Owner" title={`Edit ${target.display_name}'s account`} aside="everything" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {EDIT_FIELDS.map((field) => {
                  const key = field.key as string;
                  const current = (target as unknown as Record<string, unknown>)[key];
                  return (
                    <label key={key} className="space-y-1">
                      <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                        {field.label}
                      </span>
                      <Input
                        value={edits[key] ?? (current === null || current === undefined ? "" : String(current))}
                        inputMode={field.numeric ? "numeric" : undefined}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void saveEdits()} disabled={editProfile.isPending}>
                  <Pencil className="size-4" /> Save changes
                </Button>
                <Button variant="outline" onClick={() => setEdits({})}>
                  Reset fields
                </Button>
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                Every field here is yours to rewrite on any account — name, handle, title, XP, sparks, energy,
                streak, avatar and equipped cosmetics.
              </p>
            </Panel>
          ) : null}

          {/* ---- XP / sparks ---- */}
          {me.isStaff ? (
          <Panel className="p-5">

            <PanelHead
              eyebrow="Economy"
              title={`Give ${target.display_name} anything`}
              aside={me.isOwner ? "uncapped" : "±25,000 per grant"}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                  XP
                </span>
                <Input value={xp} inputMode="numeric" onChange={(e) => setXp(e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                  Sparks
                </span>
                <Input value={sparks} inputMode="numeric" onChange={(e) => setSparks(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => void payOut(Number(xp) || 0, Number(sparks) || 0)}
                disabled={grantCurrency.isPending}
              >
                <Sparkles className="size-4" /> Grant
              </Button>
              <Button variant="outline" onClick={() => void payOut(-(Number(xp) || 0), -(Number(sparks) || 0))}>
                Take back
              </Button>
              <Button variant="outline" onClick={() => void payOut(10000, 2000)}>
                +10k XP
              </Button>
              {me.isOwner ? (
                <Button variant="outline" onClick={() => void payOut(250000, 50000)}>
                  Max out
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={async () => {
                  if (!target) return;
                  try {
                    await forceSurge.mutateAsync({ userId: target.id, minutes: 60 });
                    toast.success("Surge running for 60 minutes.");
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                <Zap className="size-4" /> Force surge
              </Button>
            </div>
          </Panel>

          {/* ---- Cosmetics ---- */}
          <Panel className="p-5">
            <PanelHead eyebrow="Wardrobe" title="Unlock cosmetics" aside={`${(cosmetics.data ?? []).length} items`} />
            <select
              value={cosmeticSlug}
              onChange={(e) => setCosmeticSlug(e.target.value)}
              className="border-border bg-secondary/40 focus-visible:ring-ring mt-4 w-full rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">Choose an item…</option>
              {(cosmetics.data ?? []).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} · {c.slot} · {c.rarity}
                </option>
              ))}
            </select>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={!cosmeticSlug || grantCosmetic.isPending} onClick={() => void unlock(cosmeticSlug)}>
                <Gem className="size-4" /> Unlock item
              </Button>
              {me.isOwner ? (
                <Button variant="outline" onClick={() => void unlock("*")}>
                  Unlock everything
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Unlocked items land in their inventory — they still choose what to equip.
            </p>
          </Panel>

          {/* ---- Titles: owner only ---- */}
          <Panel className="p-5">
            <PanelHead
              eyebrow="Titles"
              title="The line under their name"
              aside={me.isOwner ? "owner only" : "locked"}
            />
            {me.isOwner ? (
              <>
                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                  Currently: <span className="text-foreground font-medium">{target.title ?? "Newcomer"}</span>.
                  Higher tiers are the rarer names.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
                <div className="mt-3 flex gap-2">
                  <Input
                    value={titleSlug}
                    onChange={(e) => setTitleSlug(e.target.value)}
                    placeholder="Custom title…"
                    maxLength={40}
                  />
                  <Button variant="outline" disabled={!titleSlug.trim()} onClick={() => void applyTitle(titleSlug)}>
                    Set
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                Only the owner hands out titles. You can still grant XP, sparks and cosmetics.
              </p>
            )}
          </Panel>

          {/* ---- Roles ---- */}
          <Panel className="p-5">
            <PanelHead eyebrow="Hierarchy" title="Roles" aside="owner › admin › moderator › member" />
            <ul className="mt-4 grid gap-2">
              {(roles.data ?? []).map((r) => (
                <li
                  key={r.id}
                  className="border-border bg-background/40 flex items-center gap-2 rounded-xl border px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    {r.profile ? (
                      <IdentityRow profile={r.profile} size={28} />
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
            <div className="mt-4 space-y-2">
              <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                Grant to {target.display_name}
              </p>
              <div className="flex flex-wrap gap-2">
                {grantable.map((role) => {
                  const held = (roles.data ?? [])
                    .filter((r) => r.user_id === target.id)
                    .map((r) => r.role);
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
                <p className="text-muted-foreground text-xs">Admin role grants are owner-only.</p>
              ) : null}
            </div>
          </Panel>
        </div>
      ) : null}

      {/* ---- Moderation ---- */}
      <Panel className="p-5">
        <PanelHead eyebrow="Moderation" title="Arcade scores" />
        <div className="mt-4 flex flex-wrap gap-2">
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
        <ul className="mt-3 space-y-2">
          {(board.data ?? []).length === 0 ? (
            <li className="text-muted-foreground text-sm">No scores yet.</li>
          ) : null}
          {(board.data ?? []).map((row) => (
            <li
              key={row.id}
              className="border-border bg-background/40 flex items-center gap-2 rounded-xl border px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                {row.profile ? <IdentityRow profile={row.profile} size={28} /> : null}
              </div>
              <span className="numeral text-sm">{row.score.toLocaleString()}</span>
              <button
                onClick={() => void removeScore.mutateAsync(row.id)}
                aria-label="Delete score"
                className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ---- Audit ---- */}
      <Panel className="p-5">
        <PanelHead eyebrow="Audit" title="Recent staff actions" />
        <ul className="mt-4 space-y-1.5">
          {(log.data ?? []).length === 0 ? (
            <li className="text-muted-foreground text-sm">Nothing granted yet.</li>
          ) : null}
          {(log.data ?? []).map((a) => {
            const actor = everyone.find((p) => p.id === a.actor_id)?.display_name ?? "staff";
            const to = everyone.find((p) => p.id === a.target_id)?.display_name ?? "someone";
            return (
              <li key={a.id} className="text-muted-foreground font-mono text-[11px]">
                <span className="text-foreground">{actor}</span> → {to} · {a.action} ·{" "}
                {JSON.stringify(a.detail)}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
