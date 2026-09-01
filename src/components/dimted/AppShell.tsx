import { Link } from "@tanstack/react-router";
import {
  Compass,
  Gamepad2,
  Globe2,
  Home,
  MessageCircle,
  Sparkle,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useDimted } from "@/lib/dimted-store";
import { nextUnlock } from "@/lib/dimted";
import { cn } from "@/lib/utils";
import { Meter } from "./primitives";
import { LevelUpOverlay } from "./LevelUpOverlay";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/messages", label: "Messages", icon: MessageCircle, badge: 3 },
  { to: "/communities", label: "Communities", icon: Users },
  { to: "/realm", label: "Realm", icon: Globe2 },
  { to: "/activities", label: "Activities", icon: Gamepad2 },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/friends", label: "Friends", icon: Sparkle },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

function XpTicker() {
  const { lastGain } = useDimted();
  if (!lastGain) return null;
  return (
    <div
      key={lastGain.at}
      className="glass-raised border-primary/30 animate-pop-in text-primary pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border px-4 py-2 font-mono text-xs"
    >
      +{lastGain.amount} XP · {lastGain.label}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { level, rank, intoLevel, needed, progress, energy, surgeActive, surgeSecondsLeft, hydrated } =
    useDimted();
  const upcoming = nextUnlock(level);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[1560px] gap-5 p-4 lg:p-6">
        <aside className="hidden w-[252px] shrink-0 lg:block">
          <div className="glass sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col rounded-2xl p-4">
            <Link to="/" className="flex items-center gap-3 px-1 py-1">
              <span className="from-primary to-xp text-primary-foreground numeral grid size-10 place-items-center rounded-xl bg-gradient-to-br text-lg">
                D
              </span>
              <span className="leading-tight">
                <span className="font-display block text-lg font-semibold tracking-tight">DIMTED</span>
                <span className="text-muted-foreground block font-mono text-[10px] tracking-[0.22em] uppercase">
                  World
                </span>
              </span>
            </Link>

            <nav className="mt-6 flex flex-col gap-0.5">
              {NAV.map(({ to, label, icon: Icon, ...rest }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/" }}
                  className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
                  activeProps={{ className: "bg-secondary text-foreground font-medium" }}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="flex-1">{label}</span>
                  {"badge" in rest && rest.badge ? (
                    <span className="bg-primary/15 text-primary rounded-full px-2 font-mono text-[10px]">
                      {rest.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>

            {/* Persistent progression HUD */}
            <div className="border-border bg-background/40 mt-6 rounded-2xl border p-3">
              <div className="flex items-baseline justify-between">
                <span className="numeral text-2xl">{level}</span>
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                  {rank}
                </span>
              </div>
              <Meter value={progress} tone="xp" className="mt-2" animate />
              <p className="text-muted-foreground mt-2 font-mono text-[10px]">
                {intoLevel.toLocaleString()} / {needed.toLocaleString()} XP
              </p>
              {upcoming ? (
                <p className="text-muted-foreground/80 mt-2 text-[11px] leading-snug">
                  Lv {upcoming.level} · {upcoming.name}
                </p>
              ) : null}
            </div>

            <div
              className={cn(
                "mt-3 rounded-2xl border p-3",
                surgeActive ? "border-gold/40 bg-gold/10" : "border-border bg-background/40",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("font-mono text-[10px] tracking-[0.2em] uppercase", surgeActive ? "text-gold" : "text-muted-foreground")}>
                  Energy
                </span>
                <span className="text-muted-foreground font-mono text-[10px]">
                  {surgeActive
                    ? `${Math.floor(surgeSecondsLeft / 60)}:${String(surgeSecondsLeft % 60).padStart(2, "0")}`
                    : `${energy}%`}
                </span>
              </div>
              <Meter value={surgeActive ? surgeSecondsLeft / 1800 : energy / 100} tone="energy" className="mt-2 h-1.5" />
              <p className="text-muted-foreground mt-2 text-[11px]">
                {surgeActive ? "Surge active — double XP." : "Surge ready at 100%."}
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-6">{children}</main>
      </div>

      {/* Mobile nav */}
      <nav className="glass-raised fixed inset-x-3 bottom-3 z-30 flex justify-between rounded-2xl px-2 py-2 lg:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            aria-label={label}
            className="text-muted-foreground grid size-10 place-items-center rounded-xl"
            activeProps={{ className: "bg-secondary text-primary" }}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </Link>
        ))}
      </nav>

      <XpTicker />
      <LevelUpOverlay />
    </div>
  );
}
