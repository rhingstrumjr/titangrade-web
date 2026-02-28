"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";

export default function SubmitPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const [assignmentName, setAssignmentName] = useState("Loading Assignment...");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitStatus, setSubmitStatus] = useState<"idle" | "uploading" | "grading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchAssignment() {
      if (!assignmentId) return;
      const { data, error } = await supabase
        .from('assignments')
        .select('title')
        .eq('id', assignmentId)
        .single();

      if (error || !data) {
        setAssignmentName("Assignment Not Found");
      } else {
        setAssignmentName(data.title);
      }
      setLoading(false);
    }
    fetchAssignment();
  }, [assignmentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name || !email) return;

    setSubmitStatus("uploading");

    try {
      // 1. Upload File to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${name.replace(/\s+/g, '_')}.${fileExt}`;
      const filePath = `${assignmentId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      // Get the Public URL of the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('submissions')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      // 2. Create Submission Record in DB
      const { data: submissionData, error: dbError } = await supabase
        .from('submissions')
        .insert([
          {
            assignment_id: assignmentId,
            student_email: email,
            student_name: name,
            file_url: fileUrl,
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

    } catch (err: any) {
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
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitStatus === "uploading" || submitStatus === "grading"}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Student Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitStatus === "uploading" || submitStatus === "grading"}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="johndoe@student.edu"
                />
                <p className="mt-1 text-xs text-gray-500">Make sure this is correct, as your feedback will be emailed here.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignment File</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="space-y-1 text-center">
                    <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                        <span>Upload a file</span>
                        <input
                          type="file"
                          className="sr-only"
                          required
                          accept=".pdf, .png, .jpg, .jpeg"
                          onChange={handleFileChange}
                          disabled={submitStatus === "uploading" || submitStatus === "grading"}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 hidden sm:block">PDF, PNG, JPG up to 10MB</p>
                    {file && <p className="text-sm font-semibold text-indigo-900 mt-2">{file.name}</p>}
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
                disabled={submitStatus === "uploading" || submitStatus === "grading" || !file || !name || !email}
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
