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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_panel_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          panel_key: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          panel_key: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          panel_key?: string
          user_id?: string
        }
        Relationships: []
      }
      analysis_feedback: {
        Row: {
          applied_at: string | null
          created_at: string
          feedback_text: string
          feedback_type: string
          file_name: string | null
          id: string
          original_analysis: Json
          part_name: string
          rating: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          feedback_text: string
          feedback_type?: string
          file_name?: string | null
          id?: string
          original_analysis: Json
          part_name: string
          rating?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          feedback_text?: string
          feedback_type?: string
          file_name?: string | null
          id?: string
          original_analysis?: Json
          part_name?: string
          rating?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coatings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      currency_rates: {
        Row: {
          created_at: string
          id: string
          is_forecast: boolean
          month: number
          rate_type: string
          source: string | null
          updated_at: string
          value: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_forecast?: boolean
          month: number
          rate_type: string
          source?: string | null
          updated_at?: string
          value: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_forecast?: boolean
          month?: number
          rate_type?: string
          source?: string | null
          updated_at?: string
          value?: number
          year?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          factory: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          specs: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          factory?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          specs?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          factory?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          specs?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      factories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          brand: string
          code: string
          created_at: string
          designation: string
          factory: string
          has_c_axis: boolean | null
          has_live_tooling: boolean | null
          has_y_axis: boolean | null
          id: string
          is_active: boolean
          label: string
          max_diameter_mm: number | null
          max_rpm: number | null
          minute_rate: number | null
          model: string
          power_kw: number | null
          sort_order: number
          taper: string | null
          travel_x_mm: number | null
          travel_y_mm: number | null
          travel_z_mm: number | null
          type: string
          updated_at: string
          year: number
        }
        Insert: {
          brand: string
          code: string
          created_at?: string
          designation: string
          factory?: string
          has_c_axis?: boolean | null
          has_live_tooling?: boolean | null
          has_y_axis?: boolean | null
          id?: string
          is_active?: boolean
          label: string
          max_diameter_mm?: number | null
          max_rpm?: number | null
          minute_rate?: number | null
          model: string
          power_kw?: number | null
          sort_order?: number
          taper?: string | null
          travel_x_mm?: number | null
          travel_y_mm?: number | null
          travel_z_mm?: number | null
          type: string
          updated_at?: string
          year?: number
        }
        Update: {
          brand?: string
          code?: string
          created_at?: string
          designation?: string
          factory?: string
          has_c_axis?: boolean | null
          has_live_tooling?: boolean | null
          has_y_axis?: boolean | null
          id?: string
          is_active?: boolean
          label?: string
          max_diameter_mm?: number | null
          max_rpm?: number | null
          minute_rate?: number | null
          model?: string
          power_kw?: number | null
          sort_order?: number
          taper?: string | null
          travel_x_mm?: number | null
          travel_y_mm?: number | null
          travel_z_mm?: number | null
          type?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      maintenance_checklist_logs: {
        Row: {
          checklist_results: Json
          completed_by: string
          completed_by_name: string | null
          completion_date: string
          created_at: string
          duration_minutes: number | null
          id: string
          machine_id: string
          notes: string | null
          schedule_id: string
        }
        Insert: {
          checklist_results?: Json
          completed_by: string
          completed_by_name?: string | null
          completion_date?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          machine_id: string
          notes?: string | null
          schedule_id: string
        }
        Update: {
          checklist_results?: Json
          completed_by?: string
          completed_by_name?: string | null
          completion_date?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          machine_id?: string
          notes?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_checklist_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_checklist_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          id: string
          machine_id: string
          maintenance_type: string
          notes: string | null
          parts_used: Json | null
          photos: Json | null
          priority: string
          scheduled_date: string | null
          status: string
          technician_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          machine_id: string
          maintenance_type?: string
          notes?: string | null
          parts_used?: Json | null
          photos?: Json | null
          priority?: string
          scheduled_date?: string | null
          status?: string
          technician_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          machine_id?: string
          maintenance_type?: string
          notes?: string | null
          parts_used?: Json | null
          photos?: Json | null
          priority?: string
          scheduled_date?: string | null
          status?: string
          technician_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          checklist: Json | null
          created_at: string
          created_by: string
          current_hours: number | null
          id: string
          interval_days: number | null
          interval_hours: number | null
          is_active: boolean
          last_performed_at: string | null
          last_performed_hours: number | null
          machine_id: string
          maintenance_type: string
          next_due_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          created_by: string
          current_hours?: number | null
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          is_active?: boolean
          last_performed_at?: string | null
          last_performed_hours?: number | null
          machine_id: string
          maintenance_type?: string
          next_due_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          created_by?: string
          current_hours?: number | null
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          is_active?: boolean
          last_performed_at?: string | null
          last_performed_hours?: number | null
          machine_id?: string
          maintenance_type?: string
          next_due_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      material_price_history: {
        Row: {
          change_type: string
          changed_by: string
          changed_by_name: string | null
          created_at: string
          id: string
          material_id: string
          new_afk_multiplier: number | null
          new_price: number | null
          old_afk_multiplier: number | null
          old_price: number | null
        }
        Insert: {
          change_type?: string
          changed_by: string
          changed_by_name?: string | null
          created_at?: string
          id?: string
          material_id: string
          new_afk_multiplier?: number | null
          new_price?: number | null
          old_afk_multiplier?: number | null
          old_price?: number | null
        }
        Update: {
          change_type?: string
          changed_by?: string
          changed_by_name?: string | null
          created_at?: string
          id?: string
          material_id?: string
          new_afk_multiplier?: number | null
          new_price?: number | null
          old_afk_multiplier?: number | null
          old_price?: number | null
        }
        Relationships: []
      }
      material_settings: {
        Row: {
          afk_multiplier: number | null
          created_at: string
          id: string
          material_id: string
          price_per_kg: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          afk_multiplier?: number | null
          created_at?: string
          id?: string
          material_id: string
          price_per_kg?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          afk_multiplier?: number | null
          created_at?: string
          id?: string
          material_id?: string
          price_per_kg?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          bg_color: string
          border_color: string
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          name_en: string | null
          name_fr: string | null
          sort_order: number
          text_color: string
          updated_at: string
        }
        Insert: {
          bg_color?: string
          border_color?: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          name_en?: string | null
          name_fr?: string | null
          sort_order?: number
          text_color?: string
          updated_at?: string
        }
        Update: {
          bg_color?: string
          border_color?: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          name_en?: string | null
          name_fr?: string | null
          sort_order?: number
          text_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_category_modules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          module_key: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          module_key: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          module_key?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_category_modules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      module_translations: {
        Row: {
          created_at: string
          id: string
          module_key: string
          name_en: string | null
          name_fr: string | null
          name_tr: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          name_en?: string | null
          name_fr?: string | null
          name_tr?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          name_en?: string | null
          name_fr?: string | null
          name_tr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          custom_title: string | null
          display_name: string | null
          id: string
          position: string | null
          title_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          custom_title?: string | null
          display_name?: string | null
          id?: string
          position?: string | null
          title_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          custom_title?: string | null
          display_name?: string | null
          id?: string
          position?: string | null
          title_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_results: {
        Row: {
          answers: Json | null
          created_at: string
          duration_seconds: number | null
          id: string
          level: string
          passed: boolean
          questions: Json | null
          score: number
          topic: string | null
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          level: string
          passed?: boolean
          questions?: Json | null
          score: number
          topic?: string | null
          total_questions: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          level?: string
          passed?: boolean
          questions?: Json | null
          score?: number
          topic?: string | null
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      saved_calculations: {
        Row: {
          calculation_type: string
          created_at: string
          id: string
          input_data: Json
          notes: string | null
          result_data: Json
          user_id: string
        }
        Insert: {
          calculation_type: string
          created_at?: string
          id?: string
          input_data: Json
          notes?: string | null
          result_data: Json
          user_id: string
        }
        Update: {
          calculation_type?: string
          created_at?: string
          id?: string
          input_data?: Json
          notes?: string | null
          result_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      saved_materials: {
        Row: {
          category: string
          created_at: string
          cutting_speed_max: number
          cutting_speed_min: number
          depth_of_cut_max: number
          depth_of_cut_min: number
          feed_rate_max: number
          feed_rate_min: number
          hardness_max: number | null
          hardness_min: number | null
          id: string
          name: string
          price_per_kg: number | null
          tool_life_factor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          cutting_speed_max: number
          cutting_speed_min: number
          depth_of_cut_max: number
          depth_of_cut_min: number
          feed_rate_max: number
          feed_rate_min: number
          hardness_max?: number | null
          hardness_min?: number | null
          id?: string
          name: string
          price_per_kg?: number | null
          tool_life_factor?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          cutting_speed_max?: number
          cutting_speed_min?: number
          depth_of_cut_max?: number
          depth_of_cut_min?: number
          feed_rate_max?: number
          feed_rate_min?: number
          hardness_max?: number | null
          hardness_min?: number | null
          id?: string
          name?: string
          price_per_kg?: number | null
          tool_life_factor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_improvements: {
        Row: {
          created_at: string
          customer_name: string
          factory: string
          id: string
          images: Json | null
          improvement_date: string
          improvement_details: string | null
          improvement_percent: number | null
          machine_id: string | null
          machine_name: string | null
          new_price: number | null
          new_time_minutes: number
          notes: string | null
          old_price: number | null
          old_time_minutes: number
          operation_type: string
          parameter_changes: string | null
          part_name: string
          price_improvement_percent: number | null
          reference_code: string
          tool_changes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          factory?: string
          id?: string
          images?: Json | null
          improvement_date?: string
          improvement_details?: string | null
          improvement_percent?: number | null
          machine_id?: string | null
          machine_name?: string | null
          new_price?: number | null
          new_time_minutes: number
          notes?: string | null
          old_price?: number | null
          old_time_minutes: number
          operation_type?: string
          parameter_changes?: string | null
          part_name: string
          price_improvement_percent?: number | null
          reference_code: string
          tool_changes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          factory?: string
          id?: string
          images?: Json | null
          improvement_date?: string
          improvement_details?: string | null
          improvement_percent?: number | null
          machine_id?: string | null
          machine_name?: string | null
          new_price?: number | null
          new_time_minutes?: number
          notes?: string | null
          old_price?: number | null
          old_time_minutes?: number
          operation_type?: string
          parameter_changes?: string | null
          part_name?: string
          price_improvement_percent?: number | null
          reference_code?: string
          tool_changes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_improvements_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          module_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          default_material_category: string | null
          default_unit: string | null
          id: string
          language: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_material_category?: string | null
          default_unit?: string | null
          id?: string
          language?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_material_category?: string | null
          default_unit?: string | null
          id?: string
          language?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      work_orders: {
        Row: {
          created_at: string
          customer_name: string | null
          due_date: string | null
          hourly_rate: number | null
          id: string
          material: string | null
          notes: string | null
          order_number: string
          part_name: string
          priority: string | null
          quantity: number
          status: string | null
          steps: Json
          total_cost: number | null
          total_time_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          due_date?: string | null
          hourly_rate?: number | null
          id?: string
          material?: string | null
          notes?: string | null
          order_number: string
          part_name: string
          priority?: string | null
          quantity?: number
          status?: string | null
          steps?: Json
          total_cost?: number | null
          total_time_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          due_date?: string | null
          hourly_rate?: number | null
          id?: string
          material?: string | null
          notes?: string | null
          order_number?: string
          part_name?: string
          priority?: string | null
          quantity?: number
          status?: string | null
          steps?: Json
          total_cost?: number | null
          total_time_minutes?: number | null
          updated_at?: string
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
