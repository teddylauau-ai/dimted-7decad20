import { Music4 } from "lucide-react";
import {
  KIND_LABEL,
  spotifyEmbedHeight,
  spotifyEmbedUrl,
  type SpotifyKind,
} from "@/lib/spotify";
import { cn } from "@/lib/utils";

/** Spotify's own embedded player, wrapped in Lazu glass. */
export function SpotifyPlayer({
  kind,
  spotifyId,
  className,
}: {
  kind: SpotifyKind;
  spotifyId: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl", className)}>
      <iframe
        title={`Spotify ${KIND_LABEL[kind]} player`}
        src={spotifyEmbedUrl(kind, spotifyId)}
        width="100%"
        height={spotifyEmbedHeight(kind)}
        style={{ border: 0, display: "block" }}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

/** Small pill showing what type of Spotify content a pick is. */
export function SpotifyKindChip({ kind }: { kind: SpotifyKind }) {
  return (
    <span className="border-border/60 bg-background/40 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
      <Music4 className="h-3 w-3" />
      {KIND_LABEL[kind]}
    </span>
  );
}
