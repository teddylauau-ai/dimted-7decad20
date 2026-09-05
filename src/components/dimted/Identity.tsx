import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BADGE_CLASS,
  BADGE_GLYPH,
  FRAME_CLASS,
  NAMETAG_CLASS,
  type WornCosmetics,
} from "@/lib/cosmetics";
import { ProfileHoverCard } from "@/components/dimted/ProfileHoverCard";
import { presenceFor } from "@/lib/presence";
import { cn } from "@/lib/utils";

/** Presence is time-based, so re-render every 20s or dots go stale on screen. */
function usePresenceTick() {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 20_000);
    return () => window.clearInterval(t);
  }, []);
}


export type IdentityProfile = {
  username: string;
  display_name: string;
  equipped_nametag?: string | null;
  equipped_badge?: string | null;
  equipped_frame?: string | null;
  avatar_url?: string | null;
  last_active_at?: string | null;
  activity_context?: string | null;
};

function presenceVars(size: number) {
  const s = Math.max(8, Math.round(size / 4));
  const stroke = Math.max(2, Math.round(size / 22));
  const offset = Math.round(stroke / 2);
  return {
    ["--pd-size" as string]: `${s}`,
    ["--pd-offset" as string]: `${offset}`,
  } as React.CSSProperties;
}

/** Live status dot. Derived from real activity — nobody can set it by hand. */
export function PresenceDot({
  profile,
  size = 40,
  className,
}: {
  profile: IdentityProfile | null | undefined;
  size?: number;
  className?: string;
}) {
  const p = presenceFor(profile?.last_active_at, profile?.activity_context);
  const offline = p.state === "offline";
  return (
    <span
      title={p.label}
      aria-label={p.label}
      style={presenceVars(size)}
      className={cn(
        "presence-dot grid place-items-center",
        offline ? "bg-muted text-muted-foreground" : p.dotClass,
        className,
      )}
    >
      {offline ? (
        <svg viewBox="0 0 10 10" aria-hidden className="size-[55%]">
          <path
            d="M2 2 L8 8 M8 2 L2 8"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

/** Status text ("In the Arcade", "Idle", "Last seen 2h ago"). */
export function PresenceLabel({
  profile,
  className,
}: {
  profile: IdentityProfile | null | undefined;
  className?: string;
}) {
  const p = presenceFor(profile?.last_active_at, profile?.activity_context);
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10px]", p.textClass, className)}>
      <span className={cn("size-1.5 rounded-full", p.dotClass)} />
      {p.label}
    </span>
  );
}

export function worn(p: IdentityProfile | null | undefined): WornCosmetics {
  return {
    nametag: p?.equipped_nametag,
    badge: p?.equipped_badge,
    frame: p?.equipped_frame,
  };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Avatar with the wearer's frame — always a circle.
 *  The wrapper is exactly `size` px and the frame is drawn inside that box
 *  (border or ::before ring layer), so it forms a complete, centred ring around
 *  the picture no matter where the avatar is placed. Callers cannot change the
 *  shape; `rounded-full` is applied last on purpose. */
export function Avatar({
  profile,
  size = 40,
  className,
  presence = true,
}: {
  profile: IdentityProfile | null | undefined;
  size?: number;
  className?: string;
  presence?: boolean;
}) {
  const frame = profile?.equipped_frame ? FRAME_CLASS[profile.equipped_frame] : undefined;
  const ringW = size >= 72 ? 4 : size >= 48 ? 3 : 2;
  const innerSize = size - ringW * 2;
  const fontSize = Math.round(innerSize / 2.6);

  const inner = (
    <span
      style={{ width: innerSize, height: innerSize, fontSize }}
      className="bg-secondary text-foreground/90 font-display relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none"
    >
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={`${profile.display_name}'s profile picture`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        initials(profile?.display_name ?? "?")
      )}
    </span>
  );

  const body = (
    <span
      style={{ width: size, height: size, ["--frame-w" as string]: `${ringW}px` }}
      className={cn(
        className,
        frame,
        "relative isolate grid shrink-0 place-items-center rounded-full",
      )}
    >
      {presence ? (
        <span className="relative inline-flex shrink-0">
          {inner}
          <PresenceDot profile={profile} size={size} />
        </span>
      ) : (
        inner
      )}
    </span>
  );

  if (!profile?.username) return body;
  return <ProfileHoverCard username={profile.username}>{body}</ProfileHoverCard>;
}

/** The name itself, wearing its nametag + badge. */
export function Nametag({
  profile,
  className,
  as = "span",
}: {
  profile: IdentityProfile | null | undefined;
  className?: string;
  as?: "span" | "h1";
}) {
  const tag = profile?.equipped_nametag ? NAMETAG_CLASS[profile.equipped_nametag] : undefined;
  const badge = profile?.equipped_badge;
  const Tag = as;
  const body = (
    <Tag className={cn("inline-flex items-center gap-1.5 font-medium", className)}>
      <span className={cn(tag)}>{profile?.display_name ?? "Unknown"}</span>
      {badge && BADGE_GLYPH[badge] ? (
        <span className={cn("text-xs", BADGE_CLASS[badge])} aria-hidden>
          {BADGE_GLYPH[badge]}
        </span>
      ) : null}
    </Tag>
  );
  if (!profile?.username) return body;
  return <ProfileHoverCard username={profile.username}>{body}</ProfileHoverCard>;
}

/** Clickable name → that person's public profile. */
export function ProfileLink({
  profile,
  className,
  children,
}: {
  profile: IdentityProfile | null | undefined;
  className?: string;
  children?: React.ReactNode;
}) {
  if (!profile) return <span className={className}>Unknown</span>;
  return (
    <ProfileHoverCard username={profile.username}>
      <Link
        to="/u/$username"
        params={{ username: profile.username }}
        className={cn("hover:underline", className)}
      >
        {children ?? <Nametag profile={profile} />}
      </Link>
    </ProfileHoverCard>
  );
}

/** Avatar + name + optional meta line, the standard row used in every list. */
export function IdentityRow({
  profile,
  meta,
  size = 36,
  className,
  linked = true,
  presence = true,
}: {
  profile: IdentityProfile | null | undefined;
  meta?: React.ReactNode;
  size?: number;
  className?: string;
  linked?: boolean;
  presence?: boolean;
}) {
  const body = (
    <>
      <Avatar profile={profile} size={size} presence={presence} />
      <span className="min-w-0 flex-1">
        <Nametag profile={profile} className="block truncate text-sm" />
        {meta ? (
          <span className="text-muted-foreground block truncate font-mono text-[10px]">{meta}</span>
        ) : null}
      </span>
    </>
  );
  if (!linked || !profile) {
    return <span className={cn("flex min-w-0 items-center gap-2.5", className)}>{body}</span>;
  }
  return (
    <ProfileHoverCard username={profile.username} className="w-full">
      <Link
        to="/u/$username"
        params={{ username: profile.username }}
        className={cn(
          "hover:bg-secondary/50 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg transition-colors",
          className,
        )}
      >
        {body}
      </Link>
    </ProfileHoverCard>
  );
}
