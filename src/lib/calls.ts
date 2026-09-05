/**
 * Voice and video calls.
 *
 * Peer-to-peer (WebRTC) mesh with the database used only as the mailbox that
 * lets two browsers find each other: each participant writes offers, answers
 * and ICE candidates addressed to one other participant, and polls for the
 * ones addressed to it. Media itself never touches the server.
 *
 * Works for both scopes: a direct chat (`dm`, friendship id) and a community
 * channel (`channel`, channel id). Small rooms only — a mesh means every
 * participant connects to every other one, which is fine for a handful of
 * people.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CallScope = "dm" | "channel" | "crew";

export type CallRow = {
  id: string;
  scope_type: string;
  scope_id: string;
  started_by: string;
  video: boolean;
  ended_at: string | null;
  created_at: string;
};

export type CallPeer = {
  userId: string;
  stream: MediaStream | null;
  video: boolean;
};

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/** The live (not yet ended) call for a chat or channel, if there is one. */
export function useActiveCall(scope: CallScope, scopeId: string | null | undefined) {
  return useQuery({
    queryKey: ["call", scope, scopeId],
    enabled: !!scopeId,
    refetchInterval: 4000,
    queryFn: async (): Promise<CallRow | null> => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, scope_type, scope_id, started_by, video, ended_at, created_at")
        .eq("scope_type", scope)
        .eq("scope_id", scopeId!)
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as CallRow | undefined) ?? null;
    },
  });
}

/** How many people are currently in a given call (for the "join" banner). */
export function useCallHeadcount(callId: string | null | undefined) {
  return useQuery({
    queryKey: ["call-heads", callId],
    enabled: !!callId,
    refetchInterval: 4000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("call_participants")
        .select("user_id")
        .eq("call_id", callId!)
        .is("left_at", null);
      if (error) throw error;
      return (data ?? []).map((r) => r.user_id as string);
    },
  });
}

type PeerBox = {
  pc: RTCPeerConnection;
  polite: boolean;
  stream: MediaStream;
};

export function useCallSession(
  scope: CallScope,
  scopeId: string | null | undefined,
  userId: string | null | undefined,
) {
  const qc = useQueryClient();
  const [callId, setCallId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<CallPeer[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const peersRef = useRef(new Map<string, PeerBox>());
  const localRef = useRef<MediaStream | null>(null);
  const lastSignal = useRef(0);
  const callRef = useRef<string | null>(null);
  const meRef = useRef<string | null>(null);
  meRef.current = userId ?? null;

  const publishPeers = useCallback(() => {
    setPeers(
      [...peersRef.current.entries()].map(([id, box]) => ({
        userId: id,
        stream: box.stream,
        video: box.stream.getVideoTracks().some((t) => t.enabled),
      })),
    );
  }, []);

  const send = useCallback(
    async (to: string | null, kind: "offer" | "answer" | "ice" | "leave", payload: unknown) => {
      const call = callRef.current;
      const me = meRef.current;
      if (!call || !me) return;
      await supabase.from("call_signals").insert({
        call_id: call,
        from_user: me,
        to_user: to,
        kind,
        payload: payload as never,
      });
    },
    [],
  );

  /** Create (or reuse) the connection to one other participant. */
  const peerFor = useCallback(
    (otherId: string): PeerBox => {
      const existing = peersRef.current.get(otherId);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      const stream = new MediaStream();
      const box: PeerBox = { pc, polite: (meRef.current ?? "") > otherId, stream };
      peersRef.current.set(otherId, box);

      for (const track of localRef.current?.getTracks() ?? []) {
        pc.addTrack(track, localRef.current!);
      }
      pc.ontrack = (e) => {
        for (const t of e.streams[0]?.getTracks() ?? [e.track]) stream.addTrack(t);
        publishPeers();
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) void send(otherId, "ice", e.candidate.toJSON());
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          peersRef.current.delete(otherId);
          publishPeers();
        }
      };
      publishPeers();
      return box;
    },
    [publishPeers, send],
  );

  const teardown = useCallback(() => {
    for (const [, box] of peersRef.current) box.pc.close();
    peersRef.current.clear();
    for (const t of localRef.current?.getTracks() ?? []) t.stop();
    localRef.current = null;
    setLocalStream(null);
    setPeers([]);
    lastSignal.current = 0;
  }, []);

  const leave = useCallback(async () => {
    const call = callRef.current;
    const me = meRef.current;
    callRef.current = null;
    setCallId(null);
    teardown();
    if (!call || !me) return;
    await send(null, "leave", {});
    await supabase.from("call_participants").delete().eq("call_id", call).eq("user_id", me);
    const { data } = await supabase
      .from("call_participants")
      .select("user_id")
      .eq("call_id", call);
    if (!data?.length) {
      await supabase.from("calls").update({ ended_at: new Date().toISOString() }).eq("id", call);
    }
    void qc.invalidateQueries({ queryKey: ["call", scope, scopeId] });
  }, [qc, scope, scopeId, send, teardown]);

  /** Join the live call, starting one if nobody has yet. */
  const join = useCallback(
    async (withVideo: boolean) => {
      if (!scopeId || !userId || joining || callRef.current) return;
      setJoining(true);
      setError(null);
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("insecure");
        }
        const media = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: withVideo ? { width: 640, height: 480 } : false,
        });
        localRef.current = media;
        setLocalStream(media);
        setMicOn(true);
        setCamOn(withVideo);

        const { data: live } = await supabase
          .from("calls")
          .select("id")
          .eq("scope_type", scope)
          .eq("scope_id", scopeId)
          .is("ended_at", null)
          .order("created_at", { ascending: false })
          .limit(1);

        let id = live?.[0]?.id as string | undefined;
        if (!id) {
          const { data: made, error: mkErr } = await supabase
            .from("calls")
            .insert({ scope_type: scope, scope_id: scopeId, started_by: userId, video: withVideo })
            .select("id")
            .single();
          if (mkErr) throw mkErr;
          id = made!.id as string;
        }
        callRef.current = id;
        setCallId(id);

        const { error: joinErr } = await supabase
          .from("call_participants")
          .upsert(
            { call_id: id, user_id: userId, video: withVideo, left_at: null },
            { onConflict: "call_id,user_id" },
          );
        if (joinErr) throw joinErr;
        void qc.invalidateQueries({ queryKey: ["call", scope, scopeId] });
      } catch (e) {
        teardown();
        callRef.current = null;
        setCallId(null);
        const msg = (e as Error).message;
        setError(
          msg === "insecure"
            ? "Calls need a secure (https) connection."
            : msg.includes("Permission") || msg.includes("denied")
              ? "Allow microphone (and camera) access to call."
              : "Couldn't start the call on this device.",
        );
      } finally {
        setJoining(false);
      }
    },
    [scope, scopeId, userId, joining, qc, teardown],
  );

  /* ------------------------------------------------------- signalling loop */

  useEffect(() => {
    if (!callId || !userId) return;
    const me: string = userId;
    let stopped = false;

    async function tick() {
      const call = callRef.current;
      if (stopped || !call) return;

      // Who else is here? Connect to anyone new; the lower id makes the offer.
      const { data: parts } = await supabase
        .from("call_participants")
        .select("user_id")
        .eq("call_id", call);
      const others = (parts ?? []).map((p) => p.user_id as string).filter((id) => id !== me);
      for (const other of others) {
        if (peersRef.current.has(other)) continue;
        const box = peerFor(other);
        if (!box.polite) {
          const offer = await box.pc.createOffer();
          await box.pc.setLocalDescription(offer);
          await send(other, "offer", { sdp: offer.sdp, type: offer.type });
        }
      }
      for (const id of [...peersRef.current.keys()]) {
        if (!others.includes(id)) {
          peersRef.current.get(id)?.pc.close();
          peersRef.current.delete(id);
          publishPeers();
        }
      }

      // Anything addressed to me since last time?
      const { data: sigs } = await supabase
        .from("call_signals")
        .select("id, from_user, kind, payload")
        .eq("call_id", call)
        .eq("to_user", me)
        .gt("id", lastSignal.current)
        .order("id", { ascending: true })
        .limit(60);

      for (const s of sigs ?? []) {
        lastSignal.current = Math.max(lastSignal.current, Number(s.id));
        const from = s.from_user as string;
        const box = peerFor(from);
        const payload = s.payload as Record<string, unknown>;
        try {
          if (s.kind === "offer") {
            await box.pc.setRemoteDescription({
              type: "offer",
              sdp: String(payload["sdp"] ?? ""),
            });
            const answer = await box.pc.createAnswer();
            await box.pc.setLocalDescription(answer);
            await send(from, "answer", { sdp: answer.sdp, type: answer.type });
          } else if (s.kind === "answer") {
            if (box.pc.signalingState === "have-local-offer") {
              await box.pc.setRemoteDescription({
                type: "answer",
                sdp: String(payload["sdp"] ?? ""),
              });
            }
          } else if (s.kind === "ice") {
            await box.pc.addIceCandidate(payload as RTCIceCandidateInit);
          }
        } catch {
          /* a stale candidate or duplicate description — safe to ignore */
        }
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), 1200);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [callId, userId, peerFor, publishPeers, send]);

  /* Hang up cleanly if the tab goes away. */
  useEffect(() => {
    const bye = () => {
      const call = callRef.current;
      const me = meRef.current;
      if (call && me) {
        void supabase.from("call_participants").delete().eq("call_id", call).eq("user_id", me);
      }
    };
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      bye();
      teardown();
    };
  }, [teardown]);

  const toggleMic = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    const next = !tracks[0]?.enabled;
    for (const t of tracks) t.enabled = next;
    setMicOn(next);
  }, []);

  const toggleCam = useCallback(async () => {
    const stream = localRef.current;
    if (!stream) return;
    const existing = stream.getVideoTracks();
    if (existing.length) {
      const next = !existing[0]!.enabled;
      for (const t of existing) t.enabled = next;
      setCamOn(next);
      return;
    }
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      const track = cam.getVideoTracks()[0];
      if (!track) return;
      stream.addTrack(track);
      for (const [, box] of peersRef.current) box.pc.addTrack(track, stream);
      setCamOn(true);
      setLocalStream(stream);
    } catch {
      setError("Couldn't turn the camera on.");
    }
  }, []);

  const inCall = !!callId;

  return useMemo(
    () => ({
      inCall,
      callId,
      joining,
      error,
      peers,
      localStream,
      micOn,
      camOn,
      join,
      leave,
      toggleMic,
      toggleCam,
      clearError: () => setError(null),
    }),
    [
      inCall, callId, joining, error, peers, localStream, micOn, camOn,
      join, leave, toggleMic, toggleCam,
    ],
  );
}
