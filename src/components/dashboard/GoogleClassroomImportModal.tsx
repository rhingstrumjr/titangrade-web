import React, { useState, useEffect } from "react";
import { Loader2, XCircle, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Class, Assignment } from "@/types/dashboard";

interface GoogleClassroomImportModalProps {
  providerToken: string;
  classes: Class[];
  assignments: Assignment[];
  onClose: () => void;
  onImportComplete: () => void; // Call this if staying on page, though currently it redirects
}

export const GoogleClassroomImportModal: React.FC<GoogleClassroomImportModalProps> = ({
  providerToken,
  classes,
  assignments,
  onClose,
  onImportComplete
}) => {
  const supabase = createClient();
  const [gcCourses, setGcCourses] = useState<any[]>([]);
  const [selectedGcCourseId, setSelectedGcCourseId] = useState<string>("");
  const [gcAssignments, setGcAssignments] = useState<any[]>([]);
  const [selectedGcAssignmentId, setSelectedGcAssignmentId] = useState<string>("");
  const [isFetchingGc, setIsFetchingGc] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, [providerToken]);

  const fetchCourses = async () => {
    if (!providerToken) return;
    setIsFetchingGc(true);
    try {
      const res = await fetch("/api/classroom/courses", {
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      const data = await res.json();
      if (data.courses) {
        setGcCourses(data.courses);
      }
    } catch (err) {
      console.error("Failed to fetch courses", err);
    }
    setIsFetchingGc(false);
  };

  const handleFetchAssignments = async (courseId: string) => {
    setSelectedGcCourseId(courseId);
    setSelectedGcAssignmentId("");
    if (!courseId || !providerToken) return;
    
    setIsFetchingGc(true);
    try {
      const res = await fetch(`/api/classroom/assignments?courseId=${courseId}`, {
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      const data = await res.json();
      if (data.assignments) {
        setGcAssignments(data.assignments);
      }
    } catch (err) {
      console.error("Failed to fetch assignments", err);
    }
    setIsFetchingGc(false);
  };

  const executeImport = async () => {
    if (!selectedGcCourseId || !selectedGcAssignmentId || !providerToken) return;

    // Check if we already have this assignment imported
    const existing = assignments.find(a => a.gc_coursework_id === selectedGcAssignmentId);
    if (existing) {
      alert("This assignment is already imported. Redirecting to submissions...");
      window.location.href = `/teacher/assignments/${existing.id}`;
      return;
    }

    setIsImporting(true);

    try {
      // 1. Fetch metadata & submissions
      const res = await fetch("/api/classroom/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}` },
        body: JSON.stringify({ courseId: selectedGcCourseId, courseWorkId: selectedGcAssignmentId })
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      // 2. Auto-match GC course to TG class, or create one
      let matchedClassId: string | null = null;
      const matchedClass = classes.find(c => c.gc_course_id === selectedGcCourseId);
      if (matchedClass) {
        matchedClassId = matchedClass.id;
      } else {
        // Find the GC course name and auto-create a TG class
        const gcCourse = gcCourses.find((c: any) => c.id === selectedGcCourseId);
        const courseName = gcCourse?.name || "Imported Class";
        const { data: newClass, error: classErr } = await supabase.from('classes').insert([{
          name: courseName,
          gc_course_id: selectedGcCourseId,
        }]).select().single();
        if (!classErr && newClass) {
          matchedClassId = newClass.id;
        }
      }

      // 3. Create Assignment in DB
      let rubricText = data.assignment.description || "Edit assignment to add a detailed rubric.";

      const { data: newAssignment, error: assignError } = await supabase.from('assignments').insert([{
        title: data.assignment.title || "Imported Assignment",
        max_score: data.assignment.maxPoints || 100,
        rubric: rubricText,
        grading_framework: "standard",
        max_attempts: 1,
        class_id: matchedClassId,
        gc_course_id: selectedGcCourseId,
        gc_coursework_id: selectedGcAssignmentId
      }]).select().single();

      if (assignError) throw assignError;

      // 3.5 Auto-load students into roster
      if (data.students && data.students.length > 0 && matchedClassId) {
        const { data: existingRoster } = await supabase
          .from('roster_students')
          .select('email')
          .eq('class_id', matchedClassId);
        
        const existingEmails = new Set(existingRoster?.map(r => r.email) || []);
        
        const newStudents = data.students
          .filter((s: any) => s.email && !existingEmails.has(s.email))
          .map((s: any) => ({
            class_id: matchedClassId,
            name: s.name || "Unknown Student",
            email: s.email
          }));

        if (newStudents.length > 0) {
          const { error: rosterErr } = await supabase.from('roster_students').insert(newStudents);
          if (rosterErr) console.error("Error auto-loading roster:", rosterErr);
        }
      }

      // 4. Insert Submissions in DB as 'pending'
      const submissionsToInsert = data.submissions.map((sub: any) => ({
        assignment_id: newAssignment.id,
        student_name: sub.studentName,
        student_email: sub.studentEmail,
        status: "pending",
        gc_submission_id: sub.id,
        file_url: sub.driveFile ? `drive:${sub.driveFile.id}` : "",
      }));

      if (submissionsToInsert.length > 0) {
        const { error: subErr } = await supabase.from('submissions').insert(submissionsToInsert);
        if (subErr) throw subErr;
      }

      // 5. Redirect to Submissions page
      window.location.href = `/teacher/assignments/${newAssignment.id}`;
      return; // Stop execution, leaving loading state until redirect finishes
      
    } catch (err: any) {
      console.error(err);
      alert("Error importing from Google Classroom: " + err.message);
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Import from Google Classroom
          </h3>
          <button disabled={isImporting} onClick={onClose} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {isFetchingGc && gcCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Loader2 className="animate-spin h-8 w-8 mb-4 text-emerald-600" />
              <p>Fetching your classes from Google...</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">1. Select Your Class</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  value={selectedGcCourseId}
                  onChange={(e) => handleFetchAssignments(e.target.value)}
                  disabled={isImporting}
                >
                  <option value="">-- Choose a Class --</option>
                  {gcCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {selectedGcCourseId && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-semibold mb-2 text-gray-700 flex items-center justify-between">
                    2. Select Assignment
                    {isFetchingGc && <Loader2 className="animate-spin h-4 w-4 text-emerald-600 inline ml-2" />}
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    value={selectedGcAssignmentId}
                    onChange={(e) => setSelectedGcAssignmentId(e.target.value)}
                    disabled={isFetchingGc || gcAssignments.length === 0 || isImporting}
                  >
                    <option value="">-- Choose an Assignment --</option>
                    {gcAssignments.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                  {gcAssignments.length === 0 && !isFetchingGc && (
                    <p className="text-sm text-amber-600 mt-2">No assignments found in this class.</p>
                  )}
                </div>
              )}

              {selectedGcAssignmentId && (
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="text-emerald-600 mt-0.5"><Sparkles size={18} /></div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900 mb-1">Ready to Import!</p>
                    <p className="text-xs text-emerald-700">
                      This will create a new TitanGrade assignment matching your Google Classroom assignment.
                      It will instantly download all student submissions (PDFs and Docs) securely for AI grading.
                    </p>
                  </div>
                </div>
              )}

            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={executeImport}
            disabled={!selectedGcAssignmentId || isImporting}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center shadow-sm"
          >
            {isImporting ? (
              <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Importing...</>
            ) : (
              "Import Submissions"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
