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
      clinics: {
        Row: {
          audience: string | null
          content_pillars: string[] | null
          created_at: string | null
          deep_dive_topics: string[] | null
          doctor_name: string | null
          id: string
          logo_url: string | null
          medical_restrictions: string[] | null
          name: string
          niche: string | null
          services: string[] | null
          tone: string | null
        }
        Insert: {
          audience?: string | null
          content_pillars?: string[] | null
          created_at?: string | null
          deep_dive_topics?: string[] | null
          doctor_name?: string | null
          id?: string
          logo_url?: string | null
          medical_restrictions?: string[] | null
          name: string
          niche?: string | null
          services?: string[] | null
          tone?: string | null
        }
        Update: {
          audience?: string | null
          content_pillars?: string[] | null
          created_at?: string | null
          deep_dive_topics?: string[] | null
          doctor_name?: string | null
          id?: string
          logo_url?: string | null
          medical_restrictions?: string[] | null
          name?: string
          niche?: string | null
          services?: string[] | null
          tone?: string | null
        }
        Relationships: []
      }
      clinic_categories: {
        Row: {
          id: string
          clinic_id: string
          slug: string
          name: string
          emoji: string | null
          position: number
          triggers: string[]
          drive_folder_id: string | null
          cta_template: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          slug: string
          name: string
          emoji?: string | null
          position?: number
          triggers?: string[]
          drive_folder_id?: string | null
          cta_template?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          slug?: string
          name?: string
          emoji?: string | null
          position?: number
          triggers?: string[]
          drive_folder_id?: string | null
          cta_template?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      content_plan_topics: {
        Row: {
          id: string
          clinic_id: string
          topic: string
          position: number
          status: string
          last_script_id: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          topic: string
          position?: number
          status?: string
          last_script_id?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          topic?: string
          position?: number
          status?: string
          last_script_id?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_plan_topics_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_plan_topics_last_script_id_fkey"
            columns: ["last_script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_access_tokens: {
        Row: {
          token: string
          clinic_id: string
          role: string
          label: string | null
          created_at: string
          last_used_at: string | null
          revoked_at: string | null
        }
        Insert: {
          token: string
          clinic_id: string
          role?: string
          label?: string | null
          created_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
        }
        Update: {
          token?: string
          clinic_id?: string
          role?: string
          label?: string | null
          created_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_access_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      script_feedback: {
        Row: {
          action: string
          clinic_id: string
          created_at: string | null
          id: string
          script_id: string
        }
        Insert: {
          action: string
          clinic_id: string
          created_at?: string | null
          id?: string
          script_id: string
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string | null
          id?: string
          script_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_feedback_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_feedback_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      diff_rules: {
        Row: {
          active: boolean | null
          clinic_id: string | null
          created_at: string | null
          example_after: string | null
          example_before: string | null
          id: string
          priority: number | null
          rule: string
        }
        Insert: {
          active?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          example_after?: string | null
          example_before?: string | null
          id?: string
          priority?: number | null
          rule: string
        }
        Update: {
          active?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          example_after?: string | null
          example_before?: string | null
          id?: string
          priority?: number | null
          rule?: string
        }
        Relationships: [
          {
            foreignKeyName: "diff_rules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_notes: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          processed: boolean | null
          raw_text: string
          source: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          processed?: boolean | null
          raw_text: string
          source?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          processed?: boolean | null
          raw_text?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      few_shot_library: {
        Row: {
          active: boolean | null
          clinic_id: string | null
          created_at: string | null
          id: string
          score: number | null
          script_text: string
          topic: string | null
          why_good: string | null
        }
        Insert: {
          active?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          score?: number | null
          script_text: string
          topic?: string | null
          why_good?: string | null
        }
        Update: {
          active?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          score?: number | null
          script_text?: string
          topic?: string | null
          why_good?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "few_shot_library_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          clinic_id: string | null
          content: string
          created_at: string | null
          id: string
          type: string | null
          used_count: number | null
        }
        Insert: {
          clinic_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          type?: string | null
          used_count?: number | null
        }
        Update: {
          clinic_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          type?: string | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      script_finals: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          diff_processed: boolean | null
          edited_by: string | null
          final_text: string
          id: string
          script_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          diff_processed?: boolean | null
          edited_by?: string | null
          final_text: string
          id?: string
          script_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          diff_processed?: boolean | null
          edited_by?: string | null
          final_text?: string
          id?: string
          script_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_finals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_finals_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          approved: boolean | null
          clinic_id: string | null
          created_at: string | null
          critic_score: number | null
          full_script: string
          google_doc_id: string | null
          google_doc_url: string | null
          hook: string | null
          id: string
          length_target: string | null
          pair_id: string | null
          topic: string | null
          variant_id: string | null
          word_count: number | null
        }
        Insert: {
          approved?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          critic_score?: number | null
          full_script: string
          google_doc_id?: string | null
          google_doc_url?: string | null
          hook?: string | null
          id?: string
          length_target?: string | null
          pair_id?: string | null
          topic?: string | null
          variant_id?: string | null
          word_count?: number | null
        }
        Update: {
          approved?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          critic_score?: number | null
          full_script?: string
          google_doc_id?: string | null
          google_doc_url?: string | null
          hook?: string | null
          id?: string
          length_target?: string | null
          pair_id?: string | null
          topic?: string | null
          variant_id?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      slide_sets: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          drive_folder_id: string | null
          id: string
          script_id: string | null
          slides: Json | null
          status: string | null
          style_template: Json | null
          category_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          id?: string
          script_id?: string | null
          slides?: Json | null
          status?: string | null
          style_template?: Json | null
          category_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          id?: string
          script_id?: string | null
          slides?: Json | null
          status?: string | null
          style_template?: Json | null
          category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slide_sets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slide_sets_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slide_sets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "clinic_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      post_references: {
        Row: {
          id: string
          clinic_id: string
          image_url: string
          storage_path: string | null
          label: string | null
          mode: string | null
          role: string | null
          category_slug: string | null
          notes: string | null
          position: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          image_url: string
          storage_path?: string | null
          label?: string | null
          mode?: string | null
          role?: string | null
          category_slug?: string | null
          notes?: string | null
          position?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          image_url?: string
          storage_path?: string | null
          label?: string | null
          mode?: string | null
          role?: string | null
          category_slug?: string | null
          notes?: string | null
          position?: number
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_references_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      script_templates: {
        Row: {
          id: string
          clinic_id: string
          name: string
          description: string | null
          scaffold: string
          length_bias: string | null
          position: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          description?: string | null
          scaffold: string
          length_bias?: string | null
          position?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          description?: string | null
          scaffold?: string
          length_bias?: string | null
          position?: number
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_signals: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          expires_at: string | null
          hook_angle: string | null
          id: string
          topic: string
          why_relevant: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          hook_angle?: string | null
          id?: string
          topic: string
          why_relevant?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          hook_angle?: string | null
          id?: string
          topic?: string
          why_relevant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_signals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
