import { Link } from "@tanstack/react-router";
import {
  BADGE_CLASS,
  BADGE_GLYPH,
  FRAME_CLASS,
  NAMETAG_CLASS,
  type WornCosmetics,
} from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

export type IdentityProfile = {
  username: string;
  display_name: string;
  equipped_nametag?: string | null;
  equipped_badge?: string | null;
  equipped_frame?: string | null;
  avatar_url?: string | null;
};

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

/** Avatar with the wearer's frame. Discord-style rounded square. */
export function Avatar({
  profile,
  size = 40,
  className,
}: {
  profile: IdentityProfile | null | undefined;
  size?: number;
  className?: string;
}) {
  const frame = profile?.equipped_frame ? FRAME_CLASS[profile.equipped_frame] : undefined;
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size / 2.6) }}
      className={cn(
        "bg-secondary text-foreground/90 font-display grid shrink-0 place-items-center overflow-hidden rounded-xl font-semibold select-none",
        frame,
        className,
      )}
    >
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={`${profile.display_name}'s profile picture`}
          loading="lazy"
          className="h-full w-full rounded-xl object-cover"
        />
      ) : (
        initials(profile?.display_name ?? "?")
      )}
    </span>
  );
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
  return (
    <Tag className={cn("inline-flex items-center gap-1.5 font-medium", className)}>
      <span className={cn(tag)}>{profile?.display_name ?? "Unknown"}</span>
      {badge && BADGE_GLYPH[badge] ? (
        <span className={cn("text-xs", BADGE_CLASS[badge])} aria-hidden>
          {BADGE_GLYPH[badge]}
        </span>
      ) : null}
    </Tag>
  );
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
    <Link
      to="/u/$username"
      params={{ username: profile.username }}
      className={cn("hover:underline", className)}
    >
      {children ?? <Nametag profile={profile} />}
    </Link>
  );
}

/** Avatar + name + optional meta line, the standard row used in every list. */
export function IdentityRow({
  profile,
  meta,
  size = 36,
  className,
  linked = true,
}: {
  profile: IdentityProfile | null | undefined;
  meta?: React.ReactNode;
  size?: number;
  className?: string;
  linked?: boolean;
}) {
  const body = (
    <>
      <Avatar profile={profile} size={size} />
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
    <Link
      to="/u/$username"
      params={{ username: profile.username }}
      className={cn(
        "hover:bg-secondary/50 flex min-w-0 items-center gap-2.5 rounded-lg transition-colors",
        className,
      )}
    >
      {body}
    </Link>
  );
}
