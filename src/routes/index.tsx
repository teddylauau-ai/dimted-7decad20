import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Flame, Sparkles, Trophy, Users, MessageSquareText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Meter, Panel, PanelHead, RarityChip, LockedTile, EmptyState } from "@/components/dimted/primitives";
import { ProfileHoverCard } from "@/components/dimted/ProfileHoverCard";
import { useDimted } from "@/lib/dimted-store";
import { Avatar, Nametag, PresenceLabel, ProfileLink } from "@/components/dimted/Identity";
import { QuestBoard } from "@/components/dimted/QuestBoard";
import { RankBadge, RankPill } from "@/components/dimted/RankBadge";
import { HoloCardTrigger } from "@/components/dimted/HoloCard";
import {
  RANKS,
  SECRETS,
  UNLOCKS,
  XP_SOURCES,
  levelFromTotalXp,
  nextUnlock,
  rankForLevel,
} from "@/lib/dimted";
import { useFriendships, usePlayerStats, useXpFeed, useXpLeaderboard } from "@/lib/dimted-queries";
import { cn } from "@/lib/utils";
import { friendshipLevel } from "@/lib/dimted";
import {
  fetchActiveSeason,
  fetchMySeasonProgress,
  fetchSeasonTiers,
  seasonTimeLeft,
  currentTier,
  tierXpNeeded,
} from "@/lib/season";


function XpTicker() {
  const { lastGain } = useDimted();
  if (!lastGain) return null;
  return (
    <div
      key={lastGain.at}
      className="glass-raised border-primary/30 animate-pop-in text-primary mt-3 inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs shadow-sm"
    >
      +{lastGain.amount} XP · {lastGain.label}
    </div>
  );
}

function fmtTime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function SeasonTeaser() {
  const { profile } = useDimted();
  const season = useQuery({
    queryKey: ["active-season"],
    queryFn: fetchActiveSeason,
    staleTime: 60_000,
  });
  const tiers = useQuery({
    queryKey: ["season-tiers", season.data?.id],
    queryFn: () => fetchSeasonTiers(season.data!.id),
    enabled: !!season.data?.id,
    staleTime: 60_000,
  });
  const progress = useQuery({
    queryKey: ["my-season-progress", season.data?.id],
    queryFn: () => fetchMySeasonProgress(season.data!.id),
    enabled: !!season.data?.id && !!profile,
    staleTime: 30_000,
  });
  if (!season.data) return null;
  const xp = progress.data?.xp ?? 0;
  const current = currentTier(xp);
  const next = (tiers.data ?? []).find((t) => t.tier === current + 1);
  const xpToNext = next ? tierXpNeeded(current + 1) - xp : 0;
  const pct = next ? Math.min(1, Math.max(0, xp / tierXpNeeded(current + 1))) : 1;
  const timeLeft = fmtTime(seasonTimeLeft(season.data.ends_at));

  return (
    <Link to="/season" className="block">
      <div className="glass lift group flex items-center gap-3 rounded-2xl border border-gold/20 bg-gradient-to-r from-gold/5 to-primary/5 px-3 py-2.5 transition-colors hover:border-gold/40">
        <div className="bg-gold/15 text-gold flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Crown className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-gold">Season Pass</p>
          <p className="truncate text-sm font-medium">{season.data.name}</p>
          <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
            Tier {current} · {xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to next` : "max tier"} · {timeLeft} left
          </p>
        </div>
        <div className="w-24 shrink-0">
          <Meter value={pct} tone="xp" className="h-1.5" />
        </div>
      </div>
    </Link>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({

    meta: [
      { title: "Lazu — chat, level up, unlock a world" },
      {
        name: "description",
        content:
          "Your Lazu progression hub: level, XP, Energy Surge, daily and weekly challenges, and what unlocks next.",
      },
      { property: "og:title", content: "Lazu — your progression hub" },
      {
        property: "og:description",
        content: "Real conversations earn XP. XP raises your Level. Levels open the world.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { profile, level, rank, intoLevel, needed, progress, totalXp, energy, surgeActive, surgeSecondsLeft, igniteSurge } =
    useDimted();
  const stats = usePlayerStats(profile?.id, totalXp);
  const feed = useXpFeed(profile?.id);
  const friends = useFriendships(profile?.id);
  const myFriends = (friends.data ?? []).filter((f) => f.status === "accepted");

  const upcoming = nextUnlock(level);
  const nextSecret = SECRETS.find((s) => s.requiredLevel > level);
  const board = useXpLeaderboard(50);
  const rows = board.data ?? [];
  const myIndex = rows.findIndex((r) => r.id === profile?.id);

  return (
    <div className="space-y-4">
      <header className="animate-rise grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="glass lift flex items-center gap-3 rounded-2xl px-3 py-2.5">
          <RankBadge level={level} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Progression</p>
            <h1 className="font-display mt-0.5 truncate text-lg font-semibold tracking-tight">
              Level {level} · {rank}
            </h1>
            <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
              {intoLevel.toLocaleString()}/{needed.toLocaleString()} XP · {profile?.display_name ?? "—"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="numeral text-xl">{totalXp.toLocaleString()}</p>
            <p className="text-muted-foreground font-mono text-[9px] tracking-[0.2em] uppercase">total xp</p>
          </div>
        </div>

        <div className="glass lift rounded-2xl px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5">
              <Trophy className="text-gold size-3" /> Top of the ladder
            </p>
            <span className="text-muted-foreground font-mono text-[10px]">
              {myIndex >= 0 ? `you · #${myIndex + 1}` : "unranked"}
            </span>
          </div>
          <ol className="mt-1.5 space-y-0.5">
            {rows.slice(0, 3).map((p, i) => (
              <li key={p.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "numeral w-5 shrink-0 text-sm",
                    i === 0 ? "text-gold" : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <HoloCardTrigger profile={p}>
                  <Avatar profile={p} size={22} />
                </HoloCardTrigger>
                <ProfileHoverCard username={p.username} className="min-w-0 flex-1">
                  <Link
                    to="/u/$username"
                    params={{ username: p.username }}
                    className="min-w-0 flex-1 truncate text-[13px] hover:underline"
                  >
                    <Nametag profile={p} className="text-[13px]" />
                  </Link>
                </ProfileHoverCard>
                <RankPill level={levelFromTotalXp(p.total_xp).level} />
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="text-muted-foreground text-xs">No ranked players yet.</li>
            ) : null}
          </ol>
        </div>
      </header>


      <div className="space-y-4">
          <Panel className="relative overflow-hidden p-0">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,var(--color-primary)/18%,transparent_55%),radial-gradient(90%_120%_at_0%_100%,var(--color-gold)/14%,transparent_55%)]" />
            <div className="aurora-drift pointer-events-none absolute -top-24 right-8 size-56 rounded-full bg-primary/20 blur-[90px]" />
            <div className="aurora-drift pointer-events-none absolute -bottom-24 left-4 size-56 rounded-full bg-gold/15 blur-[90px] [animation-delay:-8s]" />

            <div className="relative p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-primary/25 blur-lg" />
                  <div className="border-primary/40 from-primary/25 to-gold/15 relative grid size-16 place-items-center rounded-2xl border bg-gradient-to-br">
                    <span className="numeral text-primary text-2xl leading-none">{level}</span>
                    <span className="text-muted-foreground mt-0.5 font-mono text-[8px] tracking-[0.22em] uppercase">
                      level
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="eyebrow">Your ladder</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="numeral text-lg leading-tight">{rank}</span>
                    <RankPill level={level} />
                  </div>
                  <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                    {(needed - intoLevel).toLocaleString()} XP to Level {level + 1}
                  </p>
                </div>

                <div className="text-right">
                  <p className="numeral text-gold text-xl leading-none">
                    {intoLevel.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
                    / {needed.toLocaleString()} xp
                  </p>
                </div>
              </div>

              <div className="relative mt-3">
                <div className="bg-background/60 border-border relative h-3 overflow-hidden rounded-full border">
                  <div
                    className="from-xp via-primary to-gold absolute inset-y-0 left-0 rounded-full bg-gradient-to-r shadow-[0_0_24px_-4px_var(--color-primary)] transition-[width] duration-700"
                    style={{ width: `${Math.max(2, Math.min(100, progress * 100))}%` }}
                  />
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-10">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span key={i} className={cn("h-full", i !== 0 && "border-l border-background/50")} />
                    ))}
                  </div>
                </div>
                <p className="text-muted-foreground mt-1 text-right font-mono text-[10px]">
                  {Math.round(progress * 100)}%
                </p>
              </div>
              <XpTicker />

            <div className="relative mt-4 grid gap-2.5 sm:grid-cols-2">
              <div className="group border-border bg-background/40 hover:border-primary/40 flex flex-col gap-2 rounded-xl border p-3 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg transition-colors group-hover:bg-primary/20">
                    <Sparkles className="size-4" />
                  </div>
                  <p className="eyebrow">Next unlock</p>
                </div>
                {upcoming ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="numeral text-gold text-xl">{upcoming.level}</span>
                      <RarityChip rarity={upcoming.rarity} />
                    </div>
                    <p className="text-sm font-medium">{upcoming.name}</p>
                    <p className="text-muted-foreground text-xs">{upcoming.detail}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    You've passed every published unlock.
                  </p>
                )}
              </div>

              <div
                className={cn(
                  "group flex flex-col gap-2 rounded-xl border p-3 transition-colors",
                  surgeActive
                    ? "border-gold/40 bg-gold/10"
                    : "border-border bg-background/40 hover:border-primary/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg transition-colors",
                      surgeActive ? "bg-gold/20 text-gold" : "bg-primary/10 text-primary group-hover:bg-primary/20",
                    )}
                  >
                    <Flame className="size-4" />
                  </div>
                  <p className={cn("eyebrow", surgeActive && "text-gold")}>Energy</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="numeral text-xl">
                    {surgeActive
                      ? `${Math.floor(surgeSecondsLeft / 60)}:${String(surgeSecondsLeft % 60).padStart(2, "0")}`
                      : `${energy}%`}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                    {surgeActive ? "surge live" : "charge"}
                  </span>
                </div>
                <Meter
                  value={surgeActive ? surgeSecondsLeft / 1800 : energy / 100}
                  tone="energy"
                  className="h-1.5"
                />
                <Button
                  size="sm"
                  variant={surgeActive ? "outline" : "default"}
                  className="w-full"
                  disabled={surgeActive || energy < 100}
                  onClick={() => void igniteSurge()}
                >
                  <Flame className="size-3.5" />
                  {surgeActive ? "Surge running" : energy < 100 ? "Charging from chat" : "Ignite surge"}
                </Button>
              </div>
            </div>

            <div className="relative mt-4 overflow-hidden rounded-xl border border-border bg-background/30 p-2">
              <div className="grid grid-cols-2 sm:grid-cols-4">
                {[
                  { label: "Friends", value: stats.friends },
                  { label: "Communities", value: stats.communities },
                  { label: "Arcade runs", value: stats.activities },
                  { label: "Discoveries", value: stats.discoveries },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className={cn(
                      "flex flex-col items-center justify-center py-2",
                      i !== 0 && "border-l border-border",
                    )}
                  >
                    <p className="numeral text-lg">{s.value}</p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-[10px] tracking-[0.18em] uppercase">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </Panel>

        <Panel className="p-4" delay={80}>
          <PanelHead
            eyebrow="Your circle"
            title="Friends"
            aside={
              myFriends.length ? (
                <Link to="/friends" className="text-primary hover:underline">
                  {myFriends.length} connected
                </Link>
              ) : undefined
            }
          />
          {myFriends.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Your circle is empty"
              action={
                <Link to="/discover">
                  <Button variant="outline" size="sm">Find people</Button>
                </Link>
              }
            >
              Send friend requests to real signed-up accounts. Every accepted request earns XP.
            </EmptyState>
          ) : (
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {myFriends.map((f) => {
                const fl = friendshipLevel(f.friendshipXp);
                return (
                  <li key={f.friendshipId}>
                   <ProfileHoverCard username={f.profile.username} className="w-full">
                    <Link
                      to="/u/$username"
                      params={{ username: f.profile.username }}
                      className="glass-raised hover:border-primary/40 flex items-center gap-3 rounded-xl p-2.5 transition-colors"
                    >
                      <HoloCardTrigger profile={f.profile}>
                        <Avatar profile={f.profile} size={40} />
                      </HoloCardTrigger>
                      <span className="min-w-0 flex-1">
                        <Nametag profile={f.profile} className="block truncate text-sm" />
                        <span className="text-muted-foreground block truncate font-mono text-[10px]">
                          @{f.profile.username}
                        </span>
                        <PresenceLabel profile={f.profile} className="mt-0.5" />
                      </span>
                      <span className="text-primary shrink-0 font-mono text-[10px]">FL {fl.level}</span>
                    </Link>
                   </ProfileHoverCard>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <QuestBoard />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel className="p-4" delay={60}>
          <PanelHead
            eyebrow="Global"
            title="The ladder"
            aside={
              rows.length ? (
                <span className="text-muted-foreground font-mono text-[10px]">
                  {Math.min(rows.length, 10)} of {rows.length} players
                </span>
              ) : undefined
            }
          />
          <ol className="mt-3 space-y-1">
            {rows.slice(0, 10).map((p, i) => {
              const lv = levelFromTotalXp(p.total_xp);
              const me = p.id === profile?.id;
              return (
                <li key={p.id}>
                 <ProfileHoverCard username={p.username} className="w-full">
                  <Link
                    to="/u/$username"
                    params={{ username: p.username }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-1.5 transition-colors",
                      me
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-background/40 hover:border-primary/30",
                    )}
                  >
                    <span
                      className={cn(
                        "numeral w-7 shrink-0 text-base",
                        i === 0
                          ? "text-gold"
                          : i < 3
                            ? "text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    {i === 0 ? <Crown className="text-gold size-3.5 shrink-0" /> : null}
                    <HoloCardTrigger profile={p}>
                      <Avatar profile={p} size={32} />
                    </HoloCardTrigger>
                    <span className="min-w-0 flex-1">
                      <Nametag profile={p} className="block truncate text-sm" />
                      <span className="text-muted-foreground flex items-center gap-1.5 truncate font-mono text-[10px]">
                        @{p.username} · <RankPill level={lv.level} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="numeral block text-sm">Lv {lv.level}</span>
                      <span className="text-muted-foreground block font-mono text-[10px]">
                        {p.total_xp.toLocaleString()} XP
                      </span>
                    </span>
                  </Link>
                 </ProfileHoverCard>
                </li>

              );
            })}
            {rows.length === 0 ? (
              <EmptyState icon={Trophy} title="The ladder is empty">
                Nobody has earned XP yet. Start chatting or play Pulse Rush to claim the top spot.
              </EmptyState>
            ) : null}
          </ol>
        </Panel>

        <Panel className="p-4" delay={100}>
          <PanelHead eyebrow="Prestige" title="Rank ladder" aside={`Lv ${level} · ${rank}`} />
          <ul className="mt-3 space-y-1">
            {RANKS.map((r) => {
              const reached = level >= r.from;
              const current = rankForLevel(level) === r.name;
              return (
                <li
                  key={r.name}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-1",
                    current
                      ? "border-gold/50 bg-gold/10"
                      : reached
                        ? "border-border bg-background/40"
                        : "border-border/50 bg-background/20 opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "numeral w-9 shrink-0 text-sm",
                      current ? "text-gold" : reached ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {r.from}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px] tracking-[0.16em] uppercase">
                    {current ? "you" : reached ? "held" : "locked"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>


      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel className="p-4" delay={100}>
          <PanelHead
            eyebrow="Live"
            title="XP feed"
            aside={feed.data?.length ? `${feed.data.length} events` : undefined}
          />
          {feed.data && feed.data.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {feed.data.slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">
                    {e.user_id === profile?.id ? (
                      <span className="text-foreground/70">You</span>
                    ) : (
                      <ProfileLink profile={e.author} className="text-foreground/70 text-sm" />
                    )}{" "}
                    · {e.label ?? e.source}
                  </span>
                  <span className="text-primary shrink-0 font-mono text-[11px]">+{e.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={MessageSquareText} title="No XP yet" action={<Link to="/messages"><Button variant="outline" size="sm">Start chatting</Button></Link>}>
              Send messages, play games, and complete quests to fill your feed.
            </EmptyState>
          )}

          <div className="border-border mt-4 border-t pt-3">
            <p className="eyebrow">How XP works</p>
            <ul className="mt-2 space-y-1">
              {XP_SOURCES.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-foreground/85">{s.label}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    +{s.xp} · {s.cooldownLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel className="p-4" delay={140}>
          <PanelHead eyebrow="Ahead of you" title="Still hidden" />
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {nextSecret ? (
              <LockedTile hint={nextSecret.hint} requirement={`Level ${nextSecret.requiredLevel}`} />
            ) : null}
          </div>

          <ul className="mt-3 space-y-1.5">
            {UNLOCKS.filter((u) => u.level > level)
              .slice(0, 5)
              .map((u) => (
                <li
                  key={u.level}
                  className="border-border bg-background/40 flex items-center gap-3 rounded-xl border p-2.5"
                >
                  <span className="numeral text-muted-foreground w-8 shrink-0 text-lg">{u.level}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{u.name}</span>
                    <span className="text-muted-foreground block text-xs">{u.detail}</span>
                  </span>
                  <RarityChip rarity={u.rarity} />
                </li>
              ))}
          </ul>

          <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs">
            <Sparkles className="text-gold mt-0.5 size-3.5 shrink-0" />
            At Level {level + 1} you'll be a {rankForLevel(level + 1)}. Nothing here can be bought.
          </p>
        </Panel>
      </div>
    </div>
  );
}
