"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PlusCircle, Link as LinkIcon, Users, FileText, Activity, Trash2 } from "lucide-react";
import Link from "next/link";

interface Assignment {
  id: string;
  title: string;
  max_score: number;
  rubric: string;
  rubrics?: string[];
  exemplar_url?: string;
  exemplar_urls?: string[];
  grading_framework: "standard" | "marzano";
  max_attempts: number;
  is_socratic: boolean;
  created_at: string;
}

export default function TeacherDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [gradingFramework, setGradingFramework] = useState<"standard" | "marzano">("standard");
  const [newScore, setNewScore] = useState(100);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [isSocratic, setIsSocratic] = useState(false);
  const [rubricType, setRubricType] = useState<"text" | "file">("text");
  const [newRubricText, setNewRubricText] = useState("");
  const [newRubricFiles, setNewRubricFiles] = useState<File[]>([]);
  const [newExemplarFiles, setNewExemplarFiles] = useState<File[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch initial assignments
  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching assignments:", error.message, error.details);
    } else {
      setAssignments(data || []);
    }
    setLoading(false);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);

    let finalRubricValue = newRubricText;
    let finalRubricsArray = newRubricText ? [newRubricText] : [];

    if (rubricType === "file" && newRubricFiles.length > 0) {
      const uploadPromises = newRubricFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_rubric.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('rubrics')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('rubrics')
          .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
      });

      try {
        const urls = await Promise.all(uploadPromises);
        finalRubricValue = urls[0]; // fallback for old column
        finalRubricsArray = urls;
      } catch (uploadError) {
        console.error("Error uploading rubrics:", uploadError);
        alert("Failed to upload the rubric files. Please ensure you created the 'rubrics' public storage bucket in Supabase.");
        setCreateLoading(false);
        return;
      }
    }

    let finalExemplarValue = null;
    let finalExemplarArray = null;
    if (newExemplarFiles.length > 0) {
      const uploadPromises = newExemplarFiles.map(async (file) => {
        const execExt = file.name.split('.').pop();
        const execName = `${Date.now()}_${Math.random().toString(36).substring(7)}_exemplar.${execExt}`;

        const { error: uploadExecError } = await supabase.storage
          .from('rubrics')
          .upload(execName, file);

        if (uploadExecError) throw uploadExecError;

        const { data: publicExecData } = supabase.storage
          .from('rubrics')
          .getPublicUrl(execName);

        return publicExecData.publicUrl;
      });

      try {
        const urls = await Promise.all(uploadPromises);
        finalExemplarValue = urls[0]; // fallback for old column
        finalExemplarArray = urls;
      } catch (uploadExecError) {
        console.error("Error uploading exemplars:", uploadExecError);
        alert("Failed to upload the Exemplar files.");
        setCreateLoading(false);
        return;
      }
    }

    const finalScore = gradingFramework === "marzano" ? 4 : newScore;

    const { data, error } = await supabase
      .from('assignments')
      .insert([
        {
          title: newTitle,
          max_score: finalScore,
          rubric: finalRubricValue,
          rubrics: finalRubricsArray.length > 0 ? finalRubricsArray : null,
          exemplar_url: finalExemplarValue,
          exemplar_urls: finalExemplarArray,
          grading_framework: gradingFramework,
          max_attempts: maxAttempts,
          is_socratic: isSocratic
        }
      ])
      .select();

    if (error) {
      console.error("Error creating assignment:", error);
      alert("Failed to create assignment");
    } else if (data && data[0]) {
      setAssignments([data[0], ...assignments]);
      setIsCreating(false);
      setNewTitle("");
      setNewScore(100);
      setMaxAttempts(1);
      setIsSocratic(false);
      setGradingFramework("standard");
      setNewRubricText("");
      setNewRubricFiles([]);
      setNewExemplarFiles([]);
    }
    setCreateLoading(false);
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assignment? All student submissions will also be deleted. This cannot be undone.")) {
      return;
    }

    setDeletingId(id);

    // Submissions should cascade delete if FK is set up, but let's delete them explicitly just in case
    await supabase.from('submissions').delete().eq('assignment_id', id);

    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting assignment:", error);
      alert("Failed to delete assignment.");
    } else {
      setAssignments(assignments.filter(a => a.id !== id));
    }
    setDeletingId(null);
  };

  const copyToClipboard = (id: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(`${window.location.origin}/submit/${id}`);
      alert("Submission link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">TitanGrade Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage your class assignments and view student submissions</p>
          </div>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm"
          >
            <PlusCircle size={20} />
            {isCreating ? "Cancel" : "New Assignment"}
          </button>
        </div>

        {/* Create Assignment Form */}
        {isCreating && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4">
            <h2 className="text-xl font-bold mb-4">Create New Assignment</h2>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold mb-1">Assignment Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Lab 1: Cellular Respiration"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-1">Grading Framework</label>
                  <select
                    value={gradingFramework}
                    onChange={(e) => setGradingFramework(e.target.value as "standard" | "marzano")}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="standard">Standard Percentage</option>
                    <option value="marzano">Marzano Scale (4.0)</option>
                  </select>
                </div>
                {gradingFramework !== "marzano" && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Max Score</label>
                    <input
                      type="number"
                      required
                      value={newScore}
                      onChange={(e) => setNewScore(parseInt(e.target.value))}
                      min={1}
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-1">Max Submissions</label>
                  <input
                    type="number"
                    required
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(parseInt(e.target.value))}
                    min={1}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Allowed drafts</p>
                </div>

                <div className="md:col-span-4 flex items-center p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <input
                    id="socratic-toggle"
                    type="checkbox"
                    checked={isSocratic}
                    onChange={(e) => setIsSocratic(e.target.checked)}
                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <label htmlFor="socratic-toggle" className="font-semibold text-indigo-900 cursor-pointer text-sm">
                      Enable Socratic Tutor Mode
                    </label>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      The AI will never reveal the correct answer directly. Instead, it will guide the student to find the answer themselves through questions and hints.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold">Grading Rubric</label>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setRubricType("text")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${rubricType === "text" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Type Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setRubricType("file")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${rubricType === "file" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Upload File
                    </button>
                  </div>
                </div>

                {rubricType === "text" ? (
                  <textarea
                    required
                    value={newRubricText}
                    onChange={(e) => setNewRubricText(e.target.value)}
                    placeholder="Paste your rubric and evaluation criteria here. The more detailed, the better the AI will grade."
                    rows={8}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                  />
                ) : (
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="space-y-1 text-center">
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                          <span>Click to upload rubric</span>
                          <input
                            type="file"
                            className="sr-only"
                            required
                            multiple
                            accept=".pdf, .png, .jpg, .jpeg"
                            onChange={(e) => {
                              if (e.target.files) {
                                setNewRubricFiles(Array.from(e.target.files));
                              }
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Upload one or multiple pages (PDF, PNG, JPG)</p>
                      {newRubricFiles.length > 0 && <p className="text-sm font-semibold text-indigo-900 mt-2">{newRubricFiles.length} file(s) selected</p>}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Optional: Upload Answer Key Exemplar</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="space-y-1 text-center">
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-emerald-500 px-2 py-1">
                        <span>Select absolute perfect 100% answer key</span>
                        <input
                          type="file"
                          className="sr-only"
                          multiple
                          accept=".pdf, .png, .jpg, .jpeg"
                          onChange={(e) => {
                            if (e.target.files) {
                              setNewExemplarFiles(Array.from(e.target.files));
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Select one or multiple pages. Uploading this eliminates AI hallucinations on answers.</p>
                    {newExemplarFiles.length > 0 && <p className="text-sm font-semibold text-emerald-900 mt-2">{newExemplarFiles.length} file(s) selected</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-sm"
                >
                  {createLoading ? "Creating..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Assignment List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Your Assignments</h2>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No assignments yet</h3>
              <p className="text-gray-500 mb-4">Create your first assignment to start accepting submissions.</p>
              <button
                onClick={() => setIsCreating(true)}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Create New Assignment
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <div className="p-6 flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-gray-900 truncate pr-2" title={assignment.title}>
                        {assignment.title}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteAssignment(assignment.id);
                        }}
                        disabled={deletingId === assignment.id}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50 focus:outline-none flex-shrink-0"
                        title="Delete Assignment"
                      >
                        {deletingId === assignment.id ? (
                          <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mb-4">
                      <span className="font-medium text-indigo-100 bg-indigo-600 px-2 py-0.5 rounded mr-2">
                        {assignment.grading_framework === 'marzano' ? 'Marzano (4.0)' : `${assignment.max_score} pts`}
                      </span>
                      <span>Created {new Date(assignment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                      {assignment.rubric}
                    </p>
                  </div>

                  <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-between items-center">
                    <Link href={`/teacher/submissions/${assignment.id}`} className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
                      <Users size={16} className="mr-1.5" />
                      View Submissions
                    </Link>
                    <button
                      onClick={() => copyToClipboard(assignment.id)}
                      className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-100 px-2 py-1 transition-colors"
                      title="Copy Student Submission Link"
                    >
                      <LinkIcon size={14} className="mr-1.5" />
                      Copy Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
