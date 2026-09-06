import { typingLabel } from "@/lib/typing";
import { cn } from "@/lib/utils";

/** Three-dot pulse plus "___ is typing…" — sits right above the composer input. */
export function TypingIndicator({
  names,
  className,
  variant = "bar",
}: {
  names: string[];
  className?: string;
  variant?: "bar" | "inline";
}) {
  const label = typingLabel(names);
  if (!label) return null;
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 italic",
        variant === "bar"
          ? "bg-secondary/30 border-border text-primary/80 border-b px-5 py-1.5 text-[11px]"
          : "text-muted-foreground px-1 pt-1 text-[12px]",
        className,
      )}
    >
      <span className="flex items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bg-primary size-1.5 animate-bounce rounded-full"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: "900ms" }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
