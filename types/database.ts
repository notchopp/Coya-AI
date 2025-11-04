export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          business_id: string
          auth_user_id: string | null
          email: string | null
          full_name: string | null
          role: string | null
          phone: string | null
          metadata: Json | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          auth_user_id?: string | null
          email?: string | null
          full_name?: string | null
          role?: string | null
          phone?: string | null
          metadata?: Json | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          auth_user_id?: string | null
          email?: string | null
          full_name?: string | null
          role?: string | null
          phone?: string | null
          metadata?: Json | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          id: string
          name: string | null
          vertical: string | null
          services: string[] | string | null
          address: string | null
          hours: Json | null
          staff: Json | null
          faqs: Json | null
          promos: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name?: string | null
          vertical?: string | null
          services?: string[] | string | null
          address?: string | null
          hours?: Json | null
          staff?: Json | null
          faqs?: Json | null
          promos?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          vertical?: string | null
          services?: string[] | string | null
          address?: string | null
          hours?: Json | null
          staff?: Json | null
          faqs?: Json | null
          promos?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          id: string
          business_id: string
          call_id: string
          patient_id: string | null
          status: string | null
          phone: string | null
          email: string | null
          patient_name: string | null
          last_summary: string | null
          last_intent: string | null
          success: boolean | null
          started_at: string | null
          ended_at: string | null
          transcript: string | null
          escalate: boolean | null
          upsell: boolean | null
          schedule: Json | null
          context: Json | null
          total_turns: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          call_id: string
          patient_id?: string | null
          status?: string | null
          phone?: string | null
          email?: string | null
          patient_name?: string | null
          last_summary?: string | null
          last_intent?: string | null
          success?: boolean | null
          started_at?: string | null
          ended_at?: string | null
          transcript?: string | null
          escalate?: boolean | null
          upsell?: boolean | null
          schedule?: Json | null
          context?: Json | null
          total_turns?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          call_id?: string
          patient_id?: string | null
          status?: string | null
          phone?: string | null
          email?: string | null
          patient_name?: string | null
          last_summary?: string | null
          last_intent?: string | null
          success?: boolean | null
          started_at?: string | null
          ended_at?: string | null
          transcript?: string | null
          escalate?: boolean | null
          upsell?: boolean | null
          schedule?: Json | null
          context?: Json | null
          total_turns?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
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
  }
}

