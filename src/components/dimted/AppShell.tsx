import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Compass,
  Gamepad2,
  Home,
  LogOut,
  MessageCircle,
  ShieldCheck,
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
import { useMyRole } from "@/lib/roles-queries";
import { cn } from "@/lib/utils";
import { Meter } from "./primitives";
import { Avatar, Nametag, PresenceLabel } from "./Identity";
import { NotificationBell } from "./NotificationBell";
import { BrandMark, Wordmark } from "./Brand";
import { AuthScreen } from "./AuthScreen";
import { LevelUpOverlay } from "./LevelUpOverlay";

/** Left icon rail — the places you jump between. */
const RAIL = [
  { to: "/", label: "Home", icon: Home },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/communities", label: "Communities", icon: Users },
  { to: "/pulse", label: "Pulse Rush", icon: Zap },
  { to: "/activities", label: "Arcade", icon: Gamepad2 },
  { to: "/study", label: "Study", icon: BookOpen },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
] as const;

/** Second column — grouped, scannable, Discord-style. */
const GROUPS = [
  {
    label: "You",
    items: [
      { to: "/", label: "Home", icon: Home },
      { to: "/profile", label: "Profile", icon: UserRound },
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
    label: "Play",
    items: [
      { to: "/pulse", label: "Pulse Rush", icon: Zap },
      { to: "/activities", label: "Arcade", icon: Gamepad2 },
      { to: "/study", label: "Study", icon: BookOpen },
    ],
  },
  {
    label: "Out there",
    items: [{ to: "/discover", label: "Discover", icon: Compass }],
  },
] as const;


function Rail() {
  return (
    <aside className="glass hidden w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-2xl py-3 lg:flex">
      <Link to="/" aria-label="Dimted home" className="mb-1.5">
        <BrandMark size={44} />
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
  const { isModerator: isStaff } = useMyRole(profile?.id);

  return (
    <aside className="glass hidden w-[236px] shrink-0 flex-col rounded-2xl lg:flex">
      <div className="border-border flex items-center justify-between border-b px-3.5 py-3">
        <Wordmark className="text-[15px]" />
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

        {isStaff ? (
          <div className="mb-3">
            <p className="text-muted-foreground/70 px-2 pb-1 font-mono text-[10px] tracking-[0.16em] uppercase">
              Staff
            </p>
            <Link
              to="/admin"
              className="text-gold hover:bg-secondary/60 flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors"
              activeProps={{ className: "bg-secondary font-medium" }}
            >
              <ShieldCheck className="size-4 shrink-0" strokeWidth={1.85} />
              <span className="truncate">Control panel</span>
            </Link>
          </div>
        ) : null}

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
          <Avatar profile={profile} size={32} presence />
          <span className="min-w-0 flex-1">
            <Nametag profile={profile} className="block truncate text-[13px]" />
            <span className="block truncate">
              <PresenceLabel profile={profile} />
              <span className="text-muted-foreground/70 ml-1 font-mono text-[10px]">
                · Lv {level} · {energy}%
              </span>
            </span>
          </span>
        </Link>
        <NotificationBell />
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
  const { loading, session, profile } = useDimted();

  if (loading) {
    return (
      <div className="text-muted-foreground grid min-h-screen place-items-center font-mono text-xs">
        Loading your progress…
      </div>
    );
  }

  // No account, no world: Dimted has no guest mode and no demo data.
  if (!session) return <AuthScreen />;

  const banned = profile?.banned_until && new Date(profile.banned_until) > new Date();
  const muted = !banned && profile?.muted_until && new Date(profile.muted_until) > new Date();

  return (
    <div className="h-screen overflow-hidden p-3">
      <div className="mx-auto flex h-full w-full max-w-[1680px] gap-3">
        <Rail />
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-2">
          {banned || muted ? (
            <div
              className={
                banned
                  ? "border-destructive/40 bg-destructive/10 text-destructive mb-3 rounded-2xl border px-4 py-3 text-sm"
                  : "border-gold/40 bg-gold/10 text-gold mb-3 rounded-2xl border px-4 py-3 text-sm"
              }
            >
              {banned
                ? "Your account is banned — you can't send messages or earn XP."
                : "You're muted — you can't send messages right now."}
              {banned ? (profile?.ban_reason ? ` Reason: ${profile.ban_reason}` : "") : profile?.mute_reason ? ` Reason: ${profile.mute_reason}` : ""}
            </div>
          ) : null}
          {children}
        </main>

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

      <LevelUpOverlay />
    </div>
  );
}

