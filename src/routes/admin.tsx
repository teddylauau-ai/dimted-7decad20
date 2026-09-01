import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Crown, ShieldCheck, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { IdentityRow } from "@/components/dimted/Identity";
import { useDimted } from "@/lib/dimted-store";
import { useNewestProfiles } from "@/lib/dimted-queries";
import {
  ROLE_LABEL,
  useGrantRole,
  useMyRole,
  useRevokeRole,
  useRoles,
  type AppRole,
} from "@/lib/roles-queries";
import { GAMES } from "@/lib/games";
import { useDeleteScore, useLeaderboard } from "@/lib/games-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Staff panel — Dimted" },
      {
        name: "description",
        content: "Owner and admin controls for Dimted: grant roles, review the arcade leaderboards.",
      },
      { property: "og:title", content: "Dimted staff panel" },
      { property: "og:description", content: "Roles and moderation for Dimted." },
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

function AdminPage() {
  const { profile } = useDimted();
  const me = useMyRole(profile?.id);
  const roles = useRoles();
  const people = useNewestProfiles(profile?.id);
  const grant = useGrantRole();
  const revoke = useRevokeRole();
  const [filter, setFilter] = useState("");
  const [game, setGame] = useState(GAMES[0]!.id);
  const board = useLeaderboard(game);
  const removeScore = useDeleteScore();

  if (me.loading) {
    return <p className="text-muted-foreground p-4 font-mono text-xs">Checking your access…</p>;
  }

  if (!me.isStaff) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Staff" title="Not your door" blurb="This panel is for the owner and admins." />
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

  const grantable: AppRole[] = me.isOwner ? ["admin", "moderator", "member"] : ["moderator", "member"];
  const everyone = [profile, ...(people.data ?? [])].filter(Boolean) as {
    id: string;
    username: string;
    display_name: string;
    equipped_nametag?: string | null;
    equipped_badge?: string | null;
    equipped_frame?: string | null;
  }[];
  const unique = everyone.filter((p, i) => everyone.findIndex((q) => q.id === p.id) === i);
  const shown = unique.filter(
    (p) =>
      !filter ||
      p.display_name.toLowerCase().includes(filter.toLowerCase()) ||
      p.username.toLowerCase().includes(filter.toLowerCase()),
  );

  async function doGrant(userId: string, role: AppRole) {
    try {
      await grant.mutateAsync({ userId, role });
      toast.success(`${ROLE_LABEL[role]} granted.`);
    } catch {
      toast.error("Couldn't grant that role.");
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

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="Dimted control"
        blurb="Grant roles and keep the leaderboards honest."
        aside={
          <span className="flex items-center gap-2">
            {me.isOwner ? <Crown className="text-gold size-4" /> : <ShieldCheck className="text-primary size-4" />}
            <RoleChip role={me.role} />
          </span>
        }
      />

      <Panel className="p-5">
        <PanelHead
          eyebrow="Team"
          title="Who holds what"
          aside={`${(roles.data ?? []).length} grant${(roles.data ?? []).length === 1 ? "" : "s"}`}
        />
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
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
              {r.role !== "owner" ? (
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
      </Panel>

      <Panel className="p-5">
        <PanelHead eyebrow="Accounts" title="Grant a role" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search real accounts…"
          className="mt-4"
        />
        <ul className="mt-3 space-y-2">
          {shown.map((p) => {
            const held = (roles.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
            return (
              <li
                key={p.id}
                className="border-border bg-background/40 flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <IdentityRow profile={p} size={30} meta={held.map((r) => ROLE_LABEL[r]).join(" · ") || "no role"} />
                </div>
                {grantable.map((role) => (
                  <Button
                    key={role}
                    size="sm"
                    variant="outline"
                    disabled={held.includes(role) || held.includes("owner")}
                    onClick={() => void doGrant(p.id, role)}
                  >
                    + {ROLE_LABEL[role]}
                  </Button>
                ))}
              </li>
            );
          })}
        </ul>
      </Panel>

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
    </div>
  );
}
