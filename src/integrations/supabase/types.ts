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
      characters: {
        Row: {
          age: string | null
          appearance: Json | null
          avatar_url: string | null
          backstory: string | null
          communication_style: string | null
          created_at: string
          gender: string | null
          goals: string | null
          id: string
          interests: Json | null
          journey_end_date: string
          journey_start_date: string
          location: string | null
          mood: string | null
          name: string
          occupation: string | null
          personality: Json | null
          pronouns: string | null
          relationship_stage: string | null
          relationship_type: string
          style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: string | null
          appearance?: Json | null
          avatar_url?: string | null
          backstory?: string | null
          communication_style?: string | null
          created_at?: string
          gender?: string | null
          goals?: string | null
          id?: string
          interests?: Json | null
          journey_end_date?: string
          journey_start_date?: string
          location?: string | null
          mood?: string | null
          name: string
          occupation?: string | null
          personality?: Json | null
          pronouns?: string | null
          relationship_stage?: string | null
          relationship_type?: string
          style: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: string | null
          appearance?: Json | null
          avatar_url?: string | null
          backstory?: string | null
          communication_style?: string | null
          created_at?: string
          gender?: string | null
          goals?: string | null
          id?: string
          interests?: Json | null
          journey_end_date?: string
          journey_start_date?: string
          location?: string | null
          mood?: string | null
          name?: string
          occupation?: string | null
          personality?: Json | null
          pronouns?: string | null
          relationship_stage?: string | null
          relationship_type?: string
          style?: string
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
      memories: {
        Row: {
          category: string
          character_id: string
          content: string
          created_at: string
          id: string
          importance: number
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
          user_id: string
        }
        Insert: {
          character_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
