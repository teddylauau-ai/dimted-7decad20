import { supabase } from "@/integrations/supabase/client";

export type WidgetType =
  | "rank"
  | "stats"
  | "spotify"
  | "achievements"
  | "showcase"
  | "friends"
  | "pulse"
  | "bio";

export type ProfileWidget = {
  id: string;
  user_id: string;
  widget_type: WidgetType;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  config: Record<string, unknown>;
};

export const WIDGET_LABELS: Record<WidgetType, string> = {
  rank: "Rank & Level",
  stats: "Stats",
  spotify: "Spotify Picks",
  achievements: "Achievements",
  showcase: "Showcase",
  friends: "Friend Streaks",
  pulse: "Pulse Rush",
  bio: "Bio Card",
};

export const DEFAULT_WIDGETS: Omit<ProfileWidget, "id" | "user_id">[] = [
  { widget_type: "rank", position_x: 0, position_y: 0, width: 2, height: 1, config: {} },
  { widget_type: "stats", position_x: 0, position_y: 1, width: 1, height: 1, config: {} },
  { widget_type: "showcase", position_x: 1, position_y: 1, width: 1, height: 1, config: {} },
  { widget_type: "bio", position_x: 0, position_y: 2, width: 2, height: 1, config: {} },
  { widget_type: "achievements", position_x: 0, position_y: 3, width: 2, height: 1, config: {} },
];

export async function fetchProfileWidgets(userId: string | undefined): Promise<ProfileWidget[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("profile_widgets")
    .select("id, user_id, widget_type, position_x, position_y, width, height, config")
    .eq("user_id", userId)
    .order("position_y", { ascending: true })
    .order("position_x", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProfileWidget[];
}

export async function saveProfileWidgets(widgets: Omit<ProfileWidget, "id" | "user_id">[]) {
  const { data, error } = await supabase.rpc("save_profile_widgets", {
    _widgets: widgets as unknown as Record<string, unknown>,
  });
  if (error) throw error;
  return (data ?? { ok: false }) as { ok: boolean; error?: string };
}

export async function resetProfileWidgets() {
  const { data, error } = await supabase.rpc("reset_profile_widgets");
  if (error) throw error;
  return (data ?? { ok: false }) as { ok: boolean; error?: string };
}

export function normalizeLayout(widgets: ProfileWidget[]): ProfileWidget[] {
  const seen = new Set<string>();
  const out: ProfileWidget[] = [];
  for (const w of widgets) {
    const key = `${w.position_x}-${w.position_y}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(w);
    }
  }
  return out;
}
