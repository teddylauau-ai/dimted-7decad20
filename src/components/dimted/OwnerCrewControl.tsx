import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Sparkles, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHead } from "@/components/dimted/primitives";
import { Avatar } from "@/components/dimted/Identity";
import {
  CREW_ACCENTS,
  CREW_BADGE_STYLES,
  CREW_CHAT_BGS,
  CREW_NAMETAGS,
  CREW_TEXT_EFFECTS,
  CREW_MAX_XP,
  crewLevel,
  fetchCrewMembers,
  fetchCrews,
  ownerDeleteCrew,
  ownerEditCrew,
  ownerMaxCrew,
  ownerRemoveCrewMember,
  ownerTransferCrew,
} from "@/lib/crews";
import { cn } from "@/lib/utils";

/**
 * Owner-only crew console: every crew on the site in one list, with live edits
 * to name, tagline, emoji, accent, styles, shared XP, member limit, visibility
 * and join policy — plus roster moves, leadership hand-over and deletion.
 */
export function OwnerCrewControl({ userId }: { userId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [emoji, setEmoji] = useState("");
  const [xp, setXp] = useState("");
  const [limit, setLimit] = useState("");

  const crews = useQuery({
    queryKey: ["owner-crews", userId],
    queryFn: () => fetchCrews(userId),
    refetchInterval: 20000,
  });

  const rows = crews.data ?? [];
  const active = useMemo(() => rows.find((c) => c.id === selected) ?? null, [rows, selected]);
  const listed = rows.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase()),
  );

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
    setEmoji(crew?.badge_emoji ?? "");
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

  const patch = (p: Record<string, unknown>, ok: string) => void guard(() => ownerEditCrew(active!.id, p), ok);

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <PanelHead eyebrow="Owner" title="Crew console" aside={`${rows.length} crews`} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search crews…"
          className="ml-auto h-8 w-full sm:w-48"
        />
      </div>

      {crews.isError ? (
        <p className="text-destructive mt-3 text-sm">Couldn't load crews — try again in a moment.</p>
      ) : null}

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {listed.length === 0 ? (
          <p className="text-muted-foreground text-sm">{rows.length === 0 ? "No crews exist yet." : "No match."}</p>
        ) : null}
        {listed.map((crew) => (
          <button
            key={crew.id}
            onClick={() => pick(crew.id)}
            className={cn(
              "border-border bg-background/40 hover:border-primary/40 flex shrink-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition",
              crew.id === selected && "border-primary/60 bg-primary/5",
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/5 text-sm">
              {crew.badge_emoji}
            </span>
            <span>
              <span className="block text-xs font-medium">{crew.name}</span>
              <span className="text-muted-foreground block font-mono text-[10px]">
                lvl {crewLevel(crew.total_xp).level} · {crew.memberCount}/{crew.member_limit} · {crew.visibility}
              </span>
            </span>
          </button>
        ))}
      </div>

      {active ? (
        <div className="border-border mt-4 space-y-3 rounded-xl border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
              {active.name} · lvl {crewLevel(active.total_xp).level} · {active.total_xp.toLocaleString()} xp
            </p>
            <Button
              size="sm"
              className="bg-gold/15 text-gold hover:bg-gold/25 border-gold/40 ml-auto border"
              onClick={() =>
                void guard(async () => {
                  const res = await ownerMaxCrew(active.id);
                  setXp(String(CREW_MAX_XP));
                  setLimit("100");
                  return res;
                }, `${active.name} maxed — every crew unlock is live.`)
              }
            >
              <Sparkles className="mr-1 size-3.5" /> Give everything
            </Button>
          </div>

          {/* ---- Text fields ---- */}
          <div className="grid gap-2 sm:grid-cols-4">
            <Input className="h-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <Input
              className="h-9 sm:col-span-2"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Tagline"
            />
            <Input
              className="h-9"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              placeholder="Emoji"
            />
            <Input className="h-9" value={xp} onChange={(e) => setXp(e.target.value)} placeholder="Shared XP" inputMode="numeric" />
            <Input
              className="h-9"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Member limit"
              inputMode="numeric"
            />
            <Button
              size="sm"
              className="sm:col-span-2"
              onClick={() =>
                patch(
                  {
                    name,
                    tagline,
                    badge_emoji: emoji,
                    total_xp: Number(xp) || 0,
                    member_limit: Math.max(2, Number(limit) || active.member_limit),
                  },
                  "Crew updated.",
                )
              }
            >
              Save changes
            </Button>
          </div>

          {/* ---- Toggles ---- */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                patch(
                  { visibility: active.visibility === "public" ? "private" : "public" },
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
                patch(
                  { join_policy: active.join_policy === "open" ? "invite" : "open" },
                  active.join_policy === "open" ? "Invite only now." : "Anyone can join now.",
                )
              }
            >
              {active.join_policy === "open" ? "Invite only" : "Open joining"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="ml-auto"
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

          {/* ---- Style pickers ---- */}
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { label: "Accent", field: "accent", current: active.accent, options: CREW_ACCENTS.map((a) => ({ key: a.key, label: a.label })) },
                { label: "Badge", field: "badge_style", current: active.badge_style, options: CREW_BADGE_STYLES.map((s) => ({ key: s.key, label: s.label })) },
                { label: "Nametag", field: "nametag_style", current: active.nametag_style, options: CREW_NAMETAGS.map((s) => ({ key: s.key, label: s.label })) },
                { label: "Text effect", field: "text_effect", current: active.text_effect, options: CREW_TEXT_EFFECTS.map((s) => ({ key: s.key, label: s.label })) },
                { label: "Chat background", field: "chat_bg", current: active.chat_bg, options: CREW_CHAT_BGS.map((s) => ({ key: s.key, label: s.label })) },
              ] as const
            ).map((row) => (
              <label key={row.field} className="space-y-1">
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                  {row.label}
                </span>
                <select
                  value={String(row.current)}
                  onChange={(e) => patch({ [row.field]: e.target.value }, `${row.label} changed.`)}
                  className="border-border bg-secondary/40 focus-visible:ring-ring w-full rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  {row.options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {/* ---- Roster ---- */}
          <div>
            <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
              Roster · {(members.data ?? []).length} members
            </p>
            <ul className="mt-1.5 space-y-1">
              {(members.data ?? []).map((m) => (
                <li
                  key={m.user_id}
                  className="border-border bg-background/40 flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
                >
                  {m.profile ? <Avatar profile={m.profile} size={24} /> : null}
                  <span className="min-w-0 flex-1 truncate text-sm">{m.profile?.display_name ?? "unknown"}</span>
                  <span className="text-muted-foreground numeral text-[11px]">
                    {m.contributed_xp.toLocaleString()} xp
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
                    onClick={() => void guard(() => ownerRemoveCrewMember(active.id, m.user_id), "Member removed.")}
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
        <p className="text-muted-foreground mt-3 text-sm">Pick a crew above to edit, restyle or delete it.</p>
      )}
    </Panel>
  );
}
