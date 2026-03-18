import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { learning_target_id, description, resource_url } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('intervention_bank')
      .insert([{
        learning_target_id: learning_target_id || null,
        teacher_id: user.id,
        description: description.trim(),
        resource_url: resource_url || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Intervention bank insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, intervention: data });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Intervention Bank API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const learningTargetId = searchParams.get('learning_target_id');

    let query = supabase
      .from('intervention_bank')
      .select('*, learning_target:learning_targets(*, standard:standards(*))')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (learningTargetId) {
      query = query.eq('learning_target_id', learningTargetId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, interventions: data });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
