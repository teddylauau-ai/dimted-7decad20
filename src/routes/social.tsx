import { createFileRoute, Link } from "@tanstack/react-router";
import { Music4, Radio } from "lucide-react";
import { PageHeader, Panel, PanelHead } from "@/components/dimted/primitives";
import { Avatar, Nametag } from "@/components/dimted/Identity";
import { SpotifyPlayer, SpotifyKindChip } from "@/components/dimted/SpotifyPlayer";
import { SpotifyPicks } from "@/components/dimted/SpotifyPicks";
import { useDimted } from "@/lib/dimted-store";
import { useSpotifyFeed } from "@/lib/spotify";

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [
      { title: "Social — what Lazu is listening to" },
      {
        name: "description",
        content:
          "Pin your favourite Spotify songs, albums and playlists to your Lazu profile and play what everyone else is listening to right in the app.",
      },
      { property: "og:title", content: "Social — what Lazu is listening to" },
      {
        property: "og:description",
        content: "Pin Spotify songs and playlists to your profile and hear what the whole squad is playing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SocialPage,
});

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function SocialPage() {
  const { profile } = useDimted();
  const feed = useSpotifyFeed();
  const items = (feed.data ?? []).filter((p) => p.user_id !== profile?.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Social"
        title="Sound board"
        blurb="Pin Spotify to your profile and play what everyone else has on repeat — no account linking, the players work straight away."
      />

      <Panel className="p-6">
        <PanelHead
          eyebrow="Your picks"
          title="Pinned to your profile"
          aside={<Music4 className="text-primary h-4 w-4" />}
        />
        <div className="mt-4">
          <SpotifyPicks
            userId={profile?.id}
            editable
            emptyHint="Paste a Spotify link above to pin your first track."
          />
        </div>
      </Panel>

      <Panel className="p-6" delay={60}>
        <PanelHead
          eyebrow="Everyone else"
          title="On repeat around Lazu"
          aside={<Radio className="text-primary h-4 w-4" />}
        />
        {feed.isLoading ? (
          <p className="text-muted-foreground mt-4 text-sm">Loading the feed…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            Nobody else has pinned anything yet — be the first and your picks show up here for the
            whole squad.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {items.map((pick) => (
              <div key={pick.id} className="glass-raised rounded-2xl p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  {pick.author ? (
                    <Link
                      to="/u/$username"
                      params={{ username: pick.author.username }}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <Avatar profile={pick.author} size={30} />
                      <span className="min-w-0 truncate">
                        <Nametag profile={pick.author} />
                      </span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-sm">Someone</span>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <SpotifyKindChip kind={pick.kind} />
                    <span className="text-muted-foreground/70 font-mono text-[10px]">
                      {timeAgo(pick.created_at)}
                    </span>
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
      </Panel>
    </div>
  );
}
