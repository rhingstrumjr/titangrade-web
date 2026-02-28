-- Run this in your Supabase SQL Editor to add the optional exemplar_url column

ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS exemplar_url TEXT;
