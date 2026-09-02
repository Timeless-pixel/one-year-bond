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
      account_limits: {
        Row: {
          created_at: string
          daily_message_limit: number
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_message_limit?: number
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_message_limit?: number
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bond_people: {
        Row: {
          character_id: string
          created_at: string
          emotional_note: string | null
          id: string
          last_mentioned_at: string
          mentions: number
          name: string
          name_key: string
          notes: Json
          relation: string | null
          salience: number
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          emotional_note?: string | null
          id?: string
          last_mentioned_at?: string
          mentions?: number
          name: string
          name_key: string
          notes?: Json
          relation?: string | null
          salience?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          emotional_note?: string | null
          id?: string
          last_mentioned_at?: string
          mentions?: number
          name?: string
          name_key?: string
          notes?: Json
          relation?: string | null
          salience?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bond_people_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          age: string | null
          appearance: Json | null
          archived_at: string | null
          autonomy: string
          avatar_url: string | null
          backstory: string | null
          communication_style: string | null
          created_at: string
          daily_events_enabled: boolean
          emotion_state: Json
          emotion_updated_at: string
          expression: string
          farewell_message: string | null
          gender: string | null
          goals: string | null
          growth_notes: Json
          id: string
          interests: Json | null
          journey_end_date: string
          journey_start_date: string
          last_active_at: string
          living_moments_enabled: boolean
          location: string | null
          love_language: string | null
          mood: string | null
          name: string
          occupation: string | null
          personality: Json | null
          pronouns: string | null
          recent_phrases: Json
          relationship_score: number
          relationship_stage: string | null
          relationship_type: string
          settings: Json
          status: string
          style: string
          surprises_enabled: boolean
          trust: number
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: string | null
          appearance?: Json | null
          archived_at?: string | null
          autonomy?: string
          avatar_url?: string | null
          backstory?: string | null
          communication_style?: string | null
          created_at?: string
          daily_events_enabled?: boolean
          emotion_state?: Json
          emotion_updated_at?: string
          expression?: string
          farewell_message?: string | null
          gender?: string | null
          goals?: string | null
          growth_notes?: Json
          id?: string
          interests?: Json | null
          journey_end_date?: string
          journey_start_date?: string
          last_active_at?: string
          living_moments_enabled?: boolean
          location?: string | null
          love_language?: string | null
          mood?: string | null
          name: string
          occupation?: string | null
          personality?: Json | null
          pronouns?: string | null
          recent_phrases?: Json
          relationship_score?: number
          relationship_stage?: string | null
          relationship_type?: string
          settings?: Json
          status?: string
          style: string
          surprises_enabled?: boolean
          trust?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: string | null
          appearance?: Json | null
          archived_at?: string | null
          autonomy?: string
          avatar_url?: string | null
          backstory?: string | null
          communication_style?: string | null
          created_at?: string
          daily_events_enabled?: boolean
          emotion_state?: Json
          emotion_updated_at?: string
          expression?: string
          farewell_message?: string | null
          gender?: string | null
          goals?: string | null
          growth_notes?: Json
          id?: string
          interests?: Json | null
          journey_end_date?: string
          journey_start_date?: string
          last_active_at?: string
          living_moments_enabled?: boolean
          location?: string | null
          love_language?: string | null
          mood?: string | null
          name?: string
          occupation?: string | null
          personality?: Json | null
          pronouns?: string | null
          recent_phrases?: Json
          relationship_score?: number
          relationship_stage?: string | null
          relationship_type?: string
          settings?: Json
          status?: string
          style?: string
          surprises_enabled?: boolean
          trust?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_summaries: {
        Row: {
          character_id: string
          created_at: string
          id: string
          message_count_at: number
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          message_count_at?: number
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          message_count_at?: number
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      image_generations: {
        Row: {
          character_id: string | null
          created_at: string
          error_message: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_generations_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      keepsakes: {
        Row: {
          character_id: string
          created_at: string
          day: number
          icon: string
          id: string
          note: string | null
          story_event_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          day?: number
          icon?: string
          id?: string
          note?: string | null
          story_event_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          day?: number
          icon?: string
          id?: string
          note?: string | null
          story_event_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keepsakes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keepsakes_story_event_id_fkey"
            columns: ["story_event_id"]
            isOneToOne: false
            referencedRelation: "story_events"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          body: string
          character_id: string
          created_at: string
          day: number
          id: string
          occasion: string
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          character_id: string
          created_at?: string
          day?: number
          id?: string
          occasion?: string
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          character_id?: string
          created_at?: string
          day?: number
          id?: string
          occasion?: string
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "letters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      living_moments: {
        Row: {
          character_id: string
          content: string
          created_at: string
          day: number
          id: string
          kind: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          content: string
          created_at?: string
          day?: number
          id?: string
          kind?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          day?: number
          id?: string
          kind?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "living_moments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          category: string
          character_id: string
          content: string
          created_at: string
          id: string
          importance: number
          last_used_at: string | null
          person_key: string | null
          pinned: boolean
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          character_id: string
          content: string
          created_at?: string
          id?: string
          importance?: number
          last_used_at?: string | null
          person_key?: string | null
          pinned?: boolean
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          importance?: number
          last_used_at?: string | null
          person_key?: string | null
          pinned?: boolean
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          character_id: string
          content: string
          created_at: string
          id: string
          role: string
          scenario_session_id: string | null
          user_id: string
        }
        Insert: {
          character_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          scenario_session_id?: string | null
          user_id: string
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          scenario_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_scenario_session_id_fkey"
            columns: ["scenario_session_id"]
            isOneToOne: false
            referencedRelation: "scenario_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          character_id: string
          created_at: string
          day: number
          description: string | null
          id: string
          kind: string
          title: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          day: number
          description?: string | null
          id?: string
          kind: string
          title: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          day?: number
          description?: string | null
          id?: string
          kind?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      scenario_sessions: {
        Row: {
          character_id: string
          completed_at: string | null
          created_at: string
          day_started: number
          id: string
          last_active_at: string
          progress: Json
          recap: string | null
          scenario_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          completed_at?: string | null
          created_at?: string
          day_started?: number
          id?: string
          last_active_at?: string
          progress?: Json
          recap?: string | null
          scenario_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          completed_at?: string | null
          created_at?: string
          day_started?: number
          id?: string
          last_active_at?: string
          progress?: Json
          recap?: string | null
          scenario_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_sessions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_sessions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          best_for: string[]
          category: string
          created_at: string
          description: string
          duration_label: string
          id: string
          instructions: string | null
          premise: string | null
          scenario_type: string
          setting: string | null
          slug: string
          sort_order: number
          title: string
          tone: string | null
        }
        Insert: {
          best_for?: string[]
          category: string
          created_at?: string
          description: string
          duration_label?: string
          id?: string
          instructions?: string | null
          premise?: string | null
          scenario_type?: string
          setting?: string | null
          slug: string
          sort_order?: number
          title: string
          tone?: string | null
        }
        Update: {
          best_for?: string[]
          category?: string
          created_at?: string
          description?: string
          duration_label?: string
          id?: string
          instructions?: string | null
          premise?: string | null
          scenario_type?: string
          setting?: string | null
          slug?: string
          sort_order?: number
          title?: string
          tone?: string | null
        }
        Relationships: []
      }
      story_events: {
        Row: {
          caption: string | null
          character_id: string
          created_at: string
          day: number
          description: string | null
          id: string
          image_url: string | null
          kind: string
          scenario_session_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          character_id: string
          created_at?: string
          day?: number
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          scenario_session_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          character_id?: string
          created_at?: string
          day?: number
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          scenario_session_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_events_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_events_scenario_session_id_fkey"
            columns: ["scenario_session_id"]
            isOneToOne: false
            referencedRelation: "scenario_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bond_signal_counts: { Args: { p_character_id: string }; Returns: Json }
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
