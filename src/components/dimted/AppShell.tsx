import { Link } from "@tanstack/react-router";
import {
  Compass,
  Gamepad2,
  Globe2,
  Home,
  LogOut,
  MessageCircle,
  ShoppingBag,
  Sparkle,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useDimted } from "@/lib/dimted-store";
import { nextUnlock } from "@/lib/dimted";
import { formatSparks } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";
import { Meter } from "./primitives";
import { Avatar, Nametag } from "./Identity";
import { AuthScreen } from "./AuthScreen";
import { LevelUpOverlay } from "./LevelUpOverlay";

/** Left icon rail — the places you jump between. */
const RAIL = [
  { to: "/", label: "Home", icon: Home },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/communities", label: "Communities", icon: Users },
  { to: "/activities", label: "Activities", icon: Gamepad2 },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
] as const;

/** Second column — grouped, scannable, Discord-style. */
const GROUPS = [
  {
    label: "You",
    items: [
      { to: "/", label: "Home", icon: Home },
      { to: "/profile", label: "Profile", icon: UserRound },
      { to: "/realm", label: "Realm", icon: Globe2 },
      { to: "/shop", label: "Shop", icon: ShoppingBag },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/messages", label: "Messages", icon: MessageCircle },
      { to: "/friends", label: "Friends", icon: Sparkle },
      { to: "/communities", label: "Communities", icon: Users },
    ],
  },
  {
    label: "Out there",
    items: [
      { to: "/discover", label: "Discover", icon: Compass },
      { to: "/activities", label: "Activities", icon: Gamepad2 },
    ],
  },
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

function Rail() {
  return (
    <aside className="glass hidden w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-2xl py-3 lg:flex">
      <Link to="/" className="mb-1.5">
        <span className="from-primary to-xp text-primary-foreground numeral grid size-11 place-items-center rounded-2xl bg-gradient-to-br text-lg">
          D
        </span>
      </Link>
      <span className="bg-border my-1 h-px w-8" />
      {RAIL.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          aria-label={label}
          title={label}
          activeOptions={{ exact: to === "/" }}
          className="text-muted-foreground hover:bg-secondary/70 hover:text-foreground relative grid size-11 place-items-center rounded-2xl transition-colors"
          activeProps={{
            className:
              "bg-secondary text-primary before:absolute before:-left-3 before:h-6 before:w-1 before:rounded-r-full before:bg-primary",
          }}
        >
          <Icon className="size-[18px]" strokeWidth={1.9} />
        </Link>
      ))}
    </aside>
  );
}

function Sidebar() {
  const {
    profile,
    level,
    rank,
    intoLevel,
    needed,
    progress,
    energy,
    sparks,
    surgeActive,
    surgeSecondsLeft,
    igniteSurge,
    signOut,
  } = useDimted();
  const upcoming = nextUnlock(level);

  return (
    <aside className="glass hidden w-[236px] shrink-0 flex-col rounded-2xl lg:flex">
      <div className="border-border flex items-center justify-between border-b px-3.5 py-3">
        <span className="font-display text-[15px] font-semibold tracking-tight">Dimted</span>
        <span className="text-gold flex items-center gap-1 font-mono text-[10px]">
          ✦ {formatSparks(sparks)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="text-muted-foreground/70 px-2 pb-1 font-mono text-[10px] tracking-[0.16em] uppercase">
              {group.label}
            </p>
            {group.items.map(({ to, label, icon: Icon }) => (
              <Link
                key={`${group.label}-${to}`}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors"
                activeProps={{ className: "bg-secondary text-foreground font-medium" }}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.85} />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        ))}

        <div className="border-border bg-background/40 mt-1 rounded-xl border p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="numeral text-xl">{level}</span>
            <span className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
              {rank}
            </span>
          </div>
          <Meter value={progress} tone="xp" className="mt-1.5 h-1.5" animate />
          <p className="text-muted-foreground mt-1.5 font-mono text-[10px]">
            {intoLevel.toLocaleString()} / {needed.toLocaleString()} XP
          </p>
          {upcoming ? (
            <p className="text-muted-foreground/80 mt-1 text-[11px] leading-snug">
              Next: Lv {upcoming.level} · {upcoming.name}
            </p>
          ) : null}
        </div>
      </div>

      {/* Account bar — bottom left, where your hand already is */}
      <div className="border-border bg-background/50 flex items-center gap-2 rounded-b-2xl border-t px-2 py-2">
        <Link
          to="/profile"
          className="hover:bg-secondary/50 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition-colors"
        >
          <Avatar profile={profile} size={32} />
          <span className="min-w-0 flex-1">
            <Nametag profile={profile} className="block truncate text-[13px]" />
            <span className="text-muted-foreground block truncate font-mono text-[10px]">
              Lv {level} · {energy}% energy
            </span>
          </span>
        </Link>
        <button
          onClick={() => void igniteSurge()}
          disabled={surgeActive || energy < 100}
          aria-label="Ignite surge"
          title={surgeActive ? "Surge active" : energy < 100 ? "Surge ready at 100% energy" : "Ignite surge"}
          className={cn(
            "grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-40",
            surgeActive ? "text-gold bg-gold/15" : "text-muted-foreground hover:bg-secondary/60",
          )}
        >
          <Zap className="size-4" />
        </button>
        <button
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
          className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground grid size-8 place-items-center rounded-lg transition-colors"
        >
          <LogOut className="size-4" />
        </button>
      </div>

      {surgeActive ? (
        <p className="text-gold border-border border-t px-3 py-1.5 font-mono text-[10px]">
          Surge · {Math.floor(surgeSecondsLeft / 60)}:
          {String(surgeSecondsLeft % 60).padStart(2, "0")} left
        </p>
      ) : null}
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, session } = useDimted();

  if (loading) {
    return (
      <div className="text-muted-foreground grid min-h-screen place-items-center font-mono text-xs">
        Loading your progress…
      </div>
    );
  }

  // No account, no world: Dimted has no guest mode and no demo data.
  if (!session) return <AuthScreen />;

  return (
    <div className="h-screen overflow-hidden p-3">
      <div className="mx-auto flex h-full w-full max-w-[1680px] gap-3">
        <Rail />
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-2">{children}</main>
      </div>

      {/* Mobile bar */}
      <nav className="glass-raised fixed inset-x-3 bottom-3 z-30 flex justify-between rounded-2xl px-2 py-2 lg:hidden">
        {[...RAIL, { to: "/profile", label: "Profile", icon: UserRound } as const].map(
          ({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              aria-label={label}
              className="text-muted-foreground grid size-10 place-items-center rounded-xl"
              activeProps={{ className: "bg-secondary text-primary" }}
            >
              <Icon className="size-4" strokeWidth={1.85} />
            </Link>
          ),
        )}
      </nav>

      <XpTicker />
      <LevelUpOverlay />
    </div>
  );
}
