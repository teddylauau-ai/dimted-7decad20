import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, Music4, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KIND_LABEL, spotifyEmbedUrl, type SpotifyKind } from "@/lib/spotify";
import { cn } from "@/lib/utils";

/**
 * One Spotify iframe lives in the app shell, so music keeps playing while you
 * move between tabs. Route pages just call `play()` on a pick.
 */
export type NowPlaying = {
  kind: SpotifyKind;
  spotifyId: string;
  url: string;
  note?: string | null;
};

type MusicCtx = {
  current: NowPlaying | null;
  play: (item: NowPlaying) => void;
  stop: () => void;
  isPlaying: (spotifyId: string) => boolean;
};

const KEY = "lazu:now-playing";

// Survive HMR: keep a single context instance on globalThis.
const g = globalThis as unknown as { __lazuMusicCtx?: React.Context<MusicCtx | null> };
const MusicContext = (g.__lazuMusicCtx ??= createContext<MusicCtx | null>(null));

async function pushStatus(item: NowPlaying | null) {
  try {
    await supabase.rpc("set_now_playing", {
      _kind: item?.kind ?? null,
      _id: item?.spotifyId ?? null,
      _url: item?.url ?? null,
      _note: item?.note ?? null,
    });
  } catch {
    /* status is cosmetic — never block playback */
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [minimised, setMinimised] = useState(false);

  // Restore the last thing you played after a reload.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setCurrent(JSON.parse(raw) as NowPlaying);
    } catch {
      /* ignore */
    }
  }, []);

  const play = useCallback((item: NowPlaying) => {
    setCurrent(item);
    setMinimised(false);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(item));
    } catch {
      /* ignore */
    }
    void pushStatus(item);
  }, []);

  const stop = useCallback(() => {
    setCurrent(null);
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    void pushStatus(null);
  }, []);

  const value = useMemo<MusicCtx>(
    () => ({ current, play, stop, isPlaying: (id: string) => current?.spotifyId === id }),
    [current, play, stop],
  );

  return (
    <MusicContext.Provider value={value}>
      {children}
      {current ? (
        <div className="glass-raised fixed right-3 bottom-24 z-40 w-[320px] overflow-hidden rounded-2xl border shadow-2xl lg:bottom-4">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase">
              <Music4 className="size-3 shrink-0" />
              <span className="truncate">Playing · {KIND_LABEL[current.kind]}</span>
            </span>
            <div className="flex items-center gap-0.5">
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-muted-foreground hover:text-foreground rounded p-1"
                aria-label="Open in Spotify"
              >
                <ExternalLink className="size-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setMinimised((m) => !m)}
                className="text-muted-foreground hover:text-foreground rounded p-1"
                aria-label={minimised ? "Expand player" : "Minimise player"}
              >
                {minimised ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={stop}
                className="text-muted-foreground hover:text-destructive rounded p-1"
                aria-label="Close player"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          {/* Kept mounted while minimised so audio never cuts out. */}
          <div className={cn("overflow-hidden transition-all", minimised ? "h-0" : "h-[152px]")}>
            <iframe
              title="Spotify player"
              src={spotifyEmbedUrl(current.kind, current.spotifyId)}
              width="100%"
              height={152}
              style={{ border: 0, display: "block" }}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
          </div>
        </div>
      ) : null}
    </MusicContext.Provider>
  );
}

export function useMusic(): MusicCtx {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used inside <MusicProvider>");
  return ctx;
}

export type NowPlayingRow = {
  now_playing_kind: SpotifyKind | null;
  now_playing_id: string | null;
  now_playing_url: string | null;
  now_playing_note: string | null;
  now_playing_at: string | null;
};

/** What a member last started playing, if it was recent (4h window). */
export function useNowPlaying(userId?: string) {
  return useQuery({
    queryKey: ["now-playing", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<NowPlayingRow | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("now_playing_kind, now_playing_id, now_playing_url, now_playing_note, now_playing_at")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      const row = data as NowPlayingRow | null;
      if (!row?.now_playing_id || !row.now_playing_kind || !row.now_playing_at) return null;
      if (Date.now() - Date.parse(row.now_playing_at) > 4 * 60 * 60 * 1000) return null;
      return row;
    },
  });
}
