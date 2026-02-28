-- Add max_attempts column to assignments table, default to 1
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1;
