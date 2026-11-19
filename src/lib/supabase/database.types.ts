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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scope: string
          token_hash: string
          token_hint: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scope: string
          token_hash: string
          token_hint: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scope?: string
          token_hash?: string
          token_hint?: string
          user_id?: string
        }
        Relationships: []
      }
      class_meetings: {
        Row: {
          class_id: string
          created_at: string
          day_label: string | null
          ends_at: string
          id: string
          room: string | null
          starts_at: string
          user_id: string
          weekday: number | null
        }
        Insert: {
          class_id: string
          created_at?: string
          day_label?: string | null
          ends_at: string
          id?: string
          room?: string | null
          starts_at: string
          user_id?: string
          weekday?: number | null
        }
        Update: {
          class_id?: string
          created_at?: string
          day_label?: string | null
          ends_at?: string
          id?: string
          room?: string | null
          starts_at?: string
          user_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_meetings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          room: string | null
          short_names: string[]
          teacher: string | null
          term_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          room?: string | null
          short_names?: string[]
          teacher?: string | null
          term_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          room?: string | null
          short_names?: string[]
          teacher?: string | null
          term_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      day_plans: {
        Row: {
          created_at: string
          focus_task_ids: string[]
          id: string
          intention: string | null
          on_date: string
          planned_at: string | null
          shutdown_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus_task_ids?: string[]
          id?: string
          intention?: string | null
          on_date: string
          planned_at?: string | null
          shutdown_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          focus_task_ids?: string[]
          id?: string
          intention?: string | null
          on_date?: string
          planned_at?: string | null
          shutdown_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          category: string
          created_at: string
          deleted_at: string | null
          ends_at: string
          id: string
          location: string | null
          repeat: Json | null
          source: string
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          category?: string
          created_at?: string
          deleted_at?: string | null
          ends_at: string
          id?: string
          location?: string | null
          repeat?: Json | null
          source?: string
          starts_at: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          all_day?: boolean
          category?: string
          created_at?: string
          deleted_at?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          repeat?: Json | null
          source?: string
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          bodyweight: boolean
          created_at: string
          id: string
          muscle: string
          name: string
          user_id: string | null
        }
        Insert: {
          bodyweight?: boolean
          created_at?: string
          id?: string
          muscle?: string
          name: string
          user_id?: string | null
        }
        Update: {
          bodyweight?: boolean
          created_at?: string
          id?: string
          muscle?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      files: {
        Row: {
          class_id: string | null
          created_at: string
          deleted_at: string | null
          extracted_text: string | null
          filename: string
          id: string
          kind: string
          mime_type: string
          size_bytes: number
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          extracted_text?: string | null
          filename: string
          id?: string
          kind?: string
          mime_type: string
          size_bytes: number
          status?: string
          storage_path: string
          user_id?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          extracted_text?: string | null
          filename?: string
          id?: string
          kind?: string
          mime_type?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      food_entries: {
        Row: {
          calories: number | null
          created_at: string
          id: string
          name: string
          on_date: string
          protein_g: number | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          created_at?: string
          id?: string
          name: string
          on_date: string
          protein_g?: number | null
          user_id?: string
        }
        Update: {
          calories?: number | null
          created_at?: string
          id?: string
          name?: string
          on_date?: string
          protein_g?: number | null
          user_id?: string
        }
        Relationships: []
      }
      grade_categories: {
        Row: {
          class_id: string
          created_at: string
          id: string
          name: string
          user_id: string
          weight: number
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          name: string
          user_id?: string
          weight: number
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_categories_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          category_id: string | null
          class_id: string
          created_at: string
          id: string
          is_what_if: boolean
          points_earned: number
          points_possible: number
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          class_id: string
          created_at?: string
          id?: string
          is_what_if?: boolean
          points_earned: number
          points_possible: number
          task_id?: string | null
          title: string
          user_id?: string
        }
        Update: {
          category_id?: string | null
          class_id?: string
          created_at?: string
          id?: string
          is_what_if?: boolean
          points_earned?: number
          points_possible?: number
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "grade_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_checkins: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          on_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          on_date: string
          user_id?: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          on_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_checkins_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          deleted_at: string | null
          emoji: string | null
          id: string
          name: string
          sort: number
          started_on: string
          target_per: string
          target_times: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          deleted_at?: string | null
          emoji?: string | null
          id?: string
          name: string
          sort?: number
          started_on?: string
          target_per?: string
          target_times?: number
          user_id?: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          deleted_at?: string | null
          emoji?: string | null
          id?: string
          name?: string
          sort?: number
          started_on?: string
          target_per?: string
          target_times?: number
          user_id?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          batch_id: string | null
          client_id: string | null
          confidence: number
          created_at: string
          deleted_at: string | null
          draft: Json
          id: string
          problems: string[]
          raw_text: string
          result_id: string | null
          result_table: string | null
          source: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          client_id?: string | null
          confidence?: number
          created_at?: string
          deleted_at?: string | null
          draft?: Json
          id?: string
          problems?: string[]
          raw_text: string
          result_id?: string | null
          result_table?: string | null
          source?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          batch_id?: string | null
          client_id?: string | null
          confidence?: number
          created_at?: string
          deleted_at?: string | null
          draft?: Json
          id?: string
          problems?: string[]
          raw_text?: string
          result_id?: string | null
          result_table?: string | null
          source?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          body: string
          created_at: string
          id: string
          mood: number | null
          on_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          mood?: number | null
          on_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mood?: number | null
          on_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      money_transactions: {
        Row: {
          amount_cents: number
          category: string
          counterparty: string | null
          created_at: string
          deleted_at: string | null
          description: string
          external_id: string | null
          id: string
          notes: string | null
          occurred_on: string
          source: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          category?: string
          counterparty?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          occurred_on: string
          source?: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          category?: string
          counterparty?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          occurred_on?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      no_school_days: {
        Row: {
          created_at: string
          date: string
          id: string
          label: string | null
          term_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          label?: string | null
          term_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          label?: string | null
          term_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "no_school_days_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          kind: string
          local_date: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          local_date: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          local_date?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_save_types: string[]
          calorie_goal: number | null
          coins: number
          created_at: string
          display_name: string | null
          gym_next: number
          gym_split: string[]
          id: string
          liked_layouts: string[]
          notify_evening: string
          notify_morning: string
          study_end_time: string
          study_minutes: number[]
          theme: string
          timezone: string
          updated_at: string
          xp_total: number
        }
        Insert: {
          auto_save_types?: string[]
          calorie_goal?: number | null
          coins?: number
          created_at?: string
          display_name?: string | null
          gym_next?: number
          gym_split?: string[]
          id: string
          liked_layouts?: string[]
          notify_evening?: string
          notify_morning?: string
          study_end_time?: string
          study_minutes?: number[]
          theme?: string
          timezone?: string
          updated_at?: string
          xp_total?: number
        }
        Update: {
          auto_save_types?: string[]
          calorie_goal?: number | null
          coins?: number
          created_at?: string
          display_name?: string | null
          gym_next?: number
          gym_split?: string[]
          id?: string
          liked_layouts?: string[]
          notify_evening?: string
          notify_morning?: string
          study_end_time?: string
          study_minutes?: number[]
          theme?: string
          timezone?: string
          updated_at?: string
          xp_total?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_overrides: {
        Row: {
          created_at: string
          date: string
          id: string
          label: string | null
          no_school: boolean
          note: string | null
          schedule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          label?: string | null
          no_school?: boolean
          note?: string | null
          schedule_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          label?: string | null
          no_school?: boolean
          note?: string | null
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          anchor_date: string | null
          anchor_label: string | null
          created_at: string
          day_labels: string[]
          id: string
          kind: string
          school_weekdays: number[]
          term_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_date?: string | null
          anchor_label?: string | null
          created_at?: string
          day_labels?: string[]
          id?: string
          kind?: string
          school_weekdays?: number[]
          term_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          anchor_date?: string | null
          anchor_label?: string | null
          created_at?: string
          day_labels?: string[]
          id?: string
          kind?: string
          school_weekdays?: number[]
          term_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: true
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          area: string
          class_id: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          due_at: string | null
          due_has_time: boolean
          estimate_minutes: number | null
          id: string
          kind: string
          minutes_done: number
          nag_level: string
          notes: string | null
          priority: number
          repeat: Json | null
          series_id: string | null
          snoozed_until: string | null
          source: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string
          class_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          due_has_time?: boolean
          estimate_minutes?: number | null
          id?: string
          kind?: string
          minutes_done?: number
          nag_level?: string
          notes?: string | null
          priority?: number
          repeat?: Json | null
          series_id?: string | null
          snoozed_until?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          area?: string
          class_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          due_has_time?: boolean
          estimate_minutes?: number | null
          id?: string
          kind?: string
          minutes_done?: number
          nag_level?: string
          notes?: string | null
          priority?: number
          repeat?: Json | null
          series_id?: string | null
          snoozed_until?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          name: string
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          name: string
          starts_on: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          name?: string
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          task_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          task_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          task_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          created_at: string
          done: boolean
          exercise_id: string
          id: string
          position: number
          reps: number | null
          user_id: string
          weight_lb: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          exercise_id: string
          id?: string
          position?: number
          reps?: number | null
          user_id?: string
          weight_lb?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          exercise_id?: string
          id?: string
          position?: number
          reps?: number | null
          user_id?: string
          weight_lb?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          deleted_at: string | null
          ended_at: string | null
          id: string
          muscles: string[]
          name: string | null
          notes: string | null
          skipped: boolean
          split_day: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          muscles?: string[]
          name?: string | null
          notes?: string | null
          skipped?: boolean
          split_day?: string | null
          started_at?: string
          user_id?: string
        }
        Update: {
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          muscles?: string[]
          name?: string | null
          notes?: string | null
          skipped?: boolean
          split_day?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      notify_tick: { Args: never; Returns: undefined }
      purge_trash: { Args: never; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
