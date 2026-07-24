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
      clients: {
        Row: {
          access_token: string
          avatar_url: string | null
          created_at: string
          id: string
          instagram_handle: string
          name: string
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          access_token?: string
          avatar_url?: string | null
          created_at?: string
          id?: string
          instagram_handle: string
          name: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          access_token?: string
          avatar_url?: string | null
          created_at?: string
          id?: string
          instagram_handle?: string
          name?: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: []
      }
      delivery_slots: {
        Row: {
          client: string
          created_at: string
          done: boolean
          folder_link: string
          id: string
          slot_date: string
          slot_index: number
          title: string
          updated_at: string
        }
        Insert: {
          client?: string
          created_at?: string
          done?: boolean
          folder_link?: string
          id?: string
          slot_date: string
          slot_index: number
          title?: string
          updated_at?: string
        }
        Update: {
          client?: string
          created_at?: string
          done?: boolean
          folder_link?: string
          id?: string
          slot_date?: string
          slot_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      design_slots: {
        Row: {
          briefing: string
          client: string
          copy: string
          created_at: string
          done: boolean
          folder_link: string
          id: string
          references_images: string[]
          slot_date: string
          slot_index: number
          title: string
          updated_at: string
        }
        Insert: {
          briefing?: string
          client?: string
          copy?: string
          created_at?: string
          done?: boolean
          folder_link?: string
          id?: string
          references_images?: string[]
          slot_date: string
          slot_index: number
          title?: string
          updated_at?: string
        }
        Update: {
          briefing?: string
          client?: string
          copy?: string
          created_at?: string
          done?: boolean
          folder_link?: string
          id?: string
          references_images?: string[]
          slot_date?: string
          slot_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_adjustment_points: {
        Row: {
          created_at: string
          frame_url: string | null
          id: string
          note: string
          post_id: string
          time_seconds: number
        }
        Insert: {
          created_at?: string
          frame_url?: string | null
          id?: string
          note?: string
          post_id: string
          time_seconds: number
        }
        Update: {
          created_at?: string
          frame_url?: string | null
          id?: string
          note?: string
          post_id?: string
          time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_adjustment_points_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          kind: string
          position: number
          post_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          position?: number
          post_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          position?: number
          post_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string
          client_comment: string | null
          client_id: string
          cover_url: string | null
          created_at: string
          id: string
          linked_delivery_slot_id: string | null
          linked_design_slot_id: string | null
          midia_arquivada: boolean
          responded_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["post_status"]
          type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        Insert: {
          caption?: string
          client_comment?: string | null
          client_id: string
          cover_url?: string | null
          created_at?: string
          id?: string
          linked_delivery_slot_id?: string | null
          linked_design_slot_id?: string | null
          midia_arquivada?: boolean
          responded_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["post_status"]
          type: Database["public"]["Enums"]["post_type"]
          updated_at?: string
        }
        Update: {
          caption?: string
          client_comment?: string | null
          client_id?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          linked_delivery_slot_id?: string | null
          linked_design_slot_id?: string | null
          midia_arquivada?: boolean
          responded_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["post_status"]
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_delivery_slot_id_fkey"
            columns: ["linked_delivery_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_design_slot_id_fkey"
            columns: ["linked_design_slot_id"]
            isOneToOne: false
            referencedRelation: "design_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          participants: string[]
          start_time: string
          status: string
          task_date: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          participants?: string[]
          start_time: string
          status?: string
          task_date: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          participants?: string[]
          start_time?: string
          status?: string
          task_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      app_role: "admin" | "designer" | "editor"
      client_status: "active" | "inactive"
      post_status:
        | "planning"
        | "pending"
        | "approved"
        | "rejected"
        | "ready_for_review"
      post_type: "static" | "carousel" | "video"
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
      app_role: ["admin", "designer", "editor"],
      client_status: ["active", "inactive"],
      post_status: [
        "planning",
        "pending",
        "approved",
        "rejected",
        "ready_for_review",
      ],
      post_type: ["static", "carousel", "video"],
    },
  },
} as const
