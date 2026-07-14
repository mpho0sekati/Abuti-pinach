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
      agent_deals: {
        Row: {
          approval_state: string
          approved_at: string | null
          asking_price: number
          buyer_contact: string | null
          buyer_id: string | null
          buyer_name: string | null
          confidence: number | null
          created_at: string
          crop: string
          delivery_date: string | null
          executed_at: string | null
          farmer_name: string
          farmer_rating: number | null
          feedback_note: string | null
          id: string
          logistics_status: string | null
          negotiated_price: number | null
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          predicted_price: number | null
          quantity_kg: number | null
          recommendation: string | null
          session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approval_state?: string
          approved_at?: string | null
          asking_price: number
          buyer_contact?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          confidence?: number | null
          created_at?: string
          crop: string
          delivery_date?: string | null
          executed_at?: string | null
          farmer_name: string
          farmer_rating?: number | null
          feedback_note?: string | null
          id?: string
          logistics_status?: string | null
          negotiated_price?: number | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          predicted_price?: number | null
          quantity_kg?: number | null
          recommendation?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approval_state?: string
          approved_at?: string | null
          asking_price?: number
          buyer_contact?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          confidence?: number | null
          created_at?: string
          crop?: string
          delivery_date?: string | null
          executed_at?: string | null
          farmer_name?: string
          farmer_rating?: number | null
          feedback_note?: string | null
          id?: string
          logistics_status?: string | null
          negotiated_price?: number | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          predicted_price?: number | null
          quantity_kg?: number | null
          recommendation?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_permissions: {
        Row: {
          allow_logistics: boolean
          auto_negotiate: boolean
          created_at: string
          crops: string[] | null
          farmer_name: string
          id: string
          max_deal_value: number | null
          min_price_per_kg: number | null
          session_id: string | null
          updated_at: string
        }
        Insert: {
          allow_logistics?: boolean
          auto_negotiate?: boolean
          created_at?: string
          crops?: string[] | null
          farmer_name: string
          id?: string
          max_deal_value?: number | null
          min_price_per_kg?: number | null
          session_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_logistics?: boolean
          auto_negotiate?: boolean
          created_at?: string
          crops?: string[] | null
          farmer_name?: string
          id?: string
          max_deal_value?: number | null
          min_price_per_kg?: number | null
          session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      buyers: {
        Row: {
          active: boolean
          buyer_type: string
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          crops: string[]
          id: string
          max_price_per_kg: number | null
          max_volume_kg: number | null
          min_price_per_kg: number | null
          min_volume_kg: number | null
          name: string
          notes: string | null
          payment_terms: string | null
          region: string | null
          reliability_score: number | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          active?: boolean
          buyer_type?: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          crops?: string[]
          id?: string
          max_price_per_kg?: number | null
          max_volume_kg?: number | null
          min_price_per_kg?: number | null
          min_volume_kg?: number | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          region?: string | null
          reliability_score?: number | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          active?: boolean
          buyer_type?: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          crops?: string[]
          id?: string
          max_price_per_kg?: number | null
          max_volume_kg?: number | null
          min_price_per_kg?: number | null
          min_volume_kg?: number | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          region?: string | null
          reliability_score?: number | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          body: string
          created_at: string
          id: string
          province: string | null
          tag: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          province?: string | null
          tag?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          province?: string | null
          tag?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      community_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_logs: {
        Row: {
          ai_response: string
          channel: string
          created_at: string
          feedback: string | null
          feedback_at: string | null
          has_image: boolean | null
          id: string
          model_used: string | null
          session_id: string | null
          user_message: string
          user_name: string | null
        }
        Insert: {
          ai_response: string
          channel?: string
          created_at?: string
          feedback?: string | null
          feedback_at?: string | null
          has_image?: boolean | null
          id?: string
          model_used?: string | null
          session_id?: string | null
          user_message: string
          user_name?: string | null
        }
        Update: {
          ai_response?: string
          channel?: string
          created_at?: string
          feedback?: string | null
          feedback_at?: string | null
          has_image?: boolean | null
          id?: string
          model_used?: string | null
          session_id?: string | null
          user_message?: string
          user_name?: string | null
        }
        Relationships: []
      }
      crop_calendar: {
        Row: {
          created_at: string
          crop: string
          done: boolean
          due_date: string
          id: string
          task: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crop: string
          done?: boolean
          due_date: string
          id?: string
          task: string
          user_id: string
        }
        Update: {
          created_at?: string
          crop?: string
          done?: boolean
          due_date?: string
          id?: string
          task?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_outcomes: {
        Row: {
          actual_price: number | null
          created_at: string
          crop: string
          days_to_close: number | null
          deal_id: string
          farmer_name: string
          farmer_rating: number | null
          feedback_note: string | null
          id: string
          outcome: string
          predicted_confidence: number | null
          predicted_price: number | null
          recommendation: string | null
        }
        Insert: {
          actual_price?: number | null
          created_at?: string
          crop: string
          days_to_close?: number | null
          deal_id: string
          farmer_name: string
          farmer_rating?: number | null
          feedback_note?: string | null
          id?: string
          outcome: string
          predicted_confidence?: number | null
          predicted_price?: number | null
          recommendation?: string | null
        }
        Update: {
          actual_price?: number | null
          created_at?: string
          crop?: string
          days_to_close?: number | null
          deal_id?: string
          farmer_name?: string
          farmer_rating?: number | null
          feedback_note?: string | null
          id?: string
          outcome?: string
          predicted_confidence?: number | null
          predicted_price?: number | null
          recommendation?: string | null
        }
        Relationships: []
      }
      farm_ledger: {
        Row: {
          amount: number
          category: string
          created_at: string
          crop: string | null
          id: string
          kind: string
          note: string | null
          occurred_on: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          crop?: string | null
          id?: string
          kind: string
          note?: string | null
          occurred_on?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          crop?: string | null
          id?: string
          kind?: string
          note?: string | null
          occurred_on?: string
          user_id?: string
        }
        Relationships: []
      }
      farm_plans: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          due_date: string
          farmer_name: string | null
          id: string
          notes: string | null
          session_id: string | null
          status: string
          task_description: string | null
          task_title: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          due_date: string
          farmer_name?: string | null
          id?: string
          notes?: string | null
          session_id?: string | null
          status?: string
          task_description?: string | null
          task_title: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string
          farmer_name?: string | null
          id?: string
          notes?: string | null
          session_id?: string | null
          status?: string
          task_description?: string | null
          task_title?: string
        }
        Relationships: []
      }
      farmer_crop_stats: {
        Row: {
          avg_achieved_price: number | null
          avg_predicted_price: number | null
          avg_rating: number | null
          crop: string
          deals_closed: number
          deals_won: number
          farmer_name: string
          id: string
          prediction_accuracy: number | null
          updated_at: string
        }
        Insert: {
          avg_achieved_price?: number | null
          avg_predicted_price?: number | null
          avg_rating?: number | null
          crop: string
          deals_closed?: number
          deals_won?: number
          farmer_name: string
          id?: string
          prediction_accuracy?: number | null
          updated_at?: string
        }
        Update: {
          avg_achieved_price?: number | null
          avg_predicted_price?: number | null
          avg_rating?: number | null
          crop?: string
          deals_closed?: number
          deals_won?: number
          farmer_name?: string
          id?: string
          prediction_accuracy?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      farmer_details: {
        Row: {
          created_at: string
          crops: string[] | null
          farm_size_ha: number | null
          livestock: string[] | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crops?: string[] | null
          farm_size_ha?: number | null
          livestock?: string[] | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crops?: string[] | null
          farm_size_ha?: number | null
          livestock?: string[] | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      farmers: {
        Row: {
          created_at: string
          id: string
          last_login: string | null
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_login?: string | null
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          last_login?: string | null
          name?: string
          phone?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          category: Database["public"]["Enums"]["listing_category"]
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          photo_url: string | null
          price: number
          quantity: number | null
          seller_id: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["listing_category"]
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          photo_url?: string | null
          price: number
          quantity?: number | null
          seller_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["listing_category"]
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          photo_url?: string | null
          price?: number
          quantity?: number | null
          seller_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      livestock: {
        Row: {
          birth_date: string | null
          count: number
          created_at: string
          id: string
          last_health_check: string | null
          last_vaccination: string | null
          notes: string | null
          species: string
          tag: string | null
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          count?: number
          created_at?: string
          id?: string
          last_health_check?: string | null
          last_vaccination?: string | null
          notes?: string | null
          species: string
          tag?: string | null
          user_id: string
        }
        Update: {
          birth_date?: string | null
          count?: number
          created_at?: string
          id?: string
          last_health_check?: string | null
          last_vaccination?: string | null
          notes?: string | null
          species?: string
          tag?: string | null
          user_id?: string
        }
        Relationships: []
      }
      offer_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          offer_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          offer_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          offer_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          message: string | null
          parent_offer_id: string | null
          seller_id: string
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          parent_offer_id?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          parent_offer_id?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          language: string | null
          lat: number | null
          lng: number | null
          onboarded: boolean
          phone: string | null
          primary_role: Database["public"]["Enums"]["app_role"]
          province: string | null
          town: string | null
          updated_at: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          language?: string | null
          lat?: number | null
          lng?: number | null
          onboarded?: boolean
          phone?: string | null
          primary_role?: Database["public"]["Enums"]["app_role"]
          province?: string | null
          town?: string | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string | null
          lat?: number | null
          lng?: number | null
          onboarded?: boolean
          phone?: string | null
          primary_role?: Database["public"]["Enums"]["app_role"]
          province?: string | null
          town?: string | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      seller_details: {
        Row: {
          business_name: string | null
          categories: Database["public"]["Enums"]["listing_category"][] | null
          created_at: string
          delivery_radius_km: number | null
          description: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          categories?: Database["public"]["Enums"]["listing_category"][] | null
          created_at?: string
          delivery_radius_km?: number | null
          description?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          categories?: Database["public"]["Enums"]["listing_category"][] | null
          created_at?: string
          delivery_radius_km?: number | null
          description?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_ratings: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          listing_id: string | null
          seller_id: string
          stars: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          seller_id: string
          stars: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          seller_id?: string
          stars?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_ratings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
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
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "farmer" | "seller" | "buyer" | "admin"
      listing_category:
        | "produce"
        | "livestock"
        | "inputs"
        | "equipment"
        | "other"
      listing_status: "active" | "sold" | "paused"
      offer_status:
        | "pending"
        | "accepted"
        | "countered"
        | "declined"
        | "withdrawn"
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
      app_role: ["farmer", "seller", "buyer", "admin"],
      listing_category: [
        "produce",
        "livestock",
        "inputs",
        "equipment",
        "other",
      ],
      listing_status: ["active", "sold", "paused"],
      offer_status: [
        "pending",
        "accepted",
        "countered",
        "declined",
        "withdrawn",
      ],
    },
  },
} as const
