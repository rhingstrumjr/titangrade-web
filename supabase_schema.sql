-- Supabase Schema for TitanGrade MVP

-- 1. Create Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  max_score INTEGER NOT NULL,
  rubric TEXT NOT NULL,
  grading_framework TEXT DEFAULT 'standard',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Public URL of the uploaded file
  status TEXT DEFAULT 'pending', -- pending, graded, error
  score TEXT, -- e.g., "85/100" or "3.5/4.0"
  feedback TEXT, -- AI generated feedback
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
