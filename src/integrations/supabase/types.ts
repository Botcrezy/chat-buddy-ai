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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          booking_type: string
          course_id: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
          total_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_type?: string
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_type?: string
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          auto_reply_enabled: boolean
          bot_name: string
          created_at: string
          id: string
          off_hours_message: string | null
          personality: string | null
          updated_at: string
          welcome_message: string | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          auto_reply_enabled?: boolean
          bot_name?: string
          created_at?: string
          id?: string
          off_hours_message?: string | null
          personality?: string | null
          updated_at?: string
          welcome_message?: string | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          auto_reply_enabled?: boolean
          bot_name?: string
          created_at?: string
          id?: string
          off_hours_message?: string | null
          personality?: string | null
          updated_at?: string
          welcome_message?: string | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          avatar_url: string | null
          category: string
          created_at: string
          id: string
          last_message_at: string | null
          name: string | null
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_to: string | null
          contact_id: string
          created_at: string
          id: string
          is_ai_active: boolean
          labels: string[] | null
          last_message: string | null
          last_message_at: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          id?: string
          is_ai_active?: boolean
          labels?: string[] | null
          last_message?: string | null
          last_message_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          is_ai_active?: boolean
          labels?: string[] | null
          last_message?: string | null
          last_message_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description_ar: string | null
          description_en: string | null
          duration_hours: number | null
          end_date: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          location: string | null
          max_capacity: number | null
          price: number
          start_date: string | null
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description_ar?: string | null
          description_en?: string | null
          duration_hours?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          location?: string | null
          max_capacity?: number | null
          price?: number
          start_date?: string | null
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description_ar?: string | null
          description_en?: string | null
          duration_hours?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          location?: string | null
          max_capacity?: number | null
          price?: number
          start_date?: string | null
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          certification_level: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          joined_at: string
          membership_tier: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          certification_level?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          membership_tier?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          certification_level?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          membership_tier?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          is_read: boolean
          media_type: string | null
          media_url: string | null
          sender_type: string
          whatsapp_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction?: string
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          sender_type?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          sender_type?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          pages: Json
          prompt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          pages?: Json
          prompt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          pages?: Json
          prompt?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      retreats: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          description_ar: string | null
          description_en: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          location: string | null
          max_capacity: number | null
          price: number
          start_date: string | null
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description_ar?: string | null
          description_en?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          location?: string | null
          max_capacity?: number | null
          price?: number
          start_date?: string | null
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description_ar?: string | null
          description_en?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          location?: string | null
          max_capacity?: number | null
          price?: number
          start_date?: string | null
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_data: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          phone_number: string | null
          qr_code: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          phone_number?: string | null
          qr_code?: string | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          phone_number?: string | null
          qr_code?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
