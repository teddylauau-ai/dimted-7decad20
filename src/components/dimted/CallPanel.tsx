/**
 * Call controls + tiles for a chat header.
 *
 * Two states: nobody is calling (offer "Voice" / "Video" buttons, plus a
 * "someone is in a call" banner when others are already talking), or you are
 * in the call (a strip of tiles with mic/camera/hang-up controls).
 */
import { useEffect, useRef } from "react";
import { Mic, MicOff, PhoneCall, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/dimted/Identity";
import {
  useActiveCall,
  useCallHeadcount,
  useCallSession,
  type CallPeer,
  type CallScope,
} from "@/lib/calls";
import { cn } from "@/lib/utils";

type MiniProfile = { id: string; display_name: string; username: string } & Record<string, unknown>;

function Tile({
  stream,
  label,
  muted,
  profile,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  profile?: MiniProfile | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = !!stream?.getVideoTracks().some((t) => t.enabled);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream, hasVideo]);

  return (
    <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/60">
      <video
        ref={videoRef}
        muted={muted}
        playsInline
        autoPlay
        className={cn("h-full w-full object-cover", hasVideo ? "" : "hidden")}
      />
      {hasVideo ? null : (
        <div className="flex h-full w-full items-center justify-center">
          {profile ? (
            <Avatar profile={profile as never} size={40} showPresence={false} />
          ) : (
            <span className="text-xs text-muted-foreground">Audio</span>
          )}
        </div>
      )}
      <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-background/80 px-1 text-[10px] font-medium">
        {label}
      </span>
    </div>
  );
}

export function CallPanel({
  scope,
  scopeId,
  meId,
  meProfile,
  lookup,
  compact,
}: {
  scope: CallScope;
  scopeId: string | null | undefined;
  meId: string | null | undefined;
  meProfile?: MiniProfile | null;
  /** Resolve a participant id to a profile for their tile, when known. */
  lookup?: (userId: string) => MiniProfile | null;
  compact?: boolean;
}) {
  const live = useActiveCall(scope, scopeId);
  const session = useCallSession(scope, scopeId, meId);
  const heads = useCallHeadcount(live.data?.id ?? null);
  const others = (heads.data ?? []).filter((id) => id !== meId);

  if (!scopeId) return null;

  if (!session.inCall) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {others.length ? (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {others.length === 1 ? "1 person in a call" : `${others.length} people in a call`}
          </span>
        ) : null}
        {session.error ? (
          <span className="text-xs text-destructive">{session.error}</span>
        ) : null}
        <Button
          size="sm"
          variant={others.length ? "default" : "outline"}
          disabled={session.joining}
          onClick={() => void session.join(false)}
        >
          <PhoneCall className="mr-1.5 h-4 w-4" />
          {others.length ? "Join" : "Voice"}
        </Button>
        {compact ? null : (
          <Button
            size="sm"
            variant="outline"
            disabled={session.joining}
            onClick={() => void session.join(true)}
          >
            <Video className="mr-1.5 h-4 w-4" />
            Video
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-primary/30 bg-primary/5 p-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Tile
          stream={session.localStream}
          label="You"
          muted
          profile={meProfile ?? null}
        />
        {session.peers.map((p: CallPeer) => (
          <Tile
            key={p.userId}
            stream={p.stream}
            label={lookup?.(p.userId)?.display_name ?? "Connecting…"}
            profile={lookup?.(p.userId) ?? null}
          />
        ))}
        {session.peers.length === 0 ? (
          <span className="px-2 text-xs text-muted-foreground">
            Waiting for someone to join…
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant={session.micOn ? "secondary" : "outline"} onClick={session.toggleMic}>
          {session.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          variant={session.camOn ? "secondary" : "outline"}
          onClick={() => void session.toggleCam()}
        >
          {session.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="destructive" onClick={() => void session.leave()}>
          <PhoneOff className="mr-1.5 h-4 w-4" />
          Leave
        </Button>
      </div>
    </div>
  );
}
