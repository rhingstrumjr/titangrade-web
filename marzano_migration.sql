-- Run this in your Supabase SQL Editor to add the new grading framework column

ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS grading_framework TEXT DEFAULT 'standard';
