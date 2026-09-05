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
      call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string
          left_at: string | null
          user_id: string
          video: boolean
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id: string
          video?: boolean
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
          video?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          from_user: string
          id: number
          kind: string
          payload: Json
          to_user: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          from_user: string
          id?: number
          kind: string
          payload?: Json
          to_user?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          from_user?: string
          id?: number
          kind?: string
          payload?: Json
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          scope_id: string
          scope_type: string
          started_by: string
          video: boolean
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          scope_id: string
          scope_type: string
          started_by: string
          video?: boolean
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          scope_id?: string
          scope_type?: string
          started_by?: string
          video?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calls_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          tagline?: string | null
          total_xp?: number
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          tagline?: string | null
          total_xp?: number
          visibility?: string
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
      community_invites: {
        Row: {
          community_id: string
          created_at: string
          id: string
          invited_by: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_invites_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invites_user_id_fkey"
            columns: ["user_id"]
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
          audio_ms: number | null
          audio_url: string | null
          body: string
          channel_id: string
          community_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          audio_ms?: number | null
          audio_url?: string | null
          body: string
          channel_id: string
          community_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          audio_ms?: number | null
          audio_url?: string | null
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
          available_until: string | null
          created_at: string
          description: string
          featured: boolean
          name: string
          pool: string
          price_sparks: number
          rarity: string
          required_level: number
          slot: string
          slug: string
        }
        Insert: {
          available_until?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          name: string
          pool?: string
          price_sparks?: number
          rarity: string
          required_level?: number
          slot: string
          slug: string
        }
        Update: {
          available_until?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          name?: string
          pool?: string
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
          attempts: number
          best_ms: number | null
          best_pct: number
          coins: number
          created_at: string
          game: string
          id: string
          level: number
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          best_ms?: number | null
          best_pct?: number
          coins?: number
          created_at?: string
          game: string
          id?: string
          level?: number
          stars?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          best_ms?: number | null
          best_pct?: number
          coins?: number
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
      game_unlocks: {
        Row: {
          created_at: string
          game: string
          id: string
          slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game: string
          id?: string
          slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          game?: string
          id?: string
          slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_unlocks_user_id_fkey"
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
      message_reactions: {
        Row: {
          community_message_id: string | null
          created_at: string
          dm_message_id: string | null
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          community_message_id?: string | null
          created_at?: string
          dm_message_id?: string | null
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          community_message_id?: string | null
          created_at?: string
          dm_message_id?: string | null
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_community_message_id_fkey"
            columns: ["community_message_id"]
            isOneToOne: false
            referencedRelation: "community_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_dm_message_id_fkey"
            columns: ["dm_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_ms: number | null
          audio_url: string | null
          body: string
          created_at: string
          friendship_id: string
          id: string
          sender_id: string
        }
        Insert: {
          audio_ms?: number | null
          audio_url?: string | null
          body: string
          created_at?: string
          friendship_id: string
          id?: string
          sender_id: string
        }
        Update: {
          audio_ms?: number | null
          audio_url?: string | null
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
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_context: string | null
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
          sanctioned_by: string | null
          sparks: number
          streak: number
          surge_until: string | null
          title: string
          total_xp: number
          username: string
        }
        Insert: {
          activity_context?: string | null
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
          sanctioned_by?: string | null
          sparks?: number
          streak?: number
          surge_until?: string | null
          title?: string
          total_xp?: number
          username: string
        }
        Update: {
          activity_context?: string | null
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
      pulse_items: {
        Row: {
          created_at: string
          description: string
          feat: string | null
          kind: string
          name: string
          price_coins: number
          rarity: string
          required_level: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string
          feat?: string | null
          kind: string
          name: string
          price_coins?: number
          rarity?: string
          required_level?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string
          feat?: string | null
          kind?: string
          name?: string
          price_coins?: number
          rarity?: string
          required_level?: number
          slug?: string
        }
        Relationships: []
      }
      pulse_state: {
        Row: {
          coins: number
          created_at: string
          equipped_ball: string
          equipped_colors: string
          equipped_death: string
          equipped_icon: string
          equipped_ship: string
          equipped_trail: string
          equipped_wave: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          created_at?: string
          equipped_ball?: string
          equipped_colors?: string
          equipped_death?: string
          equipped_icon?: string
          equipped_ship?: string
          equipped_trail?: string
          equipped_wave?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          equipped_ball?: string
          equipped_colors?: string
          equipped_death?: string
          equipped_icon?: string
          equipped_ship?: string
          equipped_trail?: string
          equipped_wave?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_claims: {
        Row: {
          created_at: string
          id: string
          period_key: string
          quest_slug: string
          reward_sparks: number
          reward_xp: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_key: string
          quest_slug: string
          reward_sparks?: number
          reward_xp?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_key?: string
          quest_slug?: string
          reward_sparks?: number
          reward_xp?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_claims_quest_slug_fkey"
            columns: ["quest_slug"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "quest_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          cadence: string
          created_at: string
          goal: number
          rarity: string
          reward_sparks: number
          reward_xp: number
          slug: string
          source: string
          title: string
        }
        Insert: {
          cadence: string
          created_at?: string
          goal?: number
          rarity?: string
          reward_sparks?: number
          reward_xp?: number
          slug: string
          source: string
          title: string
        }
        Update: {
          cadence?: string
          created_at?: string
          goal?: number
          rarity?: string
          reward_sparks?: number
          reward_xp?: number
          slug?: string
          source?: string
          title?: string
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
      typing_signals: {
        Row: {
          scope_id: string
          scope_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          scope_id: string
          scope_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          scope_id?: string
          scope_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      vanguard_items: {
        Row: {
          created_at: string
          description: string
          kind: string
          name: string
          price_cores: number
          rarity: string
          required_level: number
          slug: string
        }
        Insert: {
          created_at?: string
          description: string
          kind: string
          name: string
          price_cores?: number
          rarity?: string
          required_level?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string
          kind?: string
          name?: string
          price_cores?: number
          rarity?: string
          required_level?: number
          slug?: string
        }
        Relationships: []
      }
      vanguard_state: {
        Row: {
          cores: number
          created_at: string
          equipped_gear: string | null
          equipped_weapon: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cores?: number
          created_at?: string
          equipped_gear?: string | null
          equipped_weapon?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cores?: number
          created_at?: string
          equipped_gear?: string | null
          equipped_weapon?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vanguard_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      can_join_community: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      can_see_community: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      can_use_call: {
        Args: { _call_id: string; _user_id: string }
        Returns: boolean
      }
      can_use_call_scope: {
        Args: { _scope_id: string; _scope_type: string; _user_id: string }
        Returns: boolean
      }
      claim_armory_milestone: { Args: { _slug: string }; Returns: Json }
      claim_quest: { Args: { _slug: string }; Returns: Json }
      clear_typing: {
        Args: { _scope_id: string; _scope_type: string }
        Returns: undefined
      }
      equip_cosmetic: { Args: { _slot: string; _slug: string }; Returns: Json }
      grant_admin_cosmetics: { Args: { _user_id: string }; Returns: undefined }
      grant_founder_cosmetics: {
        Args: { _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ignite_surge: { Args: never; Returns: Json }
      is_banned: { Args: { _user_id: string }; Returns: boolean }
      is_community_manager: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
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
      level_from_xp: { Args: { _xp: number }; Returns: number }
      mod_delete_dm: { Args: { _message_id: string }; Returns: Json }
      mod_delete_message: { Args: { _message_id: string }; Returns: Json }
      mod_set_mute: {
        Args: { _minutes: number; _reason?: string; _user_id: string }
        Returns: Json
      }
      my_rank: { Args: never; Returns: number }
      owner_delete_account: { Args: { _user_id: string }; Returns: Json }
      owner_delete_community: { Args: { _community_id: string }; Returns: Json }
      owner_edit_profile: {
        Args: { _patch: Json; _user_id: string }
        Returns: Json
      }
      owner_set_title: {
        Args: { _title: string; _user_id: string }
        Returns: Json
      }
      pulse_account_level: { Args: { _user_id: string }; Returns: number }
      pulse_equip: { Args: { _slot: string; _slug: string }; Returns: Json }
      pulse_finish: {
        Args: {
          _coins: number
          _daily?: boolean
          _level: number
          _pct: number
          _practice?: boolean
          _time_ms: number
        }
        Returns: Json
      }
      pulse_state_for_me: {
        Args: never
        Returns: {
          coins: number
          created_at: string
          equipped_ball: string
          equipped_colors: string
          equipped_death: string
          equipped_icon: string
          equipped_ship: string
          equipped_trail: string
          equipped_wave: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "pulse_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pulse_unlock: { Args: { _slug: string }; Returns: Json }
      purchase_cosmetic: { Args: { _slug: string }; Returns: Json }
      role_rank: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      staff_complete_pulse: {
        Args: { _levels?: number; _user_id: string }
        Returns: Json
      }
      staff_grant_cosmetic: {
        Args: { _slug: string; _user_id: string }
        Returns: Json
      }
      staff_grant_currency: {
        Args: { _sparks?: number; _user_id: string; _xp?: number }
        Returns: Json
      }
      staff_grant_pulse: {
        Args: { _coins?: number; _slug?: string; _user_id: string }
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
      touch_presence: { Args: { _context?: string }; Returns: undefined }
      touch_typing: {
        Args: { _scope_id: string; _scope_type: string }
        Returns: undefined
      }
      vanguard_equip: {
        Args: { _gear: string; _weapon: string }
        Returns: Json
      }
      vanguard_finish: {
        Args: {
          _cores: number
          _level: number
          _stars: number
          _time_ms: number
        }
        Returns: Json
      }
      vanguard_state_for_me: {
        Args: never
        Returns: {
          cores: number
          created_at: string
          equipped_gear: string | null
          equipped_weapon: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vanguard_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vanguard_unlock: { Args: { _slug: string }; Returns: Json }
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
