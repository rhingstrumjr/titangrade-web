-- Add is_exemplar column to submissions table
ALTER TABLE submissions ADD COLUMN is_exemplar BOOLEAN DEFAULT false;
