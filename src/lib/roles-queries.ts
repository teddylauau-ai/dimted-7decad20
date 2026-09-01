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
