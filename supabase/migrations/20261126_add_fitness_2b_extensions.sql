-- =============================================================================
-- HabitFlow Phase 2B Extensions (Life OS: Derived Stock, Protein ROI & Low-Energy Mode)
-- Safe to run multiple times (idempotent IF NOT EXISTS guards).
-- =============================================================================

-- 1. Supplement Inventory: Protein ROI, deterministic stock offset, and Anchor time-block
ALTER TABLE public.supplement_inventory
  ADD COLUMN IF NOT EXISTS protein_per_serving_g NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS manual_adjustment NUMERIC(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anchor_block TEXT;

-- 2. Fitness Daily Logs: Minimum Viable Day (Low-Energy Mode) + Junk-Free override + Rested habit IDs
ALTER TABLE public.fitness_daily_logs
  ADD COLUMN IF NOT EXISTS low_energy_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS junk_free_override BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rested_habit_ids TEXT[] NOT NULL DEFAULT '{}';

-- 3. Fitness Profiles: Configurable Low-Energy Mode calorie ceiling & reduced steps target
ALTER TABLE public.fitness_profiles
  ADD COLUMN IF NOT EXISTS low_energy_calorie_ceiling INTEGER,
  ADD COLUMN IF NOT EXISTS low_energy_steps_target INTEGER NOT NULL DEFAULT 3500;

-- 4. Index for Anchor Routine grouping
CREATE INDEX IF NOT EXISTS idx_supplement_inventory_anchor
  ON public.supplement_inventory(user_id, anchor_block)
  WHERE is_active = true AND deleted_at IS NULL;

-- 5. Idempotent one-time backfill guard for pre-2B supplement rows
-- Ensures derived remaining servings (total_servings - consumed + manual_adjustment)
-- preserves legacy remaining_servings on untouched pre-2B inventory items.
UPDATE public.supplement_inventory
SET
  manual_adjustment = remaining_servings - total_servings,
  generation_counter = COALESCE(generation_counter, 1) + 1,
  updated_at = now()
WHERE manual_adjustment = 0
  AND remaining_servings IS NOT NULL
  AND remaining_servings < total_servings;
