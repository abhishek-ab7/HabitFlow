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
          xp: number;
          level: number;
          gems: number;
          streak_shield: number;
          avatar_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_name?: string | null;
          week_start_day?: number;
          default_category?: string;
          created_at?: string;
          updated_at?: string;
          xp?: number;
          level?: number;
          gems?: number;
          streak_shield?: number;
          avatar_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_name?: string | null;
          week_start_day?: number;
          default_category?: string;
          created_at?: string;
          updated_at?: string;
          xp?: number;
          level?: number;
          gems?: number;
          streak_shield?: number;
          avatar_id?: string | null;
        };
      };
      finance_categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          type: string;
          icon: string;
          color: string;
          monthly_budget_limit: number;
          subcategories: Json;
          order_index: number;
          is_system: boolean;
          is_archived: boolean;
          generation_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug: string;
          type?: string;
          icon?: string;
          color?: string;
          monthly_budget_limit?: number;
          subcategories?: Json;
          order_index?: number;
          is_system?: boolean;
          is_archived?: boolean;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          slug?: string;
          type?: string;
          icon?: string;
          color?: string;
          monthly_budget_limit?: number;
          subcategories?: Json;
          order_index?: number;
          is_system?: boolean;
          is_archived?: boolean;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      finance_accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          balance: number;
          currency: string;
          color: string;
          icon: string;
          is_default: boolean;
          is_archived: boolean;
          generation_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          balance?: number;
          currency?: string;
          color?: string;
          icon?: string;
          is_default?: boolean;
          is_archived?: boolean;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          balance?: number;
          currency?: string;
          color?: string;
          icon?: string;
          is_default?: boolean;
          is_archived?: boolean;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      finance_transactions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          amount: number;
          type: string;
          category_id: string;
          subcategory: string | null;
          account_id: string;
          to_account_id: string | null;
          date: string;
          month_key: string;
          notes: string | null;
          tags: string[] | null;
          is_recurring: boolean;
          recurrence_rule: string | null;
          linked_commitment_id: string | null;
          commitment_contribution_type: string | null;
          linked_debt_id: string | null;
          linked_debt_installment_id: string | null;
          linked_emi_id: string | null;
          generation_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          amount: number;
          type: string;
          category_id: string;
          subcategory?: string | null;
          account_id: string;
          to_account_id?: string | null;
          date: string;
          month_key: string;
          notes?: string | null;
          tags?: string[] | null;
          is_recurring?: boolean;
          recurrence_rule?: string | null;
          linked_commitment_id?: string | null;
          commitment_contribution_type?: string | null;
          linked_debt_id?: string | null;
          linked_debt_installment_id?: string | null;
          linked_emi_id?: string | null;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          amount?: number;
          type?: string;
          category_id?: string;
          subcategory?: string | null;
          account_id?: string;
          to_account_id?: string | null;
          date?: string;
          month_key?: string;
          notes?: string | null;
          tags?: string[] | null;
          is_recurring?: boolean;
          recurrence_rule?: string | null;
          linked_commitment_id?: string | null;
          commitment_contribution_type?: string | null;
          linked_debt_id?: string | null;
          linked_debt_installment_id?: string | null;
          linked_emi_id?: string | null;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      finance_budgets: {
        Row: {
          id: string;
          user_id: string;
          month_key: string;
          total_budget: number;
          expected_income: number;
          currency: string;
          notes: string | null;
          generation_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_key: string;
          total_budget: number;
          expected_income?: number;
          currency?: string;
          notes?: string | null;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month_key?: string;
          total_budget?: number;
          expected_income?: number;
          currency?: string;
          notes?: string | null;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      monthly_commitments: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          recipient_name: string;
          relationship: string;
          monthly_target_amount: number;
          due_day_of_month: number;
          category: string;
          default_category_id: string | null;
          auto_rollover_overpayment: boolean;
          icon: string;
          color: string;
          is_active: boolean;
          notes: string | null;
          generation_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          recipient_name: string;
          relationship: string;
          monthly_target_amount: number;
          due_day_of_month?: number;
          category?: string;
          default_category_id?: string | null;
          auto_rollover_overpayment?: boolean;
          icon?: string;
          color?: string;
          is_active?: boolean;
          notes?: string | null;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          recipient_name?: string;
          relationship?: string;
          monthly_target_amount?: number;
          due_day_of_month?: number;
          category?: string;
          default_category_id?: string | null;
          auto_rollover_overpayment?: boolean;
          icon?: string;
          color?: string;
          is_active?: boolean;
          notes?: string | null;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      debt_records: {
        Row: {
          id: string;
          user_id: string;
          person_name: string;
          contact_info: string | null;
          direction: string;
          title: string;
          principal_amount: number;
          total_repaid_amount: number;
          remaining_amount: number;
          start_date: string;
          target_settlement_date: string | null;
          repayment_schedule: string;
          planned_monthly_installment: number | null;
          due_day_of_month: number | null;
          status: string;
          notes: string | null;
          color: string;
          generation_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          person_name: string;
          contact_info?: string | null;
          direction: string;
          title: string;
          principal_amount: number;
          total_repaid_amount?: number;
          remaining_amount: number;
          start_date: string;
          target_settlement_date?: string | null;
          repayment_schedule?: string;
          planned_monthly_installment?: number | null;
          due_day_of_month?: number | null;
          status?: string;
          notes?: string | null;
          color?: string;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          person_name?: string;
          contact_info?: string | null;
          direction?: string;
          title?: string;
          principal_amount?: number;
          total_repaid_amount?: number;
          remaining_amount?: number;
          start_date?: string;
          target_settlement_date?: string | null;
          repayment_schedule?: string;
          planned_monthly_installment?: number | null;
          due_day_of_month?: number | null;
          status?: string;
          notes?: string | null;
          color?: string;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      debt_installments: {
        Row: {
          id: string;
          user_id: string;
          debt_id: string;
          amount: number;
          date: string;
          month_key: string;
          payment_method: string;
          transaction_id: string | null;
          note: string | null;
          balance_after_payment: number;
          generation_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          debt_id: string;
          amount: number;
          date: string;
          month_key: string;
          payment_method: string;
          transaction_id?: string | null;
          note?: string | null;
          balance_after_payment: number;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          debt_id?: string;
          amount?: number;
          date?: string;
          month_key?: string;
          payment_method?: string;
          transaction_id?: string | null;
          note?: string | null;
          balance_after_payment?: number;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      emi_trackers: {
        Row: {
          id: string;
          user_id: string;
          loan_name: string;
          lender_name: string;
          principal_amount: number;
          interest_rate_annual: number;
          emi_amount: number;
          tenure_months: number;
          paid_months: number;
          start_date: string;
          billing_day_of_month: number;
          category_id: string;
          account_id: string | null;
          auto_create_task_reminder: boolean;
          last_paid_month_key: string | null;
          status: string;
          notes: string | null;
          generation_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          loan_name: string;
          lender_name: string;
          principal_amount: number;
          interest_rate_annual?: number;
          emi_amount: number;
          tenure_months: number;
          paid_months?: number;
          start_date: string;
          billing_day_of_month?: number;
          category_id: string;
          account_id?: string | null;
          auto_create_task_reminder?: boolean;
          last_paid_month_key?: string | null;
          status?: string;
          notes?: string | null;
          generation_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          loan_name?: string;
          lender_name?: string;
          principal_amount?: number;
          interest_rate_annual?: number;
          emi_amount?: number;
          tenure_months?: number;
          paid_months?: number;
          start_date?: string;
          billing_day_of_month?: number;
          category_id?: string;
          account_id?: string | null;
          auto_create_task_reminder?: boolean;
          last_paid_month_key?: string | null;
          status?: string;
          notes?: string | null;
          generation_counter?: number;
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
