-- Migration: Add structured_rubric column to assignments table
-- The structured rubric stores JSON array of criteria: [{ name, maxPoints, description }]
-- Nullable so existing assignments with plain-text/file rubrics continue working

ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS structured_rubric JSONB DEFAULT NULL;
