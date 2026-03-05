import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const { courseId, courseWorkId, grades } = await req.json();

    if (!courseId || !courseWorkId || !grades || !Array.isArray(grades)) {
      return NextResponse.json({ error: 'Missing required fields: courseId, courseWorkId, or grades array' }, { status: 400 });
    }

    const results = [];

    // grades should be an array of: { gcSubmissionId: string, assignedGrade: number }
    for (const grade of grades) {
      const { gcSubmissionId, assignedGrade } = grade;

      if (!gcSubmissionId || assignedGrade === undefined) {
        results.push({ gcSubmissionId, status: 'error', error: 'Missing submission ID or grade' });
        continue;
      }

      // Google Classroom API allows updating draftGrade and assignedGrade
      // Read docs: https://developers.google.com/classroom/reference/rest/v1/courses.courseWork.studentSubmissions/patch
      const response = await fetch(
        `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${gcSubmissionId}?updateMask=draftGrade,assignedGrade`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            draftGrade: assignedGrade,
            assignedGrade: assignedGrade // Publishing it directly to the student
          }),
        }
      );

      if (!response.ok) {
        let errorData = 'Unknown error';
        try {
          const err = await response.json();
          errorData = err.error?.message || JSON.stringify(err);
        } catch (e) { /* ignore parse error */ }

        results.push({
          gcSubmissionId,
          status: 'error',
          error: `Classroom API error: ${response.statusText} - ${errorData}`
        });
      } else {
        results.push({ gcSubmissionId, status: 'success' });
      }
    }

    const failures = results.filter(r => r.status === 'error');
    if (failures.length > 0) {
      return NextResponse.json({ message: `Processed grades with ${failures.length} errors`, results }, { status: 207 }); // Multi-status
    }

    return NextResponse.json({ message: 'Successfully returned all grades', results }, { status: 200 });

  } catch (err: any) {
    console.error('Error in /api/classroom/return-grades:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
