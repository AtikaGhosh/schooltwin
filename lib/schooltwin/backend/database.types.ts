// Generated-contract snapshot for code review and CI without a running local stack.
// Replace with `pnpm backend:types` after every applied migration.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'platform_admin' | 'field_coordinator' | 'school_operator'
export type TaskStatus =
  'scheduled' | 'in_progress' | 'submitted' | 'missed' | 'failed'

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string
          school_twin_id: string
          name: string
          district: string
          state: string
          time_zone: string
          opening_time: string
          closing_time: string
          completion_grace_seconds: number
          status: 'draft' | 'active' | 'suspended'
          config_version: number
        }
        Insert: {
          id?: string
          school_twin_id: string
          name: string
          district: string
          state: string
          time_zone?: string
          opening_time?: string
          closing_time?: string
        }
        Update: Partial<Database['public']['Tables']['schools']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          display_name: string
          role: AppRole
          disabled_at: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          display_name: string
          role: AppRole
        }
        Update: {
          display_name?: string
          role?: AppRole
          disabled_at?: string | null
        }
        Relationships: []
      }
      verification_tasks: {
        Row: {
          id: string
          school_id: string
          school_day_id: string
          section_id: string | null
          area_id: string
          scope: 'class' | 'facility'
          title: string
          instructions: string
          scheduled_start: string
          scheduled_end: string
          status: TaskStatus
          started_at: string | null
          completed_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      evidence_objects: {
        Row: {
          id: string
          school_id: string
          task_id: string
          object_path: string
          byte_length: number
          mime_type: string
          client_sha256: string
          server_sha256: string | null
          fingerprint_status: 'pending' | 'matched' | 'failed'
          delete_after: string
          backup_delete_after: string
          status: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      operator_submission_views: {
        Row: {
          id: string
          school_id: string
          task_id: string | null
          assignment_id: string | null
          kind: string
          title: string
          accepted_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      rpc_pair_device: { Args: Record<string, Json>; Returns: Json }
      rpc_sync_pull: { Args: Record<string, Json>; Returns: Json }
      rpc_apply_operator_mutation: { Args: Record<string, Json>; Returns: Json }
      rpc_redeem_access_grant_v2: { Args: Record<string, Json>; Returns: Json }
      rpc_submit_participant_response: {
        Args: Record<string, Json>
        Returns: Json
      }
      rpc_begin_capture: { Args: Record<string, Json>; Returns: Json }
      rpc_begin_offline_capture: { Args: Record<string, Json>; Returns: Json }
      rpc_finalize_capture: { Args: Record<string, Json>; Returns: Json }
    }
    Enums: {
      app_role: AppRole
      task_status: TaskStatus
    }
    CompositeTypes: Record<never, never>
  }
}
