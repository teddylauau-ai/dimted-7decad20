/**
 * Presence is observed, never declared. You can't set "do not disturb" in
 * Lazu — your status is whatever you're actually doing, worked out from the
 * last time the app told the server you were alive and what you were doing.
 */

export type PresenceState = "online" | "idle" | "away" | "offline";

export type PresenceInfo = {
  state: PresenceState;
  label: string;
  dotClass: string;
  textClass: string;
};

const ONLINE_MS = 2 * 60 * 1000;
const IDLE_MS = 10 * 60 * 1000;
const AWAY_MS = 45 * 60 * 1000;

/** Nice label for what someone is doing right now. */
function contextLabel(context: string | null | undefined): string | null {
  if (!context) return null;
  const map: Record<string, string> = {
    arcade: "In the Arcade",
    study: "Studying",
    messages: "In chat",
    communities: "In a community",
    shop: "Browsing the Shop",
    discover: "Exploring",
    profile: "Tidying their profile",
    home: "Online",
    friends: "Online",
    admin: "Online",
  };
  return map[context] ?? null;
}

export function presenceFor(
  lastActiveAt: string | null | undefined,
  context?: string | null,
): PresenceInfo {
  if (!lastActiveAt) {
    return {
      state: "offline",
      label: "Offline",
      dotClass: "bg-muted-foreground/50",
      textClass: "text-muted-foreground",
    };
  }
  const age = Date.now() - Date.parse(lastActiveAt);

  if (age < ONLINE_MS) {
    return {
      state: "online",
      label: contextLabel(context) ?? "Online",
      dotClass: "bg-uncommon",
      textClass: "text-uncommon",
    };
  }
  if (age < IDLE_MS) {
    return { state: "idle", label: "Idle", dotClass: "bg-gold", textClass: "text-gold" };
  }
  if (age < AWAY_MS) {
    return {
      state: "away",
      label: "Away",
      dotClass: "bg-energy/70",
      textClass: "text-energy",
    };
  }
  return {
    state: "offline",
    label: `Last seen ${relative(age)}`,
    dotClass: "bg-muted-foreground/50",
    textClass: "text-muted-foreground",
  };
}

function relative(ageMs: number): string {
  const mins = Math.round(ageMs / 60000);
  if (mins < 90) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Map a route path to the context string we report to the server. */
export function contextFromPath(path: string): string {
  if (path.startsWith("/activities")) return "arcade";
  if (path.startsWith("/study")) return "study";
  if (path.startsWith("/messages")) return "messages";
  if (path.startsWith("/communities")) return "communities";
  if (path.startsWith("/shop")) return "shop";
  if (path.startsWith("/discover")) return "discover";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/friends")) return "friends";
  if (path.startsWith("/admin")) return "admin";
  return "home";
}
