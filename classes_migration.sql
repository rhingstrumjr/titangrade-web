-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add class_id to assignments table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

-- Note: In a production environment with RLS, you would associate classes with a specific teacher (user_id).
-- Since we are currently running without strict auth, we will keep it simple.
