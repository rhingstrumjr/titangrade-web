-- Add generated_key column to assignments table
ALTER TABLE assignments
ADD COLUMN generated_key JSONB;
