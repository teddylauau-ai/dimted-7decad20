import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { REACTION_CHOICES, type ReactionScope, type ReactionTally } from "@/lib/reactions";

/**
 * Reaction strip under a chat message. Existing tallies are always visible;
 * the picker only appears on hover/focus so quiet chats stay clean.
 */
export function Reactions({
  scope,
  messageId,
  tallies,
  onToggle,
}: {
  scope: ReactionScope;
  messageId: string;
  tallies: ReactionTally[];
  onToggle: (emoji: string, mine: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {tallies.map((r) => (
        <button
          key={`${scope}-${messageId}-${r.emoji}`}
          type="button"
          onClick={() => onToggle(r.emoji, r.mine)}
          aria-pressed={r.mine}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors",
            r.mine
              ? "border-primary/50 bg-primary/15 text-foreground"
              : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/70",
          )}
        >
          <span aria-hidden>{r.emoji}</span>
          <span className="numeral">{r.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          aria-label="Add reaction"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:!text-foreground rounded-full p-0.5 transition-colors focus-visible:text-foreground",
            open && "text-foreground",
          )}
        >
          <SmilePlus className="size-3.5" />
        </button>
        {open ? (
          <div className="glass-raised absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-full border px-1.5 py-1 shadow-lg">
            {REACTION_CHOICES.map((e) => {
              const mine = tallies.find((t) => t.emoji === e)?.mine ?? false;
              return (
                <button
                  key={e}
                  type="button"
                  className="hover:bg-secondary/70 rounded-full px-1 text-sm leading-none transition-colors"
                  onClick={() => {
                    onToggle(e, mine);
                    setOpen(false);
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
