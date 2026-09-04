import { cn } from "@/lib/utils";

/**
 * Lazu's mark: an "L" drawn as one open stroke — the upright is the ladder,
 * the base is the ground — with a small detached pip for the level you haven't
 * reached yet. Minimal on purpose: it has to read at 20px in the rail and at
 * 64px on the sign-in screen.
 */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        "from-primary/90 to-xp/90 grid shrink-0 place-items-center rounded-[30%] bg-gradient-to-br",
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        fill="none"
        stroke="currentColor"
        className="text-primary-foreground"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4v16h9" />
        <circle cx="17.5" cy="6" r="1.7" fill="currentColor" stroke="none" opacity="0.75" />
      </svg>

    </span>
  );
}

/** Lowercase wordmark, tight tracking, one gold pip. Nothing else. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold tracking-[-0.02em] lowercase", className)}>
      lazu
      <span className="text-gold">.</span>
    </span>
  );
}

export function BrandLockup({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark size={size} />
      <Wordmark className="text-[15px]" />
    </span>
  );
}
