import React, { useState, useEffect } from "react";
import { Loader2, XCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Class, Assignment } from "@/types/dashboard";

interface PublishToGCModalProps {
  providerToken: string;
  assignmentId: string;
  classes: Class[];
  assignments: Assignment[];
  onClose: () => void;
}

export const PublishToGCModal: React.FC<PublishToGCModalProps> = ({
  providerToken,
  assignmentId,
  classes,
  assignments,
  onClose
}) => {
  const supabase = createClient();
  const [gcCourses, setGcCourses] = useState<any[]>([]);
  const [selectedPublishCourseIds, setSelectedPublishCourseIds] = useState<string[]>([]);
  const [isFetchingGc, setIsFetchingGc] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishAsDraft, setPublishAsDraft] = useState(true);

  useEffect(() => {
    fetchCoursesAndAutoSelect();
  }, [providerToken, assignmentId]);

  const fetchCoursesAndAutoSelect = async () => {
    if (!providerToken) return;
    
    setIsFetchingGc(true);
    let courses = [];
    try {
      const res = await fetch("/api/classroom/courses", {
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      const data = await res.json();
      if (data.courses) {
        courses = data.courses;
        setGcCourses(data.courses);
      }
    } catch (err) {
      console.error("Failed to fetch courses", err);
    }
    setIsFetchingGc(false);

    // Auto-select the linked course if the assignment's class has one
    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment?.class_id) {
      const cls = classes.find(c => c.id === assignment.class_id);
      if (cls?.gc_course_id) {
        setSelectedPublishCourseIds([cls.gc_course_id]);
      }
    }
  };

  const handleToggleCourse = (courseId: string) => {
    setSelectedPublishCourseIds(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const executePublishToGc = async () => {
    if (!assignmentId || !providerToken) return;
    if (selectedPublishCourseIds.length === 0) return;
    
    setIsPublishing(true);
    try {
      const sourceAssignment = assignments.find(a => a.id === assignmentId);
      if (!sourceAssignment) throw new Error("Assignment not found");

      for (let i = 0; i < selectedPublishCourseIds.length; i++) {
        const courseId = selectedPublishCourseIds[i];
        let targetAssignmentId = assignmentId;

        // For multi-class publish: duplicate the assignment for each additional class
        if (i > 0) {
          // Find or create the TG class for this GC course
          let matchedClass = classes.find(c => c.gc_course_id === courseId);
          if (!matchedClass) {
            const gcCourse = gcCourses.find((c: any) => c.id === courseId);
            const { data: newClass } = await supabase.from('classes').insert([{
              name: gcCourse?.name || "Synced Class",
              gc_course_id: courseId,
            }]).select().single();
            if (newClass) {
              matchedClass = newClass;
            }
          }

          // Duplicate the assignment for this class
          const { data: dupAssignment, error: dupError } = await supabase.from('assignments').insert([{
            title: sourceAssignment.title,
            max_score: sourceAssignment.max_score,
            rubric: sourceAssignment.rubric,
            rubrics: sourceAssignment.rubrics,
            structured_rubric: sourceAssignment.structured_rubric,
            exemplar_url: sourceAssignment.exemplar_url,
            exemplar_urls: sourceAssignment.exemplar_urls,
            grading_framework: sourceAssignment.grading_framework,
            max_attempts: sourceAssignment.max_attempts,
            is_socratic: sourceAssignment.is_socratic,
            auto_send_emails: sourceAssignment.auto_send_emails,
            generated_key: sourceAssignment.generated_key,
            class_id: matchedClass?.id || null,
          }]).select().single();
          if (dupError) throw dupError;
          targetAssignmentId = dupAssignment.id;
        } else {
          // For the first course, also update the assignment's class_id if a linked class exists
          const matchedClass = classes.find(c => c.gc_course_id === courseId);
          if (matchedClass && sourceAssignment.class_id !== matchedClass.id) {
            await supabase.from('assignments').update({ class_id: matchedClass.id }).eq('id', targetAssignmentId);
          }
        }

        // Publish to Google Classroom
        const res = await fetch("/api/classroom/create-coursework", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}` },
          body: JSON.stringify({
            assignmentId: targetAssignmentId,
            courseId: courseId,
            state: publishAsDraft ? 'DRAFT' : 'PUBLISHED'
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }

      // Successfully published — redirect to unified assignment page
      window.location.href = `/teacher/assignments/${assignmentId}`;
      return;
    } catch (err: any) {
      console.error(err);
      alert("Error publishing to Google Classroom: " + err.message);
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Publish to Google Classroom
          </h3>
          <button disabled={isPublishing} onClick={onClose} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <p className="text-sm text-gray-700">
            This will create an assignment in Google Classroom. Students will be able to attach Google Docs, PDFs, and links directly there, and they will automatically sync back to TitanGrade.
          </p>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Select Classes to Publish To</label>
            {isFetchingGc && gcCourses.length === 0 ? (
              <div className="flex items-center text-sm text-gray-500 py-2">
                <Loader2 className="animate-spin h-4 w-4 mr-2" /> Loading classes...
              </div>
            ) : gcCourses.length > 0 ? (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-2">
                {gcCourses.map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      checked={selectedPublishCourseIds.includes(c.id)}
                      onChange={() => handleToggleCourse(c.id)}
                      disabled={isPublishing}
                    />
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-600">No Google Classroom courses found.</p>
            )}
            {selectedPublishCourseIds.length > 1 && (
              <p className="text-xs text-emerald-600 mt-2">
                Note: Publishing to multiple classes will create separate, duplicated assignments in TitanGrade for each class.
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={publishAsDraft}
                onChange={(e) => setPublishAsDraft(e.target.checked)}
                className="sr-only peer"
                disabled={isPublishing}
              />
              <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-emerald-300 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ms-3 text-sm font-medium text-gray-700">Publish as Draft (Recommended)</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-14">
              Allows you to review the assignment, add Due Dates, and link grades before students see it.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={executePublishToGc}
            disabled={selectedPublishCourseIds.length === 0 || isPublishing}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center shadow-sm"
          >
            {isPublishing ? (
              <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Publishing...</>
            ) : (
              "Publish to GC"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
