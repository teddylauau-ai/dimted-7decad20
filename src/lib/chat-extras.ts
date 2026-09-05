import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Chat extras: image messages, message editing, and one pinned message per
 * conversation/channel. Mirrors the voice-message pattern — files live in the
 * private `chat-images` bucket under the sender's folder and messages carry a
 * long-lived signed URL.
 */

export type PinScope = "dm" | "community";

/* ------------------------------------------------------------------- images */

async function uploadChatImage(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be under 10MB");
  const ext =
    (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/chat-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("chat-images")
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: true });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage
    .from("chat-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Couldn't read that image back");
  return data.signedUrl;
}

export async function sendDirectImageMessage(
  friendshipId: string,
  senderId: string,
  file: File,
  caption: string,
) {
  const image_url = await uploadChatImage(senderId, file);
  const { error } = await supabase.from("messages").insert({
    friendship_id: friendshipId,
    sender_id: senderId,
    body: caption.trim() || "\u{1F5BC} Image",
    image_url,
  });
  if (error) throw error;
}

export async function postChannelImageMessage(
  communityId: string,
  channelId: string,
  userId: string,
  file: File,
  caption: string,
) {
  const image_url = await uploadChatImage(userId, file);
  const { error } = await supabase.from("community_messages").insert({
    community_id: communityId,
    channel_id: channelId,
    user_id: userId,
    body: caption.trim() || "\u{1F5BC} Image",
    image_url,
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ editing */

export async function editDirectMessage(id: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function editCommunityMessage(id: string, body: string) {
  const { error } = await supabase
    .from("community_messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------- pins */

export type PinnedMessage = {
  id: string;
  scope_type: PinScope;
  scope_id: string;
  dm_message_id: string | null;
  community_message_id: string | null;
  pinned_by: string;
  created_at: string;
};

export function pinnedMessageId(pin: PinnedMessage | null | undefined): string | null {
  if (!pin) return null;
  return pin.scope_type === "dm" ? pin.dm_message_id : pin.community_message_id;
}

export function usePinnedMessage(scope: PinScope, scopeId: string | null | undefined) {
  return useQuery({
    queryKey: ["pin", scope, scopeId],
    enabled: !!scopeId,
    refetchInterval: 8000,
    queryFn: async (): Promise<PinnedMessage | null> => {
      const { data, error } = await supabase
        .from("pinned_messages")
        .select("*")
        .eq("scope_type", scope)
        .eq("scope_id", scopeId!)
        .maybeSingle();
      if (error) throw error;
      return (data as PinnedMessage | null) ?? null;
    },
  });
}

export function usePinMessage(scope: PinScope, scopeId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      userId,
    }: {
      messageId: string;
      userId: string;
    }) => {
      if (!scopeId) throw new Error("No conversation open");
      const row = {
        scope_type: scope,
        scope_id: scopeId,
        pinned_by: userId,
        dm_message_id: scope === "dm" ? messageId : null,
        community_message_id: scope === "community" ? messageId : null,
      };
      const { error } = await supabase
        .from("pinned_messages")
        .upsert(row, { onConflict: "scope_type,scope_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pin", scope, scopeId] }),
  });
}

export function useUnpinMessage(scope: PinScope, scopeId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!scopeId) return;
      const { error } = await supabase
        .from("pinned_messages")
        .delete()
        .eq("scope_type", scope)
        .eq("scope_id", scopeId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pin", scope, scopeId] }),
  });
}

/* ----------------------------------------------------------------- showcase */

/** Pin/unpin a cosmetic to your profile showcase (max 3). Server column is a simple text array. */
export async function toggleShowcase(userId: string, slug: string, current: string[]) {
  const has = current.includes(slug);
  const next = has ? current.filter((s) => s !== slug) : [...current, slug].slice(-3);
  const { error } = await supabase.from("profiles").update({ showcase: next }).eq("id", userId);
  if (error) throw error;
  return next;
}
