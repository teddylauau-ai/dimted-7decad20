import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Gamepad2, Sparkles, Zap } from "lucide-react";
import { PageHeader } from "@/components/dimted/primitives";
import { PulseRushSection } from "@/components/games/PulseRushSection";
import { CampaignSection, ArcadeSection } from "@/components/games/ArcadeSections";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Games — Lazu" },
      {
        name: "description",
        content:
          "Every Lazu game in one place: the Pulse Rush campaign, the Nova Rift story run and a dozen arcade minigames that all pay XP and sparks.",
      },
      { property: "og:title", content: "Games — Lazu" },
      {
        property: "og:description",
        content:
          "Pulse Rush, Nova Rift and a dozen arcade minigames — all paying XP and sparks toward your level.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamesPage,
});

type Tab = "pulse" | "campaign" | "arcade";

const TABS: { id: Tab; label: string; hint: string; icon: typeof Zap }[] = [
  { id: "pulse", label: "Pulse Rush", hint: "Rhythm platformer campaign", icon: Zap },
  { id: "campaign", label: "Nova Rift", hint: "12-level story run", icon: Sparkles },
  { id: "arcade", label: "Arcade", hint: "Twelve quick minigames", icon: Gamepad2 },
];

function GamesPage() {
  const [tab, setTab] = useState<Tab>("pulse");
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Play"
        title="Games"
        blurb="Everything playable lives here. Every run pays XP and sparks toward your level."
      />

      <div
        role="tablist"
        aria-label="Game modes"
        className="glass mt-5 flex gap-1 overflow-x-auto rounded-2xl p-1"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                selected
                  ? "bg-primary/15 text-primary ring-primary/30 ring-1"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-2 font-mono text-[11px]">{active.hint}</p>

      <div className="mt-5">
        {tab === "pulse" ? (
          <PulseRushSection />
        ) : tab === "campaign" ? (
          <CampaignSection />
        ) : (
          <ArcadeSection />
        )}
      </div>
    </div>
  );
}
