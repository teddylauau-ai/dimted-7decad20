import { useEffect, useRef } from "react";
import { colorPair, type ColorPair } from "@/lib/pulse";
import { drawPreview } from "@/lib/pulse-skins";

/**
 * Animated locker thumbnail — draws the exact same art the game engine uses,
 * so what you see in the shop is what you get in a run.
 */
export function PulseSkinPreview({
  kind,
  slug,
  colors,
  size = 56,
  className,
}: {
  kind: string;
  slug: string;
  /** Equipped colour slug, so previews match your current palette. */
  colors?: string | null;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const pair: ColorPair = kind === "colors" ? colorPair(slug) : colorPair(colors);

    let raf = 0;
    const frame = (now: number) => {
      drawPreview(ctx, kind, slug, pair, size, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [kind, slug, colors, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className={
        "border-border/70 bg-background/60 shrink-0 rounded-xl border " + (className ?? "")
      }
      aria-hidden
    />
  );
}
