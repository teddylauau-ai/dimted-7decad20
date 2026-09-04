import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "moderator" | "member";

export const ROLE_ORDER: AppRole[] = ["owner", "admin", "moderator", "member"];

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  member: "Member",
};

export type RoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  profile: { id: string; username: string; display_name: string } | null;
};

/** Every role grant in Dimted, with the account it belongs to. */
export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Omit<RoleRow, "profile">[];
      if (rows.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", rows.map((r) => r.user_id));

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
    },
  });
}

/** The highest role the signed-in account holds. */
export function useMyRole(userId: string | undefined) {
  const roles = useRoles();
  const mine = (roles.data ?? []).filter((r) => r.user_id === userId).map((r) => r.role);
  const highest = ROLE_ORDER.find((r) => mine.includes(r));
  return {
    role: (highest ?? "member") as AppRole,
    isOwner: mine.includes("owner"),
    isStaff: mine.includes("owner") || mine.includes("admin"),
    isModerator: mine.includes("owner") || mine.includes("admin") || mine.includes("moderator"),
    loading: roles.isLoading,
  };
}

export function useGrantRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useRevokeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roles"] }),
  });
}

// ---------------------------------------------------------------------------
// Staff powers. Every one of these calls a database function that re-checks the
// caller's rank server-side, so the UI can be permissive without being unsafe.
// ---------------------------------------------------------------------------

export const ROLE_RANK: Record<AppRole, number> = {
  owner: 40,
  admin: 30,
  moderator: 20,
  member: 10,
};

export type TitleRow = { slug: string; label: string; tier: number };

/** The title ladder — higher tier, better name under someone's handle. */
export function useTitles() {
  return useQuery({
    queryKey: ["titles"],
    queryFn: async (): Promise<TitleRow[]> => {
      const { data, error } = await supabase
        .from("titles")
        .select("slug, label, tier")
        .order("tier", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TitleRow[];
    },
  });
}

function useStaffMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}

type RpcResult = { status: string } & Record<string, unknown>;

function unwrap(data: unknown): RpcResult {
  const result = (data ?? { status: "unknown" }) as RpcResult;
  if (result.status === "forbidden") throw new Error("forbidden");
  if (result.status === "no_target") throw new Error("no_target");
  if (result.status === "unknown_item") throw new Error("unknown_item");
  return result;
}

/** Owner (uncapped) or admin (capped) hands out XP and sparks. */
export function useGrantCurrency() {
  return useStaffMutation(async ({ userId, xp, sparks }: { userId: string; xp: number; sparks: number }) => {
    const { data, error } = await supabase.rpc("staff_grant_currency", {
      _user_id: userId,
      _xp: xp,
      _sparks: sparks,
    });
    if (error) throw error;
    return unwrap(data);
  });
}

/** Unlock one cosmetic — or pass "*" (owner only) to unlock the whole catalogue. */
export function useGrantCosmetic() {
  return useStaffMutation(async ({ userId, slug }: { userId: string; slug: string }) => {
    const { data, error } = await supabase.rpc("staff_grant_cosmetic", { _user_id: userId, _slug: slug });
    if (error) throw error;
    return unwrap(data);
  });
}

/** Pulse Rush grants: coins, one locker item, or "*" for the whole locker (owner only). */
export function useGrantPulse() {
  return useStaffMutation(
    async ({ userId, slug, coins }: { userId: string; slug?: string; coins?: number }) => {
      const args: { _user_id: string; _coins: number; _slug?: string } = {
        _user_id: userId,
        _coins: coins ?? 0,
      };
      if (slug) args._slug = slug;
      const { data, error } = await supabase.rpc("staff_grant_pulse", args);
      if (error) throw error;
      return unwrap(data);
    },
  );
}

/** Owner-only: mark every Pulse Rush level cleared with all secret coins. */
export function useCompletePulse() {
  return useStaffMutation(async ({ userId, levels }: { userId: string; levels?: number }) => {
    const { data, error } = await supabase.rpc("staff_complete_pulse", {
      _user_id: userId,
      _levels: levels ?? 15,
    });
    if (error) throw error;
    return unwrap(data);
  });
}

/** Owner-only: set the title that sits under someone's name. */
export function useSetTitle() {
  return useStaffMutation(async ({ userId, title }: { userId: string; title: string }) => {
    const { data, error } = await supabase.rpc("owner_set_title", { _user_id: userId, _title: title });
    if (error) throw error;
    return unwrap(data);
  });
}

/** Force a surge (double XP window) on any account. */
export function useForceSurge() {
  return useStaffMutation(async ({ userId, minutes }: { userId: string; minutes: number }) => {
    const { data, error } = await supabase.rpc("staff_ignite_surge_for", {
      _user_id: userId,
      _minutes: minutes,
    });
    if (error) throw error;
    return unwrap(data);
  });
}

export type StaffAction = {
  id: string;
  actor_id: string;
  target_id: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
};

/** Audit trail of every staff grant. */
export function useStaffLog() {
  return useQuery({
    queryKey: ["staff-actions"],
    queryFn: async (): Promise<StaffAction[]> => {
      const { data, error } = await supabase
        .from("staff_actions")
        .select("id, actor_id, target_id, action, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as StaffAction[];
    },
  });
}

// ---------------------------------------------------------------------------
// Sanctions + owner edits.
// ---------------------------------------------------------------------------

export type StaffAccount = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  title: string;
  total_xp: number;
  sparks: number;
  energy: number;
  streak: number;
  avatar_url: string | null;
  equipped_nametag: string | null;
  equipped_badge: string | null;
  equipped_frame: string | null;
  equipped_banner: string | null;
  equipped_effect: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  muted_until: string | null;
  mute_reason: string | null;
  created_at: string;
};

/** Every real signed-up account, with moderation state. Staff view only. */
export function useAllAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ["staff-accounts"],
    enabled,
    queryFn: async (): Promise<StaffAccount[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, bio, title, total_xp, sparks, energy, streak, avatar_url, equipped_nametag, equipped_badge, equipped_frame, equipped_banner, equipped_effect, banned_until, ban_reason, muted_until, mute_reason, created_at",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StaffAccount[];
    },
  });
}

/** Admin+ : ban (minutes), unban (0) or permanent ban (-1). */
export function useSetBan() {
  return useStaffMutation(
    async ({ userId, minutes, reason }: { userId: string; minutes: number; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_set_ban", {
        _user_id: userId,
        _minutes: minutes,
        ...(reason ? { _reason: reason } : {}),
      });
      if (error) throw error;
      return unwrap(data);
    },
  );
}

/** Moderator+ : mute (minutes, capped at 24h for moderators) or unmute (0). */
export function useSetMute() {
  return useStaffMutation(
    async ({ userId, minutes, reason }: { userId: string; minutes: number; reason?: string }) => {
      const { data, error } = await supabase.rpc("mod_set_mute", {
        _user_id: userId,
        _minutes: minutes,
        ...(reason ? { _reason: reason } : {}),
      });
      if (error) throw error;
      return unwrap(data);
    },
  );
}

export type ProfilePatch = Partial<{
  display_name: string;
  username: string;
  bio: string;
  title: string;
  avatar_url: string;
  total_xp: number;
  sparks: number;
  energy: number;
  streak: number;
  equipped_nametag: string;
  equipped_badge: string;
  equipped_frame: string;
  equipped_banner: string;
  equipped_effect: string;
}>;

/** Owner-only: rewrite any field on any account. */
export function useEditProfile() {
  return useStaffMutation(async ({ userId, patch }: { userId: string; patch: ProfilePatch }) => {
    const { data, error } = await supabase.rpc("owner_edit_profile", {
      _user_id: userId,
      _patch: patch as never,
    });
    if (error) throw error;
    return unwrap(data);
  });
}

/** What each rank is allowed to do — shown in the panel and mirrored in the database. */
export const ROLE_POWERS: Record<AppRole, string[]> = {
  owner: [
    "Edit any account's every field at will",
    "Grant and revoke admin, moderator and member",
    "Hand out titles, uncapped XP and sparks",
    "Unlock the entire cosmetic collection",
    "Permanent bans and unlimited mutes",
  ],
  admin: [
    "Ban and unban members and moderators",
    "Mute anyone below them, any duration",
    "Grant XP and sparks (±25,000 per grant)",
    "Unlock individual cosmetics, force surges",
    "Grant moderator, delete arcade scores",
  ],
  moderator: ["Mute members for up to 24 hours", "Remove community messages", "Read the staff audit log"],
  member: ["Play, chat and progress — no staff powers"],
};
