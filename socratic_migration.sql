-- Add is_socratic column to assignments table, default to false
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS is_socratic BOOLEAN NOT NULL DEFAULT FALSE;
