import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Spotify picks — members paste a Spotify link (song, album, artist, playlist,
 * podcast) and we render Spotify's own embedded player. No account linking is
 * needed: the embed handles playback and Spotify sign-in itself.
 */

export const SPOTIFY_KINDS = [
  "track",
  "album",
  "artist",
  "playlist",
  "episode",
  "show",
] as const;

export type SpotifyKind = (typeof SPOTIFY_KINDS)[number];

export type SpotifyPick = {
  id: string;
  user_id: string;
  url: string;
  kind: SpotifyKind;
  spotify_id: string;
  note: string | null;
  created_at: string;
};

export type SpotifyPickWithAuthor = SpotifyPick & {
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    level: number;
    equipped_nametag: string | null;
    equipped_badge: string | null;
    equipped_frame: string | null;
  } | null;
};

export const MAX_PICKS = 8;

/** Parsed shape of a Spotify link or URI. */
export type ParsedSpotify = { kind: SpotifyKind; id: string; url: string };

/** Accepts open.spotify.com links (with or without /intl-xx/) and spotify: URIs. */
export function parseSpotifyLink(raw: string): ParsedSpotify | null {
  const input = raw.trim();
  if (!input) return null;

  const uri = input.match(/^spotify:(track|album|artist|playlist|episode|show):([A-Za-z0-9]+)$/i);
  if (uri) {
    const kind = uri[1].toLowerCase() as SpotifyKind;
    const id = uri[2];
    return { kind, id, url: `https://open.spotify.com/${kind}/${id}` };
  }

  const web = input.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|artist|playlist|episode|show)\/([A-Za-z0-9]+)/i,
  );
  if (web) {
    const kind = web[1].toLowerCase() as SpotifyKind;
    const id = web[2];
    return { kind, id, url: `https://open.spotify.com/${kind}/${id}` };
  }

  return null;
}

export function spotifyEmbedUrl(kind: SpotifyKind, id: string, compact = false) {
  const params = new URLSearchParams({ utm_source: "generator", theme: "0" });
  return `https://open.spotify.com/embed/${kind}/${id}?${params.toString()}${
    compact ? "&compact=1" : ""
  }`;
}

/** Player height Spotify recommends per content type. */
export function spotifyEmbedHeight(kind: SpotifyKind) {
  return kind === "track" || kind === "episode" ? 152 : 352;
}

export const KIND_LABEL: Record<SpotifyKind, string> = {
  track: "Song",
  album: "Album",
  artist: "Artist",
  playlist: "Playlist",
  episode: "Episode",
  show: "Podcast",
};

const AUTHOR_FIELDS =
  "id, username, display_name, avatar_url, level, equipped_nametag, equipped_badge, equipped_frame";

/** Newest picks across every member — powers the Social tab feed. */
export function useSpotifyFeed(limit = 40) {
  return useQuery({
    queryKey: ["spotify-feed", limit],
    queryFn: async (): Promise<SpotifyPickWithAuthor[]> => {
      const { data, error } = await supabase
        .from("spotify_picks")
        .select(`id, user_id, url, kind, spotify_id, note, created_at, author:profiles!spotify_picks_user_id_fkey (${AUTHOR_FIELDS})`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as SpotifyPickWithAuthor[];
    },
    staleTime: 20_000,
  });
}

/** One member's picks, newest first. */
export function useSpotifyPicks(userId?: string) {
  return useQuery({
    queryKey: ["spotify-picks", userId],
    enabled: !!userId,
    queryFn: async (): Promise<SpotifyPick[]> => {
      const { data, error } = await supabase
        .from("spotify_picks")
        .select("id, user_id, url, kind, spotify_id, note, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SpotifyPick[];
    },
    staleTime: 20_000,
  });
}

export function useAddSpotifyPick(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ link, note }: { link: string; note: string }) => {
      if (!userId) throw new Error("Sign in first");
      const parsed = parseSpotifyLink(link);
      if (!parsed) {
        throw new Error("That doesn't look like a Spotify link — copy it from Share > Copy link");
      }
      const { count, error: countErr } = await supabase
        .from("spotify_picks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (countErr) throw countErr;
      if ((count ?? 0) >= MAX_PICKS) {
        throw new Error(`You can pin ${MAX_PICKS} at a time — remove one first`);
      }
      const { error } = await supabase.from("spotify_picks").insert({
        user_id: userId,
        url: parsed.url,
        kind: parsed.kind,
        spotify_id: parsed.id,
        note: note.trim() ? note.trim().slice(0, 140) : null,
      });
      if (error) {
        if (error.code === "23505" || error.code === "23205" || /duplicate/i.test(error.message)) {
          throw new Error("You've already pinned that one");
        }
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["spotify-picks"] });
      void qc.invalidateQueries({ queryKey: ["spotify-feed"] });
    },
  });
}

export function useRemoveSpotifyPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spotify_picks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["spotify-picks"] });
      void qc.invalidateQueries({ queryKey: ["spotify-feed"] });
    },
  });
}
