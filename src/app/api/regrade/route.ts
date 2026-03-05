import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { gradeSubmission } from '@/lib/grading';
import { buildBreakdownHtml } from '@/lib/email-helpers';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const { assignmentId, submissionIds } = await req.json();

    if (!assignmentId) {
      return NextResponse.json({ error: 'Missing assignmentId' }, { status: 400 });
    }

    // 1. Fetch the assignment
    const { data: assignment, error: assignError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (assignError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // 2. Fetch eligible submissions for regrading
    // Eligible = graded + not exemplar + not manually edited
    let query = supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('status', 'graded')
      .eq('is_exemplar', false)
      .eq('manually_edited', false);

    // If specific IDs were provided, filter to just those
    if (submissionIds && Array.isArray(submissionIds) && submissionIds.length > 0) {
      query = query.in('id', submissionIds);
    }

    const { data: submissions, error: fetchError } = await query;

    if (fetchError) {
      console.error('Failed to fetch submissions for regrade:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No eligible submissions to regrade' });
    }

    // 3. Regrade each submission
    const results: { id: string; oldScore: string; newScore: string; success: boolean; error?: string; estCost?: number }[] = [];

    for (const sub of submissions) {
      try {
        const activeFileUrls = sub.file_urls && sub.file_urls.length > 0
          ? sub.file_urls
          : [sub.file_url];

        // Grade using the shared module (picks up current exemplars automatically)
        const result = await gradeSubmission(activeFileUrls, assignment);

        // Store the old score/feedback before overwriting
        const oldScore = sub.score || '';
        const oldFeedback = sub.feedback || '';

        // Calculate the new cumulative cost 
        const oldCost = Number(sub.ai_cost) || 0;
        const newCumulativeCost = oldCost + (result.estCost || 0);

        // Update the submission with new grade + preserve old grade
        const { error: updateError } = await supabase
          .from('submissions')
          .update({
            status: 'graded',
            pre_regrade_score: oldScore,
            pre_regrade_feedback: oldFeedback,
            score: result.Score,
            feedback: result.Feedback,
            category_scores: result.CategoryScores || null,
            skill_assessments: result.SkillAssessments || null,
            ai_cost: newCumulativeCost,
          })
          .eq('id', sub.id);

        if (updateError) {
          console.error(`Failed to update submission ${sub.id}:`, updateError);
          results.push({ id: sub.id, oldScore, newScore: result.Score, success: false, error: updateError.message });
          continue;
        }

        // If the original grade was already emailed, send an "Updated Grade" email
        if (sub.email_sent) {
          try {
            const breakdownHtml = buildBreakdownHtml(result.CategoryScores, result.SkillAssessments);
            await resend.emails.send({
              from: 'TitanGrade <teacher@titangrade.org>',
              to: [sub.student_email],
              subject: `Updated Grade for ${assignment.title} — Improved AI Feedback`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                  <h2 style="color: #4f46e5;">TitanGrade — Updated Grade</h2>
                  <p>Hello ${sub.student_name},</p>
                  <p>Your teacher has refined the AI grading for <strong>${assignment.title}</strong> using additional calibration examples. Here is your updated feedback:</p>
                  
                  <div style="background-color: #eef2ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #4f46e5;">
                    <p style="margin: 0; font-size: 14px; color: #6366f1;">Previous Score: <strong>${oldScore}</strong></p>
                    <h1 style="margin: 8px 0 0 0; color: #111827;">Updated Score: ${result.Score}</h1>
                  </div>

                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-bottom: 5px;">Updated Feedback:</h3>
                    <p style="margin-top: 0; line-height: 1.5;">${result.Feedback}</p>
                    
                    ${breakdownHtml}
                  </div>
                  
                  <p style="font-size: 13px; color: #6b7280;">
                    <em>Why did my grade change? Your teacher trained the AI with additional graded examples to improve accuracy. This updated score better reflects the teacher's grading standards.</em>
                  </p>
                  
                  <p>Keep experimenting,<br/>Your Science Teacher</p>
                </div>
              `,
            });
          } catch (emailErr: unknown) {
            const err = emailErr as Error;
            console.error(`Failed to send updated email to ${sub.student_email}:`, err);
          }
        }

        results.push({ id: sub.id, oldScore, newScore: result.Score, success: true, estCost: result.estCost });

      } catch (gradeErr: unknown) {
        const err = gradeErr as Error;
        console.error(`Regrade failed for submission ${sub.id}:`, err);
        results.push({ id: sub.id, oldScore: sub.score || '', newScore: '', success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      count: successCount,
      failures: failCount,
      results,
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Regrade API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
