import { Link } from "@tanstack/react-router";
import { Bell, Check, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDimted } from "@/lib/dimted-store";
import { useNotifications } from "@/lib/dimted-queries";
import { clearNotifications, markNotificationsRead } from "@/lib/dimted-actions";
import { cn } from "@/lib/utils";
import { Avatar } from "./Identity";

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

/**
 * Inbox bell. New DMs and community pings arrive here on their own — the query
 * polls, so you don't have to refresh to find out someone replied.
 */
export function NotificationBell() {
  const { profile } = useDimted();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [], isFetched } = useNotifications(profile?.id);
  const unread = items.filter((n) => !n.read_at);
  const wrap = useRef<HTMLDivElement>(null);
  const announced = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  // Toast genuinely new arrivals, but never replay the backlog on first load.
  useEffect(() => {
    if (!isFetched) return;
    if (!primed.current) {
      items.forEach((n) => announced.current.add(n.id));
      primed.current = true;
      return;
    }

    const fresh = items.filter((n) => !n.read_at && !announced.current.has(n.id));
    fresh.slice(0, 3).forEach((n) => {
      announced.current.add(n.id);
      toast(n.title, { description: n.body ?? undefined });
    });
    items.forEach((n) => announced.current.add(n.id));
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["notifications"] });

  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread.length > 0) {
      await markNotificationsRead(unread.map((n) => n.id));
      refresh();
    }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => void openPanel()}
        aria-label={unread.length ? `${unread.length} unread notifications` : "Notifications"}
        className={cn(
          "text-muted-foreground hover:bg-secondary/60 hover:text-foreground relative grid size-8 place-items-center rounded-lg transition-colors",
          unread.length > 0 && "text-gold",
        )}
      >
        <Bell className="size-4" />
        {unread.length > 0 ? (
          <span className="bg-gold text-background absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 font-mono text-[9px] font-bold">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="glass-raised animate-pop-in absolute bottom-10 left-0 z-50 w-[300px] rounded-xl border p-1.5 shadow-2xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="font-mono text-[10px] tracking-[0.16em] uppercase">Inbox</p>
            {items.length > 0 ? (
              <button
                onClick={async () => {
                  if (!profile?.id) return;
                  await clearNotifications(profile.id);
                  refresh();
                }}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono text-[10px]"
              >
                <Trash2 className="size-3" /> Clear
              </button>
            ) : null}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-xs">
                Nothing yet. Say hi to someone.
              </p>
            ) : (
              items.map((n) => {
                const body = (
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px]">{n.title}</span>
                    {n.body ? (
                      <span className="text-muted-foreground truncate text-[11px]">{n.body}</span>
                    ) : null}
                  </span>
                );
                const row = (
                  <>
                    {n.actor ? (
                      <Avatar profile={n.actor as never} size={28} />
                    ) : (
                      <span className="bg-secondary text-primary grid size-7 shrink-0 place-items-center rounded-full">
                        <Check className="size-3.5" />
                      </span>
                    )}
                    {body}
                    <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">
                      {ago(n.created_at)}
                    </span>
                  </>
                );
                const cls = cn(
                  "hover:bg-secondary/60 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                  !n.read_at && "bg-primary/5",
                );
                return n.link ? (
                  <Link key={n.id} to={n.link as never} onClick={() => setOpen(false)} className={cls}>
                    {row}
                  </Link>
                ) : (
                  <div key={n.id} className={cls}>
                    {row}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
