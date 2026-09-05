import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, Gift, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHead } from "@/components/dimted/primitives";
import { Avatar } from "@/components/dimted/Identity";
import { CrestMark } from "@/components/dimted/CrewCrest";
import { CREW_CRESTS, crestsFor, crewLevel, ownerGrantAllCrests, ownerSetCrewLevel, type CrewMember } from "@/lib/crews";
import { useCosmetics } from "@/lib/dimted-queries";
import { useGrantCosmetic, useSetTitle } from "@/lib/roles-queries";
import { cn } from "@/lib/utils";

/** Titles kept for squads — handed out by the Owner, never buyable. */
const CREW_TITLES = [
  "Crew Vanguard",
  "Squad Elite",
  "Crest Bearer",
  "Wing Commander",
  "Crew Legend",
];

/**
 * Staff vault for the crew you're viewing: unlock crest levels on the crew
 * itself and hand exclusive vault cosmetics or titles to your squad. Everything
 * here runs through the same server checks as the admin console.
 */
export function CrewStaffVault({
  crewId,
  crewName,
  crewXp,
  members,
  isOwner,
}: {
  crewId: string;
  crewName: string;
  crewXp: number;
  members: CrewMember[];
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const cosmetics = useCosmetics();
  const grantCosmetic = useGrantCosmetic();
  const setTitle = useSetTitle();
  const [target, setTarget] = useState<string | null>(members[0]?.user_id ?? null);
  const [customTitle, setCustomTitle] = useState("");

  const lvl = crewLevel(crewXp);
  const earned = crestsFor(crewXp);
  const crestGates = useMemo(() => CREW_CRESTS.map((c) => c.unlock), []);

  const vault = (cosmetics.data ?? []).filter(
    (c) => c.pool === "crew",
  );
  const picked = members.find((m) => m.user_id === target) ?? null;

  async function grantLevel(level: number) {
    try {
      await ownerSetCrewLevel(crewId, level);
      await qc.invalidateQueries({ queryKey: ["crews"] });
      toast.success(`${crewName} is now crew level ${level} — crests up to that level are live`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set the crew level");
    }
  }

  async function grantAll() {
    try {
      await ownerGrantAllCrests(crewId);
      await qc.invalidateQueries({ queryKey: ["crews"] });
      toast.success(`${crewName} now wears every crest`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not grant the crests");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-4">
        <PanelHead
          eyebrow="Staff vault"
          title="Crest unlocks"
          aside={`Lv ${lvl.level} · ${earned.length}/${CREW_CRESTS.length}`}
        />
        <p className="text-muted-foreground mt-2 text-xs">
          Crest chips are earned from the crew's shared XP. Setting a level here moves the shared pool to that level's
          starting XP, so every crest up to it appears beside the crew name.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CREW_CRESTS.map((c) => {
            const has = lvl.level >= c.unlock;
            return (
              <div
                key={c.key}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl p-2.5",
                  has ? "bg-primary/10 ring-primary/25 ring-1" : "bg-secondary/20",
                )}
              >
                <CrestMark crest={c} size="lg" className={c.cls} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.label} <span className="text-muted-foreground font-mono text-[10px]">Lv {c.unlock}</span>
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">{has ? "Live on this crew" : c.blurb}</p>
                </div>
                {isOwner ? (
                  <Button size="sm" variant={has ? "ghost" : "outline"} onClick={() => grantLevel(c.unlock)}>
                    {has ? "Set" : "Unlock"}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>

        {isOwner ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={grantAll}>
              <Sparkles className="mr-1.5 size-3.5" /> Grant every crest
            </Button>
            <span className="text-muted-foreground text-[11px]">
              Gates: {crestGates.join(" · ")}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5" /> Only the Owner can move a crew's level.
          </p>
        )}
      </Panel>

      <Panel className="p-4">
        <PanelHead eyebrow="Staff vault" title="Squad grants" aside={`${members.length} member${members.length === 1 ? "" : "s"}`} />
        <p className="text-muted-foreground mt-2 text-xs">
          Pick a crew member, then hand them a crew-only cosmetic or a crew title. These are exclusive to crews — they never appear in the shop, and they are not the Owner or Admin vault items.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((m) => (
            <button
              key={m.user_id}
              onClick={() => setTarget(m.user_id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs",
                target === m.user_id ? "bg-primary/15 ring-primary/30 ring-1" : "bg-secondary/25 hover:bg-secondary/40",
              )}
            >
              <Avatar profile={m.profile} size={22} />
              <span className="max-w-[9rem] truncate">{m.profile.display_name || m.profile.username}</span>
            </button>
          ))}
        </div>

        {picked ? (
          <>
            <div className="mt-4">
              <p className="eyebrow">Crew-only cosmetics</p>
              <div className="mt-2 grid max-h-56 gap-1.5 overflow-y-auto pr-1">
                {vault.length ? (
                  vault.map((c) => (
                    <div key={c.slug} className="bg-background/40 border-border flex items-center gap-2 rounded-lg border p-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{c.name}</span>
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {c.slot} · {c.rarity}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={grantCosmetic.isPending}
                        onClick={() =>
                          grantCosmetic.mutate(
                            { userId: picked.user_id, slug: c.slug },
                            {
                              onSuccess: () => toast.success(`${c.name} granted`),
                              onError: (e) => toast.error(e instanceof Error ? e.message : "Grant failed"),
                            },
                          )
                        }
                      >
                        <Gift className="mr-1 size-3.5" /> Grant
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-xs">No vault cosmetics in the catalogue yet.</p>
                )}
              </div>
            </div>

            {isOwner ? (
              <div className="border-border mt-4 border-t pt-3">
                <p className="eyebrow">Crew titles</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CREW_TITLES.map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant="outline"
                      disabled={setTitle.isPending}
                      onClick={() =>
                        setTitle.mutate(
                          { userId: picked.user_id, title: t },
                          {
                            onSuccess: () => toast.success(`Title set to ${t}`),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set the title"),
                          },
                        )
                      }
                    >
                      <Crown className="mr-1 size-3.5" /> {t}
                    </Button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Custom title"
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={!customTitle.trim() || setTitle.isPending}
                    onClick={() =>
                      setTitle.mutate(
                        { userId: picked.user_id, title: customTitle.trim() },
                        {
                          onSuccess: () => {
                            toast.success(`Title set to ${customTitle.trim()}`);
                            setCustomTitle("");
                          },
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set the title"),
                        },
                      )
                    }
                  >
                    Set
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground mt-4 text-xs">Pick a member to grant something.</p>
        )}
      </Panel>
    </div>
  );
}
