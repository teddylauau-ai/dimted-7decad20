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
