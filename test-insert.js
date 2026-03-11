const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Using service key to bypass RLS for a raw test just to see DB schema errors, if any.
// Actually, let's use service key if it's there, else anon.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

const supabase = createClient(supabaseUrl, key);

async function test() {
  const { data, error } = await supabase.from('assignments').insert([{
    title: 'Test Assignment Debug',
    class_id: '123e4567-e89b-12d3-a456-426614174000', // valid UUID format placeholder
    grading_framework: 'standard',
    max_score: 100,
    max_attempts: 1,
    feedback_release_mode: 'immediate',
    is_socratic: true,
    description: 'Test description'
  }]).select();

  if (error) {
    console.error('INSERT ERROR:', error);
  } else {
    console.log('INSERT SUCCESS:', data);
  }
}
test();
