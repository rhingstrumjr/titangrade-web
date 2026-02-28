"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";

export default function SubmitPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const [assignmentName, setAssignmentName] = useState("Loading Assignment...");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [loading, setLoading] = useState(true);

  const [classId, setClassId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [submitStatus, setSubmitStatus] = useState<"idle" | "uploading" | "grading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [submissionsUsed, setSubmissionsUsed] = useState<number | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [rosterError, setRosterError] = useState("");

  useEffect(() => {
    async function fetchAssignment() {
      if (!assignmentId) return;
      const { data, error } = await supabase
        .from('assignments')
        .select('title, max_attempts, class_id')
        .eq('id', assignmentId)
        .single();

      if (error || !data) {
        setAssignmentName("Assignment Not Found");
      } else {
        setAssignmentName(data.title);
        setMaxAttempts(data.max_attempts || 1);
        setClassId(data.class_id);
      }
      setLoading(false);
    }
    fetchAssignment();
  }, [assignmentId]);

  const validateStudentAndLimit = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes('@')) {
      setSubmissionsUsed(null);
      setName("");
      setRosterError("");
      return;
    }

    setCheckingLimit(true);
    setRosterError("");
    setName("");

    // 1. Validate against Roster table
    if (classId) {
      const { data: rosterData } = await supabase
        .from('roster_students')
        .select('name')
        .eq('class_id', classId)
        .ilike('email', emailToCheck)
        .maybeSingle();

      if (!rosterData) {
        setRosterError("This email is not on the roster for this class. Please verify your spelling.");
        setSubmissionsUsed(null);
        setCheckingLimit(false);
        return; // Halt here, they cannot submit.
      }

      setName(rosterData.name);
    } else {
      // Fallback for legacy assignments with no class created
      setName(emailToCheck.split('@')[0]);
    }

    // 2. Check Submission Limit
    const { count, error } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId)
      .eq('student_email', emailToCheck);

    if (!error && count !== null) {
      setSubmissionsUsed(count);
    }
    setCheckingLimit(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 || !name || !email) return;
    if (submissionsUsed !== null && submissionsUsed >= maxAttempts) return;

    setSubmitStatus("uploading");

    try {
      // 1. Upload Files to Supabase Storage
      const uploadPromises = files.map(async (f) => {
        const fileExt = f.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${name.replace(/\s+/g, '_')}.${fileExt}`;
        const filePath = `${assignmentId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(filePath, f);

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('submissions')
          .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
      });

      const fileUrls = await Promise.all(uploadPromises);

      // 2. Create Submission Record in DB
      const { data: submissionData, error: dbError } = await supabase
        .from('submissions')
        .insert([
          {
            assignment_id: assignmentId,
            student_email: email,
            student_name: name,
            file_url: fileUrls[0], // backward compatibility
            file_urls: fileUrls,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database record failed: ${dbError.message}`);
      }

      const submissionId = submissionData.id;

      // 3. Trigger API for Grading
      setSubmitStatus("grading");

      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Grading API failed");
      }

      setSubmitStatus("success");

    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred");
      setSubmitStatus("error");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl">

        <div className="text-center">
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight">TitanGrade Submission</h2>
          <p className="mt-2 text-sm text-gray-600">
            Submitting for: <span className="font-semibold text-indigo-600">{assignmentName}</span>
          </p>
        </div>

        {submitStatus === "success" ? (
          <div className="text-center py-8 animate-in zoom-in duration-300">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900">Submitted Successfully!</h3>
            <p className="mt-2 text-gray-600">
              Your assignment has been submitted to your teacher and is currently being graded by the AI.
              <br /><br />
              <b>You will receive an email shortly</b> with your score and feedback!
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Student Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setRosterError(""); // clear error on typing
                  }}
                  onBlur={(e) => validateStudentAndLimit(e.target.value)}
                  disabled={submitStatus === "uploading" || submitStatus === "grading"}
                  className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none sm:text-sm ${rosterError ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"}`}
                  placeholder="johndoe@student.edu"
                />

                {/* Dynamic Feedback Area */}
                <div className="mt-2 text-sm min-h-[40px]">
                  {checkingLimit ? (
                    <p className="text-gray-500">Verifying...</p>
                  ) : rosterError ? (
                    <p className="font-semibold text-red-600">{rosterError}</p>
                  ) : name ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-indigo-600">Welcome, {name}!</p>
                      {submissionsUsed !== null && (
                        submissionsUsed >= maxAttempts ? (
                          <p className="font-semibold text-red-600">
                            You have reached the maximum number of submissions ({maxAttempts}).
                          </p>
                        ) : (
                          <p className="font-semibold text-emerald-600">
                            You have {maxAttempts - submissionsUsed} remaining submission{maxAttempts - submissionsUsed !== 1 ? 's' : ''} until your grade is final.
                          </p>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Type your email to verify your enrollment.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignment File</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="space-y-1 text-center">
                    <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                        <span>Upload one or more files</span>
                        <input
                          type="file"
                          className="sr-only"
                          required
                          multiple
                          accept=".pdf, .png, .jpg, .jpeg"
                          onChange={handleFileChange}
                          disabled={submitStatus === "uploading" || submitStatus === "grading" || (submissionsUsed !== null && submissionsUsed >= maxAttempts)}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 hidden sm:block">PDF, PNG, JPG supported</p>
                    {files.length > 0 && <p className="text-sm font-semibold text-indigo-900 mt-2">{files.length} file(s) selected</p>}
                  </div>
                </div>
              </div>
            </div>

            {submitStatus === "error" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={submitStatus === "uploading" || submitStatus === "grading" || files.length === 0 || !name || !!rosterError || (submissionsUsed !== null && submissionsUsed >= maxAttempts) || checkingLimit}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {submitStatus === "idle" || submitStatus === "error" ? "Submit Assignment"
                  : submitStatus === "uploading" ? "Uploading Securely..."
                    : "AI is Grading (Please Wait)..."}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
