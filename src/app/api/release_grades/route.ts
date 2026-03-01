import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const { assignmentId } = await req.json();

    if (!assignmentId) {
      return NextResponse.json({ error: 'Missing assignmentId' }, { status: 400 });
    }

    // 1. Fetch all graded submissions for this assignment that haven't had their email sent
    const { data: submissions, error: fetchError } = await supabase
      .from('submissions')
      .select('*, assignment:assignments(*)')
      .eq('assignment_id', assignmentId)
      .eq('status', 'graded')
      .eq('email_sent', false);

    if (fetchError) {
      console.error('Failed to fetch submissions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch unreleased submissions' }, { status: 500 });
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 2. Prepare the emails and the update promises
    const emailPromises = [];
    const updatePromises = [];

    for (const sub of submissions) {
      const { title, is_socratic } = sub.assignment;

      const emailPromise = resend.emails.send({
        from: 'TitanGrade <teacher@titangrade.org>',
        to: [sub.student_email],
        subject: `Your Grade for ${title} is ready!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #4f46e5;">TitanGrade Feedback</h2>
            <p>Hello ${sub.student_name},</p>
            <p>Great effort on <strong>${title}</strong>! Here is your personalized feedback from the AI:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h1 style="margin-top: 0; color: #111827;">Score: ${sub.score}</h1>
              <h3 style="margin-bottom: 5px;">Feedback:</h3>
              <p style="margin-top: 0; line-height: 1.5;">${sub.feedback}</p>
              
              ${!is_socratic ? `
              <p style="margin-top: 15px; font-size: 0.9em; color: #666;">
                <em>Note: Detailed grading breakdown is omitted for manual release.</em>
              </p>
              ` : ''}
            </div>
            
            <p>Remember: every scientist improves through iteration. Apply this feedback, and your next submission will be even stronger!</p>
            <br/>
            <p>Keep experimenting,<br/>Your Science Teacher</p>
          </div>
        `,
      });
      emailPromises.push(emailPromise);

      const updatePromise = supabase
        .from('submissions')
        .update({ email_sent: true })
        .eq('id', sub.id);
      updatePromises.push(updatePromise);
    }

    // 3. Execute all parallel requests
    await Promise.allSettled(emailPromises);
    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, count: submissions.length });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Release Grades API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
