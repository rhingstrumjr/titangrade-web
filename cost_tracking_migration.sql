-- Add ai_cost tracking to assignments and submissions tables

-- 1. Track cost of generated answer keys
ALTER TABLE assignments
ADD COLUMN ai_cost NUMERIC DEFAULT 0;

-- 2. Track cost of grading and regrading
ALTER TABLE submissions
ADD COLUMN ai_cost NUMERIC DEFAULT 0;
