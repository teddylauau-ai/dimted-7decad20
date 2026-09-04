import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Send, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmt(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const MAX_MS = 120_000;

/**
 * Hold-free recorder: tap to start, tap to stop, then send or scrap the clip.
 * Each clip is a self-contained recording (one MediaRecorder per take).
 */
export function VoiceRecorder({
  onSend,
  disabled,
}: {
  onSend: (blob: Blob, durationMs: number) => Promise<void>;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; ms: number } | null>(null);
  const [sending, setSending] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser can't record audio");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access is needed to record a voice message");
      return;
    }
    const mime = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const ms = Date.now() - startRef.current;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1200 || ms < 500) {
        toast.error("That clip was too short — hold on a moment longer");
        return;
      }
      setClip({ blob, url: URL.createObjectURL(blob), ms });
    };
    recorderRef.current = rec;
    startRef.current = Date.now();
    setElapsed(0);
    setRecording(true);
    rec.start();
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startRef.current;
      setElapsed(ms);
      if (ms >= MAX_MS) stop();
    }, 100);
  }

  function stop() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  function scrap() {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
  }

  async function commit() {
    if (!clip) return;
    setSending(true);
    try {
      await onSend(clip.blob, clip.ms);
      scrap();
    } catch {
      toast.error("Voice message didn't send");
    } finally {
      setSending(false);
    }
  }

  if (clip) {
    return (
      <div className="border-border bg-secondary/30 flex items-center gap-2 rounded-md border px-2 py-1">
        <audio src={clip.url} controls className="h-8 max-w-[190px]" />
        <span className="text-muted-foreground font-mono text-[10px]">{fmt(clip.ms)}</span>
        <Button type="button" size="icon" variant="ghost" onClick={scrap} aria-label="Discard clip">
          <Trash2 className="size-4" />
        </Button>
        <Button type="button" size="icon" onClick={() => void commit()} disabled={sending} aria-label="Send voice message">
          <Send className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant={recording ? "destructive" : "secondary"}
      disabled={disabled}
      onClick={() => (recording ? stop() : void start())}
      aria-label={recording ? "Stop recording" : "Record a voice message"}
      className={cn("relative shrink-0", recording && "animate-pulse")}
      title={recording ? `Recording ${fmt(elapsed)} — tap to stop` : "Record a voice message"}
    >
      {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
    </Button>
  );
}

/** Compact bubble player used inside chat rows. */
export function VoicePlayer({ url, ms }: { url: string; ms?: number | null | undefined }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <div className="border-border bg-secondary/30 mt-1 inline-flex max-w-full items-center gap-3 rounded-full border px-3 py-2">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
        className="hidden"
      />
      <button
        type="button"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (playing) el.pause();
          else void el.play();
        }}
        className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <span className="bg-border/70 relative h-1 w-28 overflow-hidden rounded-full sm:w-40">
        <span
          className="bg-primary absolute inset-y-0 left-0 rounded-full transition-[width] duration-150"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </span>
      <span className="text-muted-foreground font-mono text-[10px]">{ms ? fmt(ms) : "voice"}</span>
    </div>
  );
}
