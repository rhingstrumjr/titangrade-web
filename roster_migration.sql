-- Create roster_students table
CREATE TABLE IF NOT EXISTS roster_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: RLS policies should ensure that students can only be added/viewed by the teacher who owns the class.
-- Currently running without strict auth.
