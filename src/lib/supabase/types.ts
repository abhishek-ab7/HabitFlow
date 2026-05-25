export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          icon: string;
          color: string;
          category: string;
          frequency: Json;
          target_days: number;
          reminder_time: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          icon?: string;
          color?: string;
          category?: string;
          frequency?: Json;
          target_days?: number;
          reminder_time?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          icon?: string;
          color?: string;
          category?: string;
          frequency?: Json;
          target_days?: number;
          reminder_time?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      completions: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          date: string;
          completed: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          date: string;
          completed?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          habit_id?: string;
          date?: string;
          completed?: boolean;
          notes?: string | null;
          created_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          category: string;
          priority: string;
          status: string;
          target_date: string | null;
          progress: number;
          is_focus: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          category?: string;
          priority?: string;
          status?: string;
          target_date?: string | null;
          progress?: number;
          is_focus?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          category?: string;
          priority?: string;
          status?: string;
          target_date?: string | null;
          progress?: number;
          is_focus?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      milestones: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string;
          title: string;
          is_completed: boolean;
          completed_at: string | null;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id: string;
          title: string;
          is_completed?: boolean;
          completed_at?: string | null;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string;
          title?: string;
          is_completed?: boolean;
          completed_at?: string | null;
          order_index?: number;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          due_date: string | null;
          goal_id: string | null;
          parent_task_id: string | null;
          depth: number;
          tags: string[] | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
          goal_id?: string | null;
          parent_task_id?: string | null;
          depth?: number;
          tags?: string[] | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
          goal_id?: string | null;
          parent_task_id?: string | null;
          depth?: number;
          tags?: string[] | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      routine_completions: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string;
          date: string;
          completed: boolean;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          routine_id: string;
          date: string;
          completed?: boolean;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          routine_id?: string;
          date?: string;
          completed?: boolean;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      routines: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          trigger_type: string;
          trigger_value: string | null;
          is_active: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          trigger_type?: string;
          trigger_value?: string | null;
          is_active?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          trigger_type?: string;
          trigger_value?: string | null;
          is_active?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      habit_routines: {
        Row: {
          id: string;
          habit_id: string;
          routine_id: string;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          habit_id: string;
          routine_id: string;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          habit_id?: string;
          routine_id?: string;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          user_name: string | null;
          week_start_day: number;
          default_category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_name?: string | null;
          week_start_day?: number;
          default_category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_name?: string | null;
          week_start_day?: number;
          default_category?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
