import { createContext, useContext, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { HoverCardContent } from "@/components/ui/hover-card";
import {
  BADGE_CLASS,
  BADGE_GLYPH,
  FRAME_CLASS,
  NAMETAG_CLASS,
  bannerFor,
} from "@/lib/cosmetics";
import { levelFromTotalXp, rankForLevel } from "@/lib/dimted";
import { useProfileByUsername } from "@/lib/dimted-queries";
import { presenceFor } from "@/lib/presence";
import { cn } from "@/lib/utils";

/**
 * Discord-style hover preview. Peeks at somebody's card without leaving the page:
 * banner, avatar, worn cosmetics, rank, level meter and a couple of live stats.
 */
const InsideHoverCard = createContext(false);

export function ProfileHoverCard({
  username,
  children,
  className,
  side = "right",
}: {
  username: string | undefined;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const nested = useContext(InsideHoverCard);
  const [open, setOpen] = useState(false);
  const query = useProfileByUsername(open ? username : undefined);
  const p = query.data;

  if (!username || nested) return <>{children}</>;

  const derived = p ? levelFromTotalXp(p.total_xp ?? 0) : null;
  const pct = derived ? Math.min(100, Math.round((derived.intoLevel / derived.needed) * 100)) : 0;
  const presence = presenceFor(p?.last_active_at, p?.activity_context);
  const joined = p?.created_at
    ? new Date(p.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  return (
    <HoverCardPrimitive.Root openDelay={160} closeDelay={100} open={open} onOpenChange={setOpen}>
      <HoverCardPrimitive.Trigger asChild>
        <span className={cn("inline-flex min-w-0", className)}>
          <InsideHoverCard.Provider value={true}>{children}</InsideHoverCard.Provider>
        </span>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
      <HoverCardContent
        side={side}
        align="start"
        sideOffset={10}
        className="glass-raised w-[19rem] overflow-hidden rounded-2xl border-white/10 p-0 shadow-2xl"
      >
        {!p ? (
          <div className="space-y-3 p-4">
            <div className="bg-secondary/60 h-14 animate-pulse rounded-xl" />
            <div className="bg-secondary/60 h-3 w-1/2 animate-pulse rounded" />
            <div className="bg-secondary/60 h-3 w-2/3 animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div
              className="relative h-20 w-full overflow-hidden"
              style={{ background: bannerFor(p.equipped_banner) }}
            >
              {p.banner_url ? (
                <img
                  src={p.banner_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              ) : null}
              <div className="from-card absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t to-transparent" />
            </div>

            <div className="px-4 pb-4">
              <div className="-mt-7 flex items-end justify-between gap-3">
                <span className="relative inline-flex">
                  <span
                    className={cn(
                      "bg-secondary text-foreground/90 font-display glass-raised relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-lg font-semibold",
                      p.equipped_frame ? FRAME_CLASS[p.equipped_frame] : undefined,
                    )}
                  >
                    <span className="relative inline-flex size-[3.25rem] shrink-0">
                      <span className="bg-secondary grid size-[3.25rem] shrink-0 place-items-center overflow-hidden rounded-xl">
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          p.display_name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span
                        className={cn(
                          "border-card absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2",
                          presence.state === "offline" ? "bg-muted" : presence.dotClass,
                        )}
                      />
                    </span>
                  </span>
                <span className="border-border/60 bg-secondary/60 mb-1 rounded-full border px-2 py-0.5 font-mono text-[10px]">
                  LVL {derived?.level ?? 1}
                </span>
              </div>

              <div className="mt-2.5 min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  <span className={cn(p.equipped_nametag ? NAMETAG_CLASS[p.equipped_nametag] : undefined)}>
                    {p.display_name}
                  </span>
                  {p.equipped_badge && BADGE_GLYPH[p.equipped_badge] ? (
                    <span
                      className={cn("text-xs", BADGE_CLASS[p.equipped_badge])}
                      aria-hidden
                    >
                      {BADGE_GLYPH[p.equipped_badge]}
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground truncate font-mono text-[10px]">
                  @{p.username}
                  {p.title ? <span className="text-primary"> · {p.title}</span> : null}
                </p>
              </div>

              <p className={cn("mt-1.5 font-mono text-[10px]", presence.textClass)}>
                {presence.label}
              </p>

              {p.bio ? (
                <p className="text-muted-foreground border-border/50 mt-2.5 line-clamp-2 border-t pt-2.5 text-xs">
                  {p.bio}
                </p>
              ) : null}

              <div className="mt-3">
                <div className="text-muted-foreground flex items-baseline justify-between font-mono text-[10px]">
                  <span>{rankForLevel(derived?.level ?? 1)}</span>
                  <span>{pct}%</span>
                </div>
                <div className="bg-secondary/70 mt-1 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="from-primary to-gold h-full rounded-full bg-gradient-to-r"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                <Stat label="XP" value={(p.total_xp ?? 0).toLocaleString()} />
                <Stat label="Realm" value={p.realm_name ?? "—"} />
                <Stat label="Joined" value={joined ?? "—"} />
              </div>

              <Link
                to="/u/$username"
                params={{ username: p.username }}
                className="border-border/60 bg-secondary/40 hover:bg-secondary mt-3 block rounded-xl border py-1.5 text-center font-mono text-[10px] transition-colors"
              >
                View full profile →
              </Link>
            </div>
          </>
        )}
      </HoverCardContent>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/50 bg-secondary/30 rounded-lg border px-1.5 py-1.5">
      <p className="numeral truncate text-[11px]">{value}</p>
      <p className="text-muted-foreground font-mono text-[9px] tracking-wide uppercase">{label}</p>
    </div>
  );
}
