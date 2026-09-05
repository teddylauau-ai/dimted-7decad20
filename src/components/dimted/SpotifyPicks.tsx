import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Music4, Plus, Trash2, ExternalLink, Play, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpotifyPlayer, SpotifyKindChip } from "./SpotifyPlayer";
import { useMusic, useNowPlaying } from "@/lib/music";
import {
  MAX_PICKS,
  useAddSpotifyPick,
  useRemoveSpotifyPick,
  useSpotifyPicks,
  KIND_LABEL,
} from "@/lib/spotify";

/**
 * A member's pinned Spotify players. `editable` shows the paste-a-link form and
 * remove buttons — used on your own profile and the Social tab.
 */
export function SpotifyPicks({
  userId,
  editable = false,
  emptyHint,
}: {
  userId?: string | undefined;
  editable?: boolean | undefined;
  emptyHint?: string | undefined;
}) {
  const picks = useSpotifyPicks(userId);
  const add = useAddSpotifyPick(userId);
  const remove = useRemoveSpotifyPick();
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");

  const items = picks.data ?? [];
  const full = items.length >= MAX_PICKS;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    add.mutate(
      { link, note },
      {
        onSuccess: () => {
          setLink("");
          setNote("");
          toast.success("Pinned to your profile");
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Couldn't pin that"),
      },
    );
  }

  return (
    <div className="space-y-4">
      {editable ? (
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a Spotify link (song, album, playlist…)"
              aria-label="Spotify link"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Say something about it (optional)"
              aria-label="Note"
              maxLength={140}
            />
          </div>
          <Button type="submit" disabled={add.isPending || full || !link.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            {full ? "Slots full" : "Pin it"}
          </Button>
        </form>
      ) : null}

      {editable ? (
        <p className="text-muted-foreground/80 font-mono text-[11px]">
          {items.length}/{MAX_PICKS} pinned · on Spotify tap Share → Copy link
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          <Music4 className="mx-auto mb-2 h-5 w-5 opacity-70" />
          {emptyHint ?? "Nothing pinned yet."}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((pick) => (
            <div key={pick.id} className="glass-raised rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <SpotifyKindChip kind={pick.kind} />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      music.play({
                        kind: pick.kind,
                        spotifyId: pick.spotify_id,
                        url: pick.url,
                        note: pick.note,
                      })
                    }
                    className="text-muted-foreground hover:text-primary flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]"
                    aria-label="Keep playing across Lazu"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {music.isPlaying(pick.spotify_id) ? "In player" : "Play anywhere"}
                  </button>
                  <
                    href={pick.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
                    aria-label="Open in Spotify"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {editable ? (
                    <button
                      type="button"
                      onClick={() =>
                        remove.mutate(pick.id, {
                          onSuccess: () => toast.success("Removed"),
                          onError: () => toast.error("Couldn't remove that"),
                        })
                      }
                      className="text-muted-foreground hover:text-destructive rounded-md p-1.5"
                      aria-label="Remove pick"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              {pick.note ? (
                <p className="text-muted-foreground mb-2 text-sm">“{pick.note}”</p>
              ) : null}
              <SpotifyPlayer kind={pick.kind} spotifyId={pick.spotify_id} />
            </div>
          ))}
        </div>
      )}

      {editable ? (
        <p className="text-muted-foreground/70 text-[11px]">
          Anyone on Lazu can play these — see everyone's on the{" "}
          <Link to="/social" className="text-primary hover:underline">
            Social tab
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
