import { useEffect } from "react";
import { useNotifications } from "@/lib/dimted-queries";

/** How many unread DM notifications you have right now. */
export function useUnreadMessages(userId: string | undefined): number {
  const { data: items = [] } = useNotifications(userId);
  return items.filter((n) => !n.read_at && n.kind === "message").length;
}

/**
 * Mirrors the unread DM count into the browser tab title, so a new message is
 * visible even when Lazu is in a background tab. Messages only — no other
 * notification kind touches the tab.
 */
export function useMessageTabBadge(count: number) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
    return () => {
      document.title = document.title.replace(/^\(\d+\)\s*/, "");
    };
  }, [count]);
}

/** How many unread crew notifications you have right now. */
export function useUnreadCrew(userId: string | undefined): number {
  const { data: items = [] } = useNotifications(userId);
  return items.filter((n) => !n.read_at && n.kind === "crew").length;
}
