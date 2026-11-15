export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      api_usage: {
        Row: {
          cache_hit: boolean;
          created_at: string;
          id: string;
          input_tokens: number | null;
          is_mock: boolean;
          metadata: NonNullable<Json>;
          model: string | null;
          operation: string;
          output_tokens: number | null;
          provider: string;
          units: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cache_hit?: boolean;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          is_mock?: boolean;
          metadata?: NonNullable<Json>;
          model?: string | null;
          operation: string;
          output_tokens?: number | null;
          provider: string;
          units?: number;
          user_id: string;
        };
        Update: {
          cache_hit?: boolean;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          is_mock?: boolean;
          metadata?: NonNullable<Json>;
          model?: string | null;
          operation?: string;
          output_tokens?: number | null;
          provider?: string;
          units?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          created_at: string;
          description: string | null;
          domain: string | null;
          id: string;
          industry: string | null;
          linkedin_url: string | null;
          location: string | null;
          name: string;
          size: string | null;
          updated_at: string;
          user_id: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          domain?: string | null;
          id?: string;
          industry?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          name: string;
          size?: string | null;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          domain?: string | null;
          id?: string;
          industry?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          name?: string;
          size?: string | null;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      gmail_connections: {
        Row: {
          connected_at: string;
          email: string;
          history_id: string | null;
          last_error: string | null;
          last_sync_at: string | null;
          scopes: string[];
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          connected_at?: string;
          email: string;
          history_id?: string | null;
          last_error?: string | null;
          last_sync_at?: string | null;
          scopes?: string[];
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connected_at?: string;
          email?: string;
          history_id?: string | null;
          last_error?: string | null;
          last_sync_at?: string | null;
          scopes?: string[];
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      gmail_tokens: {
        Row: {
          access_token_enc: string | null;
          access_token_expires_at: string | null;
          refresh_token_enc: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          access_token_enc?: string | null;
          access_token_expires_at?: string | null;
          refresh_token_enc: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token_enc?: string | null;
          access_token_expires_at?: string | null;
          refresh_token_enc?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gmail_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "gmail_connections";
            referencedColumns: ["user_id"];
          },
        ];
      };
      messages: {
        Row: {
          angle: string | null;
          approved_at: string | null;
          body: string;
          channel: string;
          created_at: string;
          error: string | null;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          id: string;
          is_sample: boolean;
          is_selected: boolean;
          model: string | null;
          person_id: string;
          prompt_id: string | null;
          prompt_version: number | null;
          quality: Json | null;
          rfc_message_id: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          sequence_id: string | null;
          sequence_step: number;
          status: string;
          subject: string | null;
          target_id: string;
          type: string;
          updated_at: string;
          user_id: string;
          variant_group: string | null;
        };
        ComputedFields: never;
        Insert: {
          angle?: string | null;
          approved_at?: string | null;
          body?: string;
          channel: string;
          created_at?: string;
          error?: string | null;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          id?: string;
          is_sample?: boolean;
          is_selected?: boolean;
          model?: string | null;
          person_id: string;
          prompt_id?: string | null;
          prompt_version?: number | null;
          quality?: Json | null;
          rfc_message_id?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          sequence_id?: string | null;
          sequence_step?: number;
          status?: string;
          subject?: string | null;
          target_id: string;
          type: string;
          updated_at?: string;
          user_id?: string;
          variant_group?: string | null;
        };
        Update: {
          angle?: string | null;
          approved_at?: string | null;
          body?: string;
          channel?: string;
          created_at?: string;
          error?: string | null;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          id?: string;
          is_sample?: boolean;
          is_selected?: boolean;
          model?: string | null;
          person_id?: string;
          prompt_id?: string | null;
          prompt_version?: number | null;
          quality?: Json | null;
          rfc_message_id?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          sequence_id?: string | null;
          sequence_step?: number;
          status?: string;
          subject?: string | null;
          target_id?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
          variant_group?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_person_id_user_id_fkey";
            columns: ["person_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "messages_sequence_id_user_id_fkey";
            columns: ["sequence_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "messages_target_id_user_id_fkey";
            columns: ["target_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "targets";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      people: {
        Row: {
          company_id: string;
          connection_angles: NonNullable<Json>;
          created_at: string;
          do_not_contact: boolean;
          email: string | null;
          email_checked_at: string | null;
          email_confidence: number | null;
          email_risk_accepted_at: string | null;
          email_source: string | null;
          email_status: string;
          enrichment_error: string | null;
          enrichment_status: string;
          first_name: string | null;
          full_name: string;
          id: string;
          is_recommended: boolean;
          is_sample: boolean;
          last_name: string | null;
          linkedin_url: string | null;
          location: string | null;
          notes: string | null;
          provider_person_id: string | null;
          relevance_reason: string | null;
          relevance_score: number | null;
          role_type: string | null;
          source: string;
          stage: string;
          stage_changed_at: string;
          target_id: string;
          timezone: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          connection_angles?: NonNullable<Json>;
          created_at?: string;
          do_not_contact?: boolean;
          email?: string | null;
          email_checked_at?: string | null;
          email_confidence?: number | null;
          email_risk_accepted_at?: string | null;
          email_source?: string | null;
          email_status?: string;
          enrichment_error?: string | null;
          enrichment_status?: string;
          first_name?: string | null;
          full_name: string;
          id?: string;
          is_recommended?: boolean;
          is_sample?: boolean;
          last_name?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          notes?: string | null;
          provider_person_id?: string | null;
          relevance_reason?: string | null;
          relevance_score?: number | null;
          role_type?: string | null;
          source?: string;
          stage?: string;
          stage_changed_at?: string;
          target_id: string;
          timezone?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          company_id?: string;
          connection_angles?: NonNullable<Json>;
          created_at?: string;
          do_not_contact?: boolean;
          email?: string | null;
          email_checked_at?: string | null;
          email_confidence?: number | null;
          email_risk_accepted_at?: string | null;
          email_source?: string | null;
          email_status?: string;
          enrichment_error?: string | null;
          enrichment_status?: string;
          first_name?: string | null;
          full_name?: string;
          id?: string;
          is_recommended?: boolean;
          is_sample?: boolean;
          last_name?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          notes?: string | null;
          provider_person_id?: string | null;
          relevance_reason?: string | null;
          relevance_score?: number | null;
          role_type?: string | null;
          source?: string;
          stage?: string;
          stage_changed_at?: string;
          target_id?: string;
          timezone?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "people_company_id_user_id_fkey";
            columns: ["company_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "people_target_id_user_id_fkey";
            columns: ["target_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "targets";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          daily_send_cap: number;
          email: string | null;
          full_name: string | null;
          headline: string | null;
          id: string;
          location: string | null;
          onboarding_completed_at: string | null;
          positioning_statement: string | null;
          preferences: NonNullable<Json>;
          resume_file_name: string | null;
          resume_parsed: Json | null;
          resume_parsed_at: string | null;
          resume_path: string | null;
          story_answers: NonNullable<Json>;
          target_roles: string[];
          timezone: string;
          tone: string;
          updated_at: string;
          writing_sample: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          daily_send_cap?: number;
          email?: string | null;
          full_name?: string | null;
          headline?: string | null;
          id: string;
          location?: string | null;
          onboarding_completed_at?: string | null;
          positioning_statement?: string | null;
          preferences?: NonNullable<Json>;
          resume_file_name?: string | null;
          resume_parsed?: Json | null;
          resume_parsed_at?: string | null;
          resume_path?: string | null;
          story_answers?: NonNullable<Json>;
          target_roles?: string[];
          timezone?: string;
          tone?: string;
          updated_at?: string;
          writing_sample?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          daily_send_cap?: number;
          email?: string | null;
          full_name?: string | null;
          headline?: string | null;
          id?: string;
          location?: string | null;
          onboarding_completed_at?: string | null;
          positioning_statement?: string | null;
          preferences?: NonNullable<Json>;
          resume_file_name?: string | null;
          resume_parsed?: Json | null;
          resume_parsed_at?: string | null;
          resume_path?: string | null;
          story_answers?: NonNullable<Json>;
          target_roles?: string[];
          timezone?: string;
          tone?: string;
          updated_at?: string;
          writing_sample?: string | null;
        };
        Relationships: [];
      };
      provider_cache: {
        Row: {
          cache_key: string;
          created_at: string;
          expires_at: string;
          operation: string;
          payload: NonNullable<Json>;
          provider: string;
        };
        ComputedFields: never;
        Insert: {
          cache_key: string;
          created_at?: string;
          expires_at: string;
          operation: string;
          payload: NonNullable<Json>;
          provider: string;
        };
        Update: {
          cache_key?: string;
          created_at?: string;
          expires_at?: string;
          operation?: string;
          payload?: NonNullable<Json>;
          provider?: string;
        };
        Relationships: [];
      };
      research_briefs: {
        Row: {
          company_id: string;
          content: NonNullable<Json>;
          created_at: string;
          expires_at: string | null;
          id: string;
          is_sample: boolean;
          model: string | null;
          person_id: string | null;
          prompt_id: string | null;
          prompt_version: number | null;
          scope: string;
          sources: NonNullable<Json>;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          content: NonNullable<Json>;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_sample?: boolean;
          model?: string | null;
          person_id?: string | null;
          prompt_id?: string | null;
          prompt_version?: number | null;
          scope: string;
          sources?: NonNullable<Json>;
          user_id?: string;
        };
        Update: {
          company_id?: string;
          content?: NonNullable<Json>;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_sample?: boolean;
          model?: string | null;
          person_id?: string | null;
          prompt_id?: string | null;
          prompt_version?: number | null;
          scope?: string;
          sources?: NonNullable<Json>;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_briefs_company_id_user_id_fkey";
            columns: ["company_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "research_briefs_person_id_user_id_fkey";
            columns: ["person_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      send_events: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          kind: string;
          local_day: string;
          message_id: string | null;
          person_id: string | null;
          provider: string;
          status: string;
          to_email: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          kind: string;
          local_day: string;
          message_id?: string | null;
          person_id?: string | null;
          provider: string;
          status: string;
          to_email: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          kind?: string;
          local_day?: string;
          message_id?: string | null;
          person_id?: string | null;
          provider?: string;
          status?: string;
          to_email?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "send_events_message_id_user_id_fkey";
            columns: ["message_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "send_events_person_id_user_id_fkey";
            columns: ["person_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      sequences: {
        Row: {
          created_at: string;
          follow_up_days: number[];
          gmail_thread_id: string | null;
          id: string;
          person_id: string;
          started_at: string | null;
          status: string;
          stop_reason: string | null;
          stopped_at: string | null;
          target_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          follow_up_days?: number[];
          gmail_thread_id?: string | null;
          id?: string;
          person_id: string;
          started_at?: string | null;
          status?: string;
          stop_reason?: string | null;
          stopped_at?: string | null;
          target_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          follow_up_days?: number[];
          gmail_thread_id?: string | null;
          id?: string;
          person_id?: string;
          started_at?: string | null;
          status?: string;
          stop_reason?: string | null;
          stopped_at?: string | null;
          target_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequences_person_id_user_id_fkey";
            columns: ["person_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "sequences_target_id_user_id_fkey";
            columns: ["target_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "targets";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      suppressions: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          note: string | null;
          reason: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          note?: string | null;
          reason: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          note?: string | null;
          reason?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      targets: {
        Row: {
          company_id: string;
          created_at: string;
          discovered_at: string | null;
          discovery_error: string | null;
          discovery_status: string;
          id: string;
          job_summary: string | null;
          job_text: string | null;
          job_url: string | null;
          kind: string;
          location: string | null;
          must_have_skills: string[];
          nice_to_have_skills: string[];
          role_title: string | null;
          seniority: string | null;
          status: string;
          team: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          discovered_at?: string | null;
          discovery_error?: string | null;
          discovery_status?: string;
          id?: string;
          job_summary?: string | null;
          job_text?: string | null;
          job_url?: string | null;
          kind: string;
          location?: string | null;
          must_have_skills?: string[];
          nice_to_have_skills?: string[];
          role_title?: string | null;
          seniority?: string | null;
          status?: string;
          team?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          discovered_at?: string | null;
          discovery_error?: string | null;
          discovery_status?: string;
          id?: string;
          job_summary?: string | null;
          job_text?: string | null;
          job_url?: string | null;
          kind?: string;
          location?: string | null;
          must_have_skills?: string[];
          nice_to_have_skills?: string[];
          role_title?: string | null;
          seniority?: string | null;
          status?: string;
          team?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "targets_company_id_user_id_fkey";
            columns: ["company_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      thread_messages: {
        Row: {
          body_text: string | null;
          created_at: string;
          direction: string;
          from_email: string | null;
          from_name: string | null;
          gmail_message_id: string;
          id: string;
          kind: string;
          message_id: string | null;
          sent_at: string;
          snippet: string | null;
          subject: string | null;
          thread_id: string;
          to_email: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body_text?: string | null;
          created_at?: string;
          direction: string;
          from_email?: string | null;
          from_name?: string | null;
          gmail_message_id: string;
          id?: string;
          kind?: string;
          message_id?: string | null;
          sent_at: string;
          snippet?: string | null;
          subject?: string | null;
          thread_id: string;
          to_email?: string | null;
          user_id?: string;
        };
        Update: {
          body_text?: string | null;
          created_at?: string;
          direction?: string;
          from_email?: string | null;
          from_name?: string | null;
          gmail_message_id?: string;
          id?: string;
          kind?: string;
          message_id?: string | null;
          sent_at?: string;
          snippet?: string | null;
          subject?: string | null;
          thread_id?: string;
          to_email?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_messages_message_id_user_id_fkey";
            columns: ["message_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "thread_messages_thread_id_user_id_fkey";
            columns: ["thread_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      threads: {
        Row: {
          classification: string | null;
          classification_reason: string | null;
          classified_at: string | null;
          created_at: string;
          gmail_thread_id: string;
          handled_at: string | null;
          id: string;
          is_sample: boolean;
          last_inbound_at: string | null;
          last_message_at: string | null;
          needs_attention: boolean;
          person_id: string;
          sequence_id: string | null;
          snippet: string | null;
          subject: string | null;
          suggested_reply: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          classification?: string | null;
          classification_reason?: string | null;
          classified_at?: string | null;
          created_at?: string;
          gmail_thread_id: string;
          handled_at?: string | null;
          id?: string;
          is_sample?: boolean;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          needs_attention?: boolean;
          person_id: string;
          sequence_id?: string | null;
          snippet?: string | null;
          subject?: string | null;
          suggested_reply?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          classification?: string | null;
          classification_reason?: string | null;
          classified_at?: string | null;
          created_at?: string;
          gmail_thread_id?: string;
          handled_at?: string | null;
          id?: string;
          is_sample?: boolean;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          needs_attention?: boolean;
          person_id?: string;
          sequence_id?: string | null;
          snippet?: string | null;
          subject?: string | null;
          suggested_reply?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "threads_person_id_user_id_fkey";
            columns: ["person_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "threads_sequence_id_user_id_fkey";
            columns: ["sequence_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_send_slot: {
        Args: {
          p_message_id: string;
          p_now?: string;
          p_provider: string;
          p_reply_to_email?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      sends_remaining_today: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
