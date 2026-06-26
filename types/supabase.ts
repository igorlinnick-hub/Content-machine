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
      clinic_groups: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      clinics: {
        Row: {
          audience: string | null
          content_pillars: string[] | null
          created_at: string | null
          deep_dive_topics: string[] | null
          doctor_name: string | null
          full_name: string | null
          group_id: string | null
          id: string
          logo_url: string | null
          medical_restrictions: string[] | null
          name: string
          niche: string | null
          services: string[] | null
          tone: string | null
          content_plan_start: string | null
        }
        Insert: {
          audience?: string | null
          content_pillars?: string[] | null
          created_at?: string | null
          deep_dive_topics?: string[] | null
          doctor_name?: string | null
          full_name?: string | null
          group_id?: string | null
          id?: string
          logo_url?: string | null
          medical_restrictions?: string[] | null
          name: string
          niche?: string | null
          services?: string[] | null
          tone?: string | null
          content_plan_start?: string | null
        }
        Update: {
          audience?: string | null
          content_pillars?: string[] | null
          created_at?: string | null
          deep_dive_topics?: string[] | null
          doctor_name?: string | null
          full_name?: string | null
          group_id?: string | null
          id?: string
          logo_url?: string | null
          medical_restrictions?: string[] | null
          name?: string
          niche?: string | null
          services?: string[] | null
          tone?: string | null
          content_plan_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinics_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "clinic_groups"
            referencedColumns: ["id"]
          }
        ]
      }
      clinic_recordings: {
        Row: {
          id: string
          clinic_id: string
          script_id: string | null
          title: string
          drive_file_id: string
          drive_url: string
          duration_sec: number | null
          size_bytes: number | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          script_id?: string | null
          title?: string
          drive_file_id: string
          drive_url: string
          duration_sec?: number | null
          size_bytes?: number | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          script_id?: string | null
          title?: string
          drive_file_id?: string
          drive_url?: string
          duration_sec?: number | null
          size_bytes?: number | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_recordings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
      content_plan_weeks: {
        Row: {
          id: string
          clinic_id: string
          week_number: number
          theme: string
          pillar: string
          description: string | null
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          week_number: number
          theme: string
          pillar: string
          description?: string | null
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          week_number?: number
          theme?: string
          pillar?: string
          description?: string | null
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_plan_weeks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          }
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
          plan_handle: string | null
          cycle_position: number | null
          week_id: string | null
          keyword: string | null
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
          plan_handle?: string | null
          cycle_position?: number | null
          week_id?: string | null
          keyword?: string | null
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
          plan_handle?: string | null
          cycle_position?: number | null
          week_id?: string | null
          keyword?: string | null
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
          {
            foreignKeyName: "content_plan_topics_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "content_plan_weeks"
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
          code: string | null
          created_at: string
          last_used_at: string | null
          revoked_at: string | null
        }
        Insert: {
          token: string
          clinic_id: string
          role?: string
          label?: string | null
          code?: string | null
          created_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
        }
        Update: {
          token?: string
          clinic_id?: string
          role?: string
          label?: string | null
          code?: string | null
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
          short_caption: string | null
          long_caption: string | null
          template_used: string | null
          role_blocks: Json | null
          format_template_id: string | null
        }
        Insert: {
          approved?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          short_caption?: string | null
          long_caption?: string | null
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
          template_used?: string | null
          role_blocks?: Json | null
          format_template_id?: string | null
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
          short_caption?: string | null
          long_caption?: string | null
          template_used?: string | null
          role_blocks?: Json | null
          format_template_id?: string | null
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
          photo_overrides: Json | null
          compliance: Json | null
          plan_id: string | null
          render_result: Json | null
          canva_style: number | null
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
          photo_overrides?: Json | null
          compliance?: Json | null
          plan_id?: string | null
          render_result?: Json | null
          canva_style?: number | null
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
          photo_overrides?: Json | null
          compliance?: Json | null
          plan_id?: string | null
          render_result?: Json | null
          canva_style?: number | null
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
      video_sets: {
        Row: {
          id: string
          clinic_id: string
          script_id: string | null
          prompt: string
          replicate_prediction_id: string | null
          replicate_model: string | null
          storage_path: string | null
          public_url: string | null
          params: Json | null
          duration_sec: number | null
          aspect_ratio: string | null
          resolution: string | null
          category_id: string | null
          status: string
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          script_id?: string | null
          prompt: string
          replicate_prediction_id?: string | null
          replicate_model?: string | null
          storage_path?: string | null
          public_url?: string | null
          params?: Json | null
          duration_sec?: number | null
          aspect_ratio?: string | null
          resolution?: string | null
          category_id?: string | null
          status?: string
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          script_id?: string | null
          prompt?: string
          replicate_prediction_id?: string | null
          replicate_model?: string | null
          storage_path?: string | null
          public_url?: string | null
          params?: Json | null
          duration_sec?: number | null
          aspect_ratio?: string | null
          resolution?: string | null
          category_id?: string | null
          status?: string
          error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_sets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompts: {
        Row: {
          id: string
          clinic_id: string
          agent_key: string
          system_prompt: string
          version: number
          active: boolean
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          agent_key: string
          system_prompt: string
          version?: number
          active?: boolean
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          agent_key?: string
          system_prompt?: string
          version?: number
          active?: boolean
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_preferences: {
        Row: {
          id: string
          clinic_id: string
          agent_key: string
          prefs: Json
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          agent_key: string
          prefs?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          agent_key?: string
          prefs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_preferences_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_learnings: {
        Row: {
          id: string
          clinic_id: string
          agent_key: string
          user_message: string
          agent_action: string | null
          feedback_kind: string
          rule: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          agent_key: string
          user_message: string
          agent_action?: string | null
          feedback_kind: string
          rule?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          agent_key?: string
          user_message?: string
          agent_action?: string | null
          feedback_kind?: string
          rule?: string | null
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_learnings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          id: string
          clinic_id: string
          drive_inbox_file_id: string
          drive_inbox_file_name: string
          drive_clip_folder_id: string | null
          status: string
          duration_in_sec: number | null
          duration_out_sec: number | null
          cuts_filler_count: number | null
          cuts_silence_count: number | null
          cleaned_file_id: string | null
          transcript_txt_file_id: string | null
          transcript_srt_file_id: string | null
          triggered_chat_id: string | null
          error: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          drive_inbox_file_id: string
          drive_inbox_file_name: string
          drive_clip_folder_id?: string | null
          status?: string
          duration_in_sec?: number | null
          duration_out_sec?: number | null
          cuts_filler_count?: number | null
          cuts_silence_count?: number | null
          cleaned_file_id?: string | null
          transcript_txt_file_id?: string | null
          transcript_srt_file_id?: string | null
          triggered_chat_id?: string | null
          error?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          drive_inbox_file_id?: string
          drive_inbox_file_name?: string
          drive_clip_folder_id?: string | null
          status?: string
          duration_in_sec?: number | null
          duration_out_sec?: number | null
          cuts_filler_count?: number | null
          cuts_silence_count?: number | null
          cleaned_file_id?: string | null
          transcript_txt_file_id?: string | null
          transcript_srt_file_id?: string | null
          triggered_chat_id?: string | null
          error?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_clinic_id_fkey"
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
      video_ingest_queue: {
        Row: {
          id: string
          clinic_id: string
          source_url: string
          source_platform: string
          requested_by_chat_id: string | null
          requested_by_name: string | null
          status: string
          arsenal_id: string | null
          error: string | null
          created_at: string
          processed_at: string | null
          intent: string
          user_context: string | null
          discovered_via: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          source_url: string
          source_platform?: string
          requested_by_chat_id?: string | null
          requested_by_name?: string | null
          status?: string
          arsenal_id?: string | null
          error?: string | null
          created_at?: string
          processed_at?: string | null
          intent?: string
          user_context?: string | null
          discovered_via?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          source_url?: string
          source_platform?: string
          requested_by_chat_id?: string | null
          requested_by_name?: string | null
          status?: string
          arsenal_id?: string | null
          error?: string | null
          created_at?: string
          processed_at?: string | null
          intent?: string
          user_context?: string | null
          discovered_via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_ingest_queue_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      script_arsenal: {
        Row: {
          id: string
          clinic_id: string
          queue_id: string | null
          source_url: string | null
          source_platform: string | null
          style_label: string
          style_description: string | null
          title: string | null
          full_transcript: string | null
          hooks: Json
          structure: Json
          pains: Json
          tags: string[]
          is_active: boolean
          confirmed_at: string | null
          created_at: string
          visual_notes: Json
          video_storage_path: string | null
          thumbnail_storage_path: string | null
          pending_refine_note: string | null
          refined_at: string | null
          refine_history: Json
          clinic_template_proposal: string | null
          clinic_template_note: string | null
          view_count: number | null
          author_handle: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          queue_id?: string | null
          source_url?: string | null
          source_platform?: string | null
          style_label: string
          style_description?: string | null
          title?: string | null
          full_transcript?: string | null
          hooks?: Json
          structure?: Json
          pains?: Json
          tags?: string[]
          is_active?: boolean
          confirmed_at?: string | null
          created_at?: string
          visual_notes?: Json
          video_storage_path?: string | null
          thumbnail_storage_path?: string | null
          pending_refine_note?: string | null
          refined_at?: string | null
          refine_history?: Json
          clinic_template_proposal?: string | null
          clinic_template_note?: string | null
          view_count?: number | null
          author_handle?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          queue_id?: string | null
          source_url?: string | null
          source_platform?: string | null
          style_label?: string
          style_description?: string | null
          title?: string | null
          full_transcript?: string | null
          hooks?: Json
          structure?: Json
          pains?: Json
          tags?: string[]
          is_active?: boolean
          confirmed_at?: string | null
          created_at?: string
          visual_notes?: Json
          video_storage_path?: string | null
          thumbnail_storage_path?: string | null
          pending_refine_note?: string | null
          refined_at?: string | null
          refine_history?: Json
          clinic_template_proposal?: string | null
          clinic_template_note?: string | null
          view_count?: number | null
          author_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_arsenal_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_arsenal_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "video_ingest_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_slots: {
        Row: {
          id: string
          clinic_id: string
          slot_index: number
          studio_video_id: string | null
          current_script_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          slot_index: number
          studio_video_id?: string | null
          current_script_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          slot_index?: number
          studio_video_id?: string | null
          current_script_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_slots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_videos: {
        Row: {
          id: string
          clinic_id: string
          source_url: string | null
          source_platform: string | null
          author_handle: string | null
          view_count: number | null
          title: string | null
          style_description: string | null
          structure: Json
          caption: string | null
          video_storage_path: string | null
          thumbnail_storage_path: string | null
          is_active: boolean
          status: string
          current_script_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          source_url?: string | null
          source_platform?: string | null
          author_handle?: string | null
          view_count?: number | null
          title?: string | null
          style_description?: string | null
          structure?: Json
          caption?: string | null
          video_storage_path?: string | null
          thumbnail_storage_path?: string | null
          is_active?: boolean
          status?: string
          current_script_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          source_url?: string | null
          source_platform?: string | null
          author_handle?: string | null
          view_count?: number | null
          title?: string | null
          style_description?: string | null
          structure?: Json
          caption?: string | null
          video_storage_path?: string | null
          thumbnail_storage_path?: string | null
          is_active?: boolean
          status?: string
          current_script_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_videos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_sources: {
        Row: {
          id: string
          clinic_id: string
          platform: string
          kind: string
          handle_or_hashtag: string
          active: boolean
          last_scanned_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          platform: string
          kind: string
          handle_or_hashtag: string
          active?: boolean
          last_scanned_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          platform?: string
          kind?: string
          handle_or_hashtag?: string
          active?: boolean
          last_scanned_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_sources_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_index: {
        Row: {
          id: string
          clinic_id: string
          drive_folder_id: string
          drive_file_id: string
          file_name: string | null
          description: string
          tags: string[]
          description_model: string
          indexed_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          drive_folder_id: string
          drive_file_id: string
          file_name?: string | null
          description: string
          tags?: string[]
          description_model: string
          indexed_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          drive_folder_id?: string
          drive_file_id?: string
          file_name?: string | null
          description?: string
          tags?: string[]
          description_model?: string
          indexed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_index_clinic_id_fkey"
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
