/**
 * General chat — one big room every signed-in member shares. It replaces the
 * old Communities page and lives right under Direct Messages.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadVoiceClip } from "@/lib/dimted-actions";
import type { ChatMessage } from "@/lib/dimted-queries";

const AUTHOR_FIELDS =
  "id, display_name, username, last_active_at, activity_context, equipped_nametag, equipped_badge, equipped_frame, equipped_effect, avatar_url";

export function useGeneralMessages(enabled: boolean) {
  return useQuery({
    queryKey: ["general-messages"],
    enabled,
    refetchInterval: 4000,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("general_messages")
        .select(
          `id, body, audio_url, audio_ms, image_url, edited_at, reply_to_id, created_at, author:profiles!general_messages_user_id_fkey (${AUTHOR_FIELDS})`,
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ChatMessage[];
    },
  });
}

export async function sendGeneralMessage(
  userId: string,
  body: string,
  replyToId?: string | null,
) {
  const { error } = await supabase
    .from("general_messages")
    .insert({ user_id: userId, body, reply_to_id: replyToId ?? null });
  if (error) throw error;
}

export async function sendGeneralVoiceMessage(userId: string, blob: Blob, durationMs: number) {
  const audio_url = await uploadVoiceClip(userId, blob);
  const { error } = await supabase.from("general_messages").insert({
    user_id: userId,
    body: "\u{1F3A4} Voice message",
    audio_url,
    audio_ms: Math.round(durationMs),
  });
  if (error) throw error;
}

export async function sendGeneralImageMessage(userId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be under 10MB");
  const ext =
    (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/chat-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("chat-images")
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: true });
  if (upErr) throw upErr;
  const { data, error: urlErr } = await supabase.storage
    .from("chat-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (urlErr || !data?.signedUrl) throw urlErr ?? new Error("Couldn't publish that image");
  const { error } = await supabase.from("general_messages").insert({
    user_id: userId,
    body: "\u{1F5BC} Image",
    image_url: data.signedUrl,
  });
  if (error) throw error;
}

export async function editGeneralMessage(id: string, body: string) {
  const { error } = await supabase
    .from("general_messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteGeneralMessage(id: string) {
  const { error } = await supabase.from("general_messages").delete().eq("id", id);
  if (error) throw error;
}
