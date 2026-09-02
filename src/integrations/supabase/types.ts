export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      channels: {
        Row: {
          community_id: string
          created_at: string
          id: string
          name: string
          position: number
          topic: string | null
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          topic?: string | null
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          tagline: string | null
          total_xp: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          tagline?: string | null
          total_xp?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          tagline?: string | null
          total_xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "communities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          body: string
          channel_id: string
          community_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          channel_id: string
          community_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          channel_id?: string
          community_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmetics: {
        Row: {
          created_at: string
          description: string
          featured: boolean
          name: string
          price_sparks: number
          rarity: string
          required_level: number
          slot: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string
          featured?: boolean
          name: string
          price_sparks?: number
          rarity: string
          required_level?: number
          slot: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string
          featured?: boolean
          name?: string
          price_sparks?: number
          rarity?: string
          required_level?: number
          slot?: string
          slug?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friendship_xp: number
          id: string
          last_exchange_at: string | null
          requester_id: string
          status: string
          streak: number
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          friendship_xp?: number
          id?: string
          last_exchange_at?: string | null
          requester_id: string
          status?: string
          streak?: number
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          friendship_xp?: number
          id?: string
          last_exchange_at?: string | null
          requester_id?: string
          status?: string
          streak?: number
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_progress: {
        Row: {
          best_ms: number | null
          created_at: string
          game: string
          id: string
          level: number
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_ms?: number | null
          created_at?: string
          game: string
          id?: string
          level?: number
          stars?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_ms?: number | null
          created_at?: string
          game?: string
          id?: string
          level?: number
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_scores: {
        Row: {
          created_at: string
          detail: Json
          game: string
          id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          game: string
          id?: string
          score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          game?: string
          id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          acquired_at: string
          cosmetic_slug: string
          id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          cosmetic_slug: string
          id?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          cosmetic_slug?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_cosmetic_slug_fkey"
            columns: ["cosmetic_slug"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          friendship_id: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          friendship_id: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          friendship_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_friendship_id_fkey"
            columns: ["friendship_id"]
            isOneToOne: false
            referencedRelation: "friendships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned_until: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          energy: number
          equipped_badge: string | null
          equipped_banner: string | null
          equipped_effect: string | null
          equipped_frame: string | null
          equipped_nametag: string | null
          id: string
          last_active_at: string
          mute_reason: string | null
          muted_until: string | null
          realm_name: string
          sanctioned_by: string | null
          sparks: number
          streak: number
          surge_until: string | null
          title: string
          total_xp: number
          username: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_until?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          energy?: number
          equipped_badge?: string | null
          equipped_banner?: string | null
          equipped_effect?: string | null
          equipped_frame?: string | null
          equipped_nametag?: string | null
          id: string
          last_active_at?: string
          mute_reason?: string | null
          muted_until?: string | null
          realm_name?: string
          sanctioned_by?: string | null
          sparks?: number
          streak?: number
          surge_until?: string | null
          title?: string
          total_xp?: number
          username: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_until?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          energy?: number
          equipped_badge?: string | null
          equipped_banner?: string | null
          equipped_effect?: string | null
          equipped_frame?: string | null
          equipped_nametag?: string | null
          id?: string
          last_active_at?: string
          mute_reason?: string | null
          muted_until?: string | null
          realm_name?: string
          sanctioned_by?: string | null
          sparks?: number
          streak?: number
          surge_until?: string | null
          title?: string
          total_xp?: number
          username?: string
        }
        Relationships: []
      }
      staff_actions: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: string
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_actions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_progress: {
        Row: {
          attempts: number
          best_percent: number
          created_at: string
          deck: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          best_percent?: number
          created_at?: string
          deck: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          best_percent?: number
          created_at?: string
          deck?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      titles: {
        Row: {
          created_at: string
          label: string
          slug: string
          tier: number
        }
        Insert: {
          created_at?: string
          label: string
          slug: string
          tier?: number
        }
        Update: {
          created_at?: string
          label?: string
          slug?: string
          tier?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          label: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          label?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          label?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_ban: {
        Args: { _minutes: number; _reason?: string; _user_id: string }
        Returns: Json
      }
      award_arcade_xp: {
        Args: { _game: string; _score: number }
        Returns: Json
      }
      award_xp: { Args: { _label?: string; _source: string }; Returns: Json }
      equip_cosmetic: { Args: { _slot: string; _slug: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ignite_surge: { Args: never; Returns: Json }
      is_banned: { Args: { _user_id: string }; Returns: boolean }
      is_community_member: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      is_friendship_member: {
        Args: { _friendship_id: string; _user_id: string }
        Returns: boolean
      }
      is_muted: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mod_delete_message: { Args: { _message_id: string }; Returns: Json }
      mod_set_mute: {
        Args: { _minutes: number; _reason?: string; _user_id: string }
        Returns: Json
      }
      my_rank: { Args: never; Returns: number }
      owner_edit_profile: {
        Args: { _patch: Json; _user_id: string }
        Returns: Json
      }
      owner_set_title: {
        Args: { _title: string; _user_id: string }
        Returns: Json
      }
      purchase_cosmetic: { Args: { _slug: string }; Returns: Json }
      role_rank: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      staff_grant_cosmetic: {
        Args: { _slug: string; _user_id: string }
        Returns: Json
      }
      staff_grant_currency: {
        Args: { _sparks?: number; _user_id: string; _xp?: number }
        Returns: Json
      }
      staff_ignite_surge_for: {
        Args: { _minutes?: number; _user_id: string }
        Returns: Json
      }
      top_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "moderator" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "moderator", "member"],
    },
  },
} as const
