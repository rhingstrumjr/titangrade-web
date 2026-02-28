-- Migration: Add Array Columns for Multi-File Uploads

-- 1. Add new array columns to the assignments table
ALTER TABLE public.assignments 
ADD COLUMN rubrics text[],
ADD COLUMN exemplar_urls text[];

-- 2. Migrate existing single-file data into the new array columns
UPDATE public.assignments 
SET rubrics = ARRAY[rubric] 
WHERE rubric IS NOT NULL;

UPDATE public.assignments 
SET exemplar_urls = ARRAY[exemplar_url] 
WHERE exemplar_url IS NOT NULL;

-- 3. Add new array column to the submissions table
ALTER TABLE public.submissions 
ADD COLUMN file_urls text[];

-- 4. Migrate existing single-file submissions into the new array column
UPDATE public.submissions 
SET file_urls = ARRAY[file_url] 
WHERE file_url IS NOT NULL;

-- Note: We are keeping the old columns (rubric, exemplar_url, file_url) temporarily 
-- so the app doesn't crash during deployment. We can drop them later once we confirm 
-- the new columns are working perfectly.
