import { useRef, useState } from "react";
import { ImagePlus, Pin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A chat image: rounded thumbnail, click to open a full-screen lightbox. */
export function ChatImage({ src, alt = "Shared image" }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block max-w-xs overflow-hidden rounded-xl border border-white/10 transition hover:border-white/30"
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="max-h-64 w-full object-cover"
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={() => setOpen(false)}
            aria-label="Close image"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/** Image attach button — same slot as the mic button in chat composers. */
export function ImagePicker({
  onPick,
  disabled,
}: {
  onPick: (file: File) => void | Promise<void>;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await onPick(file);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled || busy}
        onClick={() => ref.current?.click()}
        title="Send an image"
        aria-label="Send an image"
        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
      >
        <ImagePlus className={busy ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
      </Button>
    </>
  );
}

/** The banner shown under the header when the conversation has a pinned message. */
export function PinBanner({
  body,
  onJump,
  onUnpin,
}: {
  body: string;
  onJump: () => void;
  onUnpin: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-amber-500/[0.06] px-4 py-2 text-xs">
      <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
      <button
        type="button"
        onClick={onJump}
        className="min-w-0 flex-1 truncate text-left text-muted-foreground transition hover:text-foreground"
        title="Jump to pinned message"
      >
        {body}
      </button>
      <button
        type="button"
        onClick={onUnpin}
        className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        title="Unpin"
        aria-label="Unpin message"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ replies */

import type { ChatMessage } from "@/lib/dimted-queries";
import { Reply, CornerUpLeft } from "lucide-react";

/** Resolve a message's reply target from the currently loaded list. */
export function findReplyTarget(
  list: ChatMessage[],
  m: ChatMessage,
): ChatMessage | null {
  if (!m.reply_to_id) return null;
  return list.find((x) => x.id === m.reply_to_id) ?? null;
}

/** Small quoted line rendered above a message that replies to another. */
export function ReplyQuote({
  target,
  onJump,
}: {
  target: ChatMessage | null;
  onJump?: (id: string) => void;
}) {
  if (!target) {
    return (
      <p className="text-muted-foreground/60 mb-0.5 flex items-center gap-1.5 font-mono text-[10px] italic">
        <CornerUpLeft className="size-3" /> Original message was removed
      </p>
    );
  }
  const snippet = target.audio_url
    ? "Voice message"
    : target.image_url
      ? "Image"
      : target.body;
  return (
    <button
      type="button"
      onClick={() => onJump?.(target.id)}
      className="border-primary/40 bg-secondary/30 hover:bg-secondary/50 mb-1 flex max-w-full items-center gap-1.5 rounded-md border-l-2 py-0.5 pr-2 pl-2 text-left transition-colors"
    >
      <CornerUpLeft className="text-primary size-3 shrink-0" />
      <span className="text-primary shrink-0 font-mono text-[10px]">
        {target.author?.display_name ?? "Unknown"}
      </span>
      <span className="text-muted-foreground truncate text-[11px]">{snippet}</span>
    </button>
  );
}

/** Chip shown above the composer while you're replying to a message. */
export function ReplyChip({
  target,
  onCancel,
}: {
  target: ChatMessage;
  onCancel: () => void;
}) {
  return (
    <div className="border-border bg-secondary/20 flex items-center gap-2 border-b px-4 py-1.5 text-xs">
      <Reply className="text-primary size-3.5 shrink-0" />
      <span className="text-muted-foreground min-w-0 flex-1 truncate">
        Replying to{" "}
        <span className="text-foreground font-medium">
          {target.author?.display_name ?? "Unknown"}
        </span>
        {" · "}
        {target.audio_url ? "Voice message" : target.image_url ? "Image" : target.body}
      </span>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        title="Cancel reply"
        className="text-muted-foreground hover:text-foreground rounded p-0.5"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
