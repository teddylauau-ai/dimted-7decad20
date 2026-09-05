import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Compass,
  Crown,
  Music4,
  Gamepad2,
  Home,
  MessageCircle,
  Search,
  ShoppingBag,
  Sparkle,
  Swords,
  UserRound,
  Users,
  Zap,
  Backpack,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useDimted } from "@/lib/dimted-store";
import { searchProfiles, type PublicProfile } from "@/lib/dimted-queries";
import { useMyRole } from "@/lib/roles-queries";
import { Avatar } from "./Identity";

const PAGES = [
  { to: "/", label: "Home", icon: Home, hint: "Ladder, quests & leaderboard" },
  { to: "/messages", label: "Messages", icon: MessageCircle, hint: "Direct chats" },
  { to: "/communities", label: "Communities", icon: Users, hint: "Servers & channels" },
  { to: "/crews", label: "Crews", icon: Swords, hint: "Invite-only squads" },
  { to: "/season", label: "Season", icon: Crown, hint: "Monthly reward track" },
  { to: "/pulse", label: "Pulse Rush", icon: Zap, hint: "Rhythm platformer" },
  { to: "/activities", label: "Arcade", icon: Gamepad2, hint: "All minigames" },
  { to: "/study", label: "Study", icon: BookOpen, hint: "Tutor & Year 9 bank" },
  { to: "/shop", label: "Shop", icon: ShoppingBag, hint: "Cosmetics rotation" },
  { to: "/armory", label: "Armory", icon: Backpack, hint: "Your collection" },
  { to: "/friends", label: "Friends", icon: Sparkle, hint: "Requests & friend levels" },
  { to: "/discover", label: "Discover", icon: Compass, hint: "Find communities" },
  { to: "/social", label: "Social", icon: Music4, hint: "Spotify picks" },
  { to: "/profile", label: "Profile", icon: UserRound, hint: "Edit your look" },
] as const;

/** Global ⌘K / Ctrl+K palette: jump to any page or search players. */
export function CommandPalette() {
  const { profile } = useDimted();
  const { isStaff } = useMyRole(profile?.id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2 || !profile) {
      setPlayers([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchProfiles(query.trim(), profile.id);
        if (!cancelled) setPlayers(found);
      } catch {
        if (!cancelled) setPlayers([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, profile]);

  function go(to: string) {
    setOpen(false);
    setQuery("");
    navigate({ to });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-raised text-muted-foreground hover:text-foreground hidden items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-[11px] transition md:flex"
        title="Quick navigation"
      >
        <Search className="size-3.5" />
        <span>Jump to…</span>
        <kbd className="border-border rounded border px-1 text-[9px]">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Go anywhere, find anyone…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {searching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" /> Searching…
              </span>
            ) : (
              "Nothing found."
            )}
          </CommandEmpty>
          {players.length > 0 && (
            <CommandGroup heading="Players">
              {players.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`player-${p.username}-${p.display_name}`}
                  onSelect={() => go(`/u/${p.username}`)}
                >
                  <Avatar profile={p as never} size={22} />
                  <span className="ml-2">{p.display_name}</span>
                  <span className="text-muted-foreground ml-2 font-mono text-[10px]">
                    @{p.username}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Pages">
            {PAGES.map(({ to, label, icon: Icon, hint }) => (
              <CommandItem key={to} value={label} onSelect={() => go(to)}>
                <Icon className="size-4" />
                <span className="ml-2">{label}</span>
                <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                  {hint}
                </span>
              </CommandItem>
            ))}
            {isStaff && (
              <>
                <CommandSeparator />
                <CommandItem value="Admin panel" onSelect={() => go("/admin")}>
                  <ShieldCheck className="size-4" />
                  <span className="ml-2">Admin panel</span>
                  <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                    Staff only
                  </span>
                </CommandItem>
              </>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
