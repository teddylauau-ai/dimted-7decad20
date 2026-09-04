import { typingLabel } from "@/lib/typing";
import { cn } from "@/lib/utils";

/** Three-dot pulse plus "___ is typing…" — renders nothing when nobody types. */
export function TypingIndicator({ names, className }: { names: string[]; className?: string }) {
  const label = typingLabel(names);
  if (!label) return null;
  return (
    <div
      aria-live="polite"
      className={cn(
        "text-muted-foreground flex items-center gap-2 px-5 pb-1 text-[11px] italic",
        className,
      )}
    >
      <span className="flex items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bg-primary/80 size-1.5 animate-bounce rounded-full"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: "900ms" }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
