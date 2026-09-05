import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHead } from "@/components/dimted/primitives";
import { Avatar } from "@/components/dimted/Identity";
import {
  crewLevel,
  fetchCrewMembers,
  fetchCrews,
  ownerDeleteCrew,
  ownerEditCrew,
  ownerRemoveCrewMember,
  ownerTransferCrew,
} from "@/lib/crews";
import { cn } from "@/lib/utils";

/**
 * Owner-only crew console: rename, restyle, retune shared XP, move members,
 * hand over leadership or delete a crew outright — for every crew on the site,
 * whether the owner is a member of it or not.
 */
export function OwnerCrewControl({ userId }: { userId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [xp, setXp] = useState("");
  const [limit, setLimit] = useState("");

  const crews = useQuery({
    queryKey: ["owner-crews", userId],
    queryFn: () => fetchCrews(userId),
    refetchInterval: 15000,
  });

  const rows = crews.data ?? [];
  const active = useMemo(() => rows.find((c) => c.id === selected) ?? null, [rows, selected]);

  const members = useQuery({
    queryKey: ["owner-crew-members", active?.id],
    enabled: !!active?.id,
    queryFn: () => fetchCrewMembers(active!.id),
  });

  function pick(id: string) {
    const crew = rows.find((c) => c.id === id);
    setSelected(id);
    setName(crew?.name ?? "");
    setTagline(crew?.tagline ?? "");
    setXp(String(crew?.total_xp ?? 0));
    setLimit(String(crew?.member_limit ?? 20));
  }

  async function guard(run: () => Promise<{ status: string }>, ok: string) {
    try {
      const res = await run();
      if (res.status !== "ok") {
        toast.error(res.status === "forbidden" ? "Owner only." : "That crew is gone.");
        return;
      }
      toast.success(ok);
      await crews.refetch();
      await members.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not go through.");
    }
  }

  return (
    <Panel className="p-5">
      <PanelHead eyebrow="Owner" title="Crew console" aside={`${rows.length} crews`} />

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows.length === 0 ? <li className="text-muted-foreground text-sm">No crews exist yet.</li> : null}
        {rows.map((crew) => (
          <li key={crew.id}>
            <button
              onClick={() => pick(crew.id)}
              className={cn(
                "border-border bg-background/40 hover:border-primary/40 flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition",
                crew.id === selected && "border-primary/60 bg-primary/5",
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-base">
                {crew.badge_emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{crew.name}</span>
                <span className="text-muted-foreground block truncate font-mono text-[10px]">
                  lvl {crewLevel(crew.total_xp).level} · {crew.memberCount} members · {crew.visibility}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div className="border-border mt-5 space-y-4 rounded-xl border p-3.5">
          <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
            Editing {active.name}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Crew name" />
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" />
            <Input value={xp} onChange={(e) => setXp(e.target.value)} placeholder="Shared XP" inputMode="numeric" />
            <Input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Member limit"
              inputMode="numeric"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                void guard(
                  () =>
                    ownerEditCrew(active.id, {
                      name,
                      tagline,
                      total_xp: Number(xp) || 0,
                      member_limit: Math.max(2, Number(limit) || active.member_limit),
                    }),
                  "Crew updated.",
                )
              }
            >
              Save changes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void guard(
                  () =>
                    ownerEditCrew(active.id, {
                      visibility: active.visibility === "public" ? "private" : "public",
                    }),
                  active.visibility === "public" ? "Crew is private now." : "Crew is public now.",
                )
              }
            >
              Make {active.visibility === "public" ? "private" : "public"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void guard(
                  () =>
                    ownerEditCrew(active.id, {
                      join_policy: active.join_policy === "open" ? "invite" : "open",
                    }),
                  "Join policy changed.",
                )
              }
            >
              {active.join_policy === "open" ? "Invite only" : "Open joining"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (!window.confirm(`Delete ${active.name} and all of its chat for good?`)) return;
                void guard(async () => {
                  const res = await ownerDeleteCrew(active.id);
                  setSelected(null);
                  return res;
                }, "Crew deleted.");
              }}
            >
              <Trash2 className="mr-1 size-3.5" /> Delete crew
            </Button>
          </div>

          <div>
            <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">Roster</p>
            <ul className="mt-2 space-y-1.5">
              {(members.data ?? []).map((m) => (
                <li
                  key={m.user_id}
                  className="border-border bg-background/40 flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
                >
                  {m.profile ? <Avatar profile={m.profile} size={26} /> : null}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {m.profile?.display_name ?? "unknown"}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px] uppercase">{m.role}</span>
                  <button
                    onClick={() => void guard(() => ownerTransferCrew(active.id, m.user_id), "Leader changed.")}
                    aria-label="Make crew leader"
                    className="text-muted-foreground hover:text-gold grid size-7 place-items-center rounded-lg"
                  >
                    <Crown className="size-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      void guard(() => ownerRemoveCrewMember(active.id, m.user_id), "Member removed.")
                    }
                    aria-label="Remove from crew"
                    className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
                  >
                    <UserMinus className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">Pick a crew to edit or delete it.</p>
      )}
    </Panel>
  );
}
