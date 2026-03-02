-- Add columns for regrade feature
-- Run this in Supabase SQL Editor

-- Track whether teacher manually edited the grade (protects from regrade)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS manually_edited BOOLEAN DEFAULT false;

-- Store pre-regrade scores for before/after comparison
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS pre_regrade_score TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS pre_regrade_feedback TEXT;
