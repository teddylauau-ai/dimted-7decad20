import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, MapPin, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { REALM_OBJECTS, type RealmObject } from "@/lib/dimted";
import { useDimted } from "@/lib/dimted-store";
import { LockedTile, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { rarityDot, rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/realm")({
  head: () => ({
    meta: [
      { title: "Your Realm — DIMTED" },
      {
        name: "description",
        content:
          "The DIMTED Realm is your own small futuristic world. It starts almost empty and fills with buildings, portals, companions and secrets as you progress.",
      },
      { property: "og:title", content: "Your Realm — DIMTED" },
      { property: "og:description", content: "A digital space that grows as you talk, explore and level up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RealmPage,
});

function RealmPage() {
  const { level, award } = useDimted();
  const [selected, setSelected] = useState<RealmObject | null>(REALM_OBJECTS[2] ?? null);

  const objects = REALM_OBJECTS.map((o) => ({ ...o, owned: o.owned || level >= o.level }));
  const placed = objects.filter((o) => o.owned);
  const sealed = objects.filter((o) => !o.owned);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Realm · The Quiet Shore"
        title="A world that fills in as you use DIMTED"
        blurb="Nothing here was bought. Every object arrived from a conversation, a challenge, or something you found."
        aside={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              award("discovery", 80, "invited a friend to your Realm");
              toast("Alex can now walk your Realm. Hidden objects count for both of you.");
            }}
          >
            <UserPlus className="size-4" /> Invite a friend
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel className="overflow-hidden p-0">
          <div className="relative h-[440px]">
            <div
              className="animate-drift absolute inset-0"
              style={{
                background:
                  "radial-gradient(90% 70% at 50% 118%, oklch(0.4 0.09 200 / 0.6), transparent 72%), radial-gradient(38% 34% at 80% 18%, oklch(0.5 0.11 82 / 0.32), transparent 70%), radial-gradient(46% 40% at 16% 34%, oklch(0.42 0.1 300 / 0.28), transparent 72%), linear-gradient(180deg, oklch(0.2 0.042 262), oklch(0.13 0.03 258))",
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage:
                  "linear-gradient(oklch(1 0 0 / 0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.5) 1px, transparent 1px)",
                backgroundSize: "64px 64px",
                maskImage: "radial-gradient(70% 70% at 50% 70%, black, transparent)",
              }}
            />

            {objects.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelected(o)}
                aria-label={o.name}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border transition-transform hover:scale-105",
                  o.owned ? "border-transparent" : "border-secret/40 border-dashed",
                  selected?.id === o.id && "ring-primary/70 ring-2",
                )}
                style={{ left: `${o.x}%`, top: `${o.y}%`, width: o.size, height: o.size }}
              >
                <span
                  className={cn(
                    "absolute inset-0 rounded-2xl",
                    o.owned ? rarityDot[o.rarity] : "bg-secret/10",
                    o.owned ? "opacity-25" : "",
                  )}
                />
                <span
                  className={cn(
                    "absolute inset-0 grid place-items-center font-mono text-[10px]",
                    o.owned ? rarityText[o.rarity] : "text-secret/70",
                  )}
                >
                  {o.owned ? o.kind[0] : <Lock className="size-3.5" />}
                </span>
              </button>
            ))}

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 font-mono text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {placed.length} placed · {sealed.length} sealed
              </span>
              <span className="text-muted-foreground">Alex visited yesterday</span>
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-6" delay={80}>
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{selected.kind}</p>
                    <h2 className="font-display mt-1 text-xl font-semibold tracking-tight">
                      {selected.owned || level >= selected.level ? selected.name : "???"}
                    </h2>
                  </div>
                  <RarityChip rarity={selected.rarity} />
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  {selected.owned || level >= selected.level
                    ? selected.note
                    : `Sealed until Level ${selected.level}. Nothing else is explained.`}
                </p>
                <div className="border-border mt-5 flex items-center justify-between border-t pt-4 font-mono text-[11px]">
                  <span className="text-muted-foreground">Unlocks at Level {selected.level}</span>
                  <span className={level >= selected.level ? "text-uncommon" : "text-secret"}>
                    {level >= selected.level ? "open" : "sealed"}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Pick something in the Realm.</p>
            )}
          </Panel>

          <Panel className="p-6" delay={120}>
            <PanelHead eyebrow="Inventory" title="Placed in this Realm" aside={`${placed.length}/${objects.length}`} />
            <ul className="mt-4 space-y-1.5">
              {objects.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => setSelected(o)}
                    className="hover:bg-secondary/50 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", o.owned ? rarityDot[o.rarity] : "bg-muted")} />
                    <span className={cn("min-w-0 flex-1 truncate text-sm", !o.owned && "text-muted-foreground")}>
                      {o.owned ? o.name : "Sealed"}
                    </span>
                    <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">Lv {o.level}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <LockedTile hint="The First Dimension" requirement="It appears at the edge. Not the same for everyone." />
        </div>
      </div>
    </div>
  );
}
