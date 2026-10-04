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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          brand_kit: Json
          compass: Json | null
          created_at: string
          id: string
          name: string
          slug: string
          voice_kit: Json | null
          workspace_id: string
        }
        Insert: {
          brand_kit: Json
          compass?: Json | null
          created_at?: string
          id?: string
          name: string
          slug: string
          voice_kit?: Json | null
          workspace_id: string
        }
        Update: {
          brand_kit?: Json
          compass?: Json | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          voice_kit?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          handle: string
          id: string
          platform: string
          status: string
          workspace_id: string
          zernio_account_id: string | null
        }
        Insert: {
          handle: string
          id?: string
          platform: string
          status?: string
          workspace_id: string
          zernio_account_id?: string | null
        }
        Update: {
          handle?: string
          id?: string
          platform?: string
          status?: string
          workspace_id?: string
          zernio_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      edges: {
        Row: {
          created_at: string
          created_by: string
          from_id: string
          from_kind: string
          id: string
          kind: string
          to_id: string
          to_kind: string
          weight: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          from_id: string
          from_kind: string
          id?: string
          kind: string
          to_id: string
          to_kind: string
          weight?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          from_id?: string
          from_kind?: string
          id?: string
          kind?: string
          to_id?: string
          to_kind?: string
          weight?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          chapters: Json
          created_at: string
          description: string | null
          flags: string[]
          id: string
          number: number | null
          recorded_at: string | null
          show_id: string
          state: string
          title: string | null
          workspace_id: string
        }
        Insert: {
          chapters?: Json
          created_at?: string
          description?: string | null
          flags?: string[]
          id?: string
          number?: number | null
          recorded_at?: string | null
          show_id: string
          state?: string
          title?: string | null
          workspace_id: string
        }
        Update: {
          chapters?: Json
          created_at?: string
          description?: string | null
          flags?: string[]
          id?: string
          number?: number | null
          recorded_at?: string | null
          show_id?: string
          state?: string
          title?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      holds: {
        Row: {
          anchor_id: string
          created_at: string
          id: string
          piece_id: string
          piece_kind: string
          workspace_id: string
        }
        Insert: {
          anchor_id: string
          created_at?: string
          id?: string
          piece_id: string
          piece_kind: string
          workspace_id: string
        }
        Update: {
          anchor_id?: string
          created_at?: string
          id?: string
          piece_id?: string
          piece_kind?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holds_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "time_anchors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holds_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          role: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          role: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          role?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          at: string
          from_status: string | null
          id: number
          job_id: string
          note: string | null
          to_status: string
          workspace_id: string
        }
        Insert: {
          at?: string
          from_status?: string | null
          id?: never
          job_id: string
          note?: string | null
          to_status: string
          workspace_id: string
        }
        Update: {
          at?: string
          from_status?: string | null
          id?: never
          job_id?: string
          note?: string | null
          to_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          cost_pence: number
          created_at: string
          episode_id: string
          error: string | null
          id: string
          input: Json
          input_hash: string
          lease_until: string | null
          output: Json | null
          run_after: string
          status: string
          step: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          cost_pence?: number
          created_at?: string
          episode_id: string
          error?: string | null
          id?: string
          input?: Json
          input_hash: string
          lease_until?: string | null
          output?: Json | null
          run_after?: string
          status?: string
          step: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          cost_pence?: number
          created_at?: string
          episode_id?: string
          error?: string | null
          id?: string
          input?: Json
          input_hash?: string
          lease_until?: string | null
          output?: Json | null
          run_after?: string
          status?: string
          step?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          bytes: number | null
          created_at: string
          duration_s: number | null
          episode_id: string | null
          id: string
          kind: string
          quick_fingerprint: string | null
          r2_key: string
          sha256: string | null
          workspace_id: string
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          duration_s?: number | null
          episode_id?: string | null
          id?: string
          kind: string
          quick_fingerprint?: string | null
          r2_key: string
          sha256?: string | null
          workspace_id: string
        }
        Update: {
          bytes?: number | null
          created_at?: string
          duration_s?: number | null
          episode_id?: string | null
          id?: string
          kind?: string
          quick_fingerprint?: string | null
          r2_key?: string
          sha256?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      moments: {
        Row: {
          embedding: string | null
          end_s: number
          episode_id: string
          id: string
          kind: string
          start_s: number
          text: string
          workspace_id: string
        }
        Insert: {
          embedding?: string | null
          end_s: number
          episode_id: string
          id?: string
          kind: string
          start_s: number
          text: string
          workspace_id: string
        }
        Update: {
          embedding?: string | null
          end_s?: number
          episode_id?: string
          id?: string
          kind?: string
          start_s?: number
          text?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moments_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          channel_id: string
          created_at: string
          episode_id: string
          id: string
          idempotency_key: string
          live_url: string | null
          platform: string
          scheduled_for: string
          status: string
          workspace_id: string
          zernio_post_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          episode_id: string
          id?: string
          idempotency_key: string
          live_url?: string | null
          platform: string
          scheduled_for: string
          status?: string
          workspace_id: string
          zernio_post_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          episode_id?: string
          id?: string
          idempotency_key?: string
          live_url?: string | null
          platform?: string
          scheduled_for?: string
          status?: string
          workspace_id?: string
          zernio_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      show_channels: {
        Row: {
          carries: string[]
          channel_id: string
          show_id: string
          workspace_id: string
        }
        Insert: {
          carries?: string[]
          channel_id: string
          show_id: string
          workspace_id: string
        }
        Update: {
          carries?: string[]
          channel_id?: string
          show_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_channels_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          approval_mode: string
          brand_id: string
          compass: Json | null
          created_at: string
          id: string
          kind: string
          name: string
          slots: Json
          slug: string
          theme: Json
          workspace_id: string
        }
        Insert: {
          approval_mode?: string
          brand_id: string
          compass?: Json | null
          created_at?: string
          id?: string
          kind: string
          name: string
          slots?: Json
          slug: string
          theme: Json
          workspace_id: string
        }
        Update: {
          approval_mode?: string
          brand_id?: string
          compass?: Json | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          slots?: Json
          slug?: string
          theme?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shows_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          brand_id: string | null
          id: string
          name: string
          slug: string
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          id?: string
          name: string
          slug: string
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          id?: string
          name?: string
          slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "themes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "themes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_anchors: {
        Row: {
          date: string
          id: string
          name: string
          recurrence: string
          scope: string
          workspace_id: string | null
        }
        Insert: {
          date: string
          id?: string
          name: string
          recurrence?: string
          scope: string
          workspace_id?: string | null
        }
        Update: {
          date?: string
          id?: string
          name?: string
          recurrence?: string
          scope?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_anchors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      start_ingest: { Args: { p_episode: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
