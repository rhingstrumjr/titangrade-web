"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight, FileText, Download, Star, Edit2, X, Save, Send, RefreshCw, Loader2 } from "lucide-react";

interface Submission {
  id: string;
  student_name: string;
  student_email: string;
  file_url: string;
  score: string | null;
  feedback: string | null;
  status: string;
  is_exemplar: boolean;
  manually_edited: boolean;
  email_sent: boolean;
  pre_regrade_score: string | null;
  pre_regrade_feedback: string | null;
  created_at: string;
}

interface StudentGroup {
  email: string;
  name: string;
  submissions: Submission[];
  latestStatus: string;
  latestScore: string | null;
}

export default function SubmissionsView() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const [assignmentTitle, setAssignmentTitle] = useState("Loading...");
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editFeedback, setEditFeedback] = useState("");
  const [releasingGrades, setReleasingGrades] = useState(false);

  // Regrade state
  const [regrading, setRegrading] = useState(false);
  const [showRegradeConfirm, setShowRegradeConfirm] = useState(false);
  const [regradeProgress, setRegradeProgress] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!assignmentId) return;

      // Fetch assignment title
      const { data: assignData } = await supabase
        .from('assignments')
        .select('title')
        .eq('id', assignmentId)
        .single();

      if (assignData) {
        setAssignmentTitle(assignData.title);
      }

      // Fetch submissions
      const { data: subData } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true }); // Chronological order

      if (subData) {
        // Group by email
        const groups: Record<string, StudentGroup> = {};

        subData.forEach((sub: Submission) => {
          if (!groups[sub.student_email]) {
            groups[sub.student_email] = {
              email: sub.student_email,
              name: sub.student_name,
              submissions: [],
              latestStatus: sub.status,
              latestScore: sub.score,
            };
          }
          groups[sub.student_email].submissions.push(sub);
          groups[sub.student_email].latestStatus = sub.status; // gets overwritten to latest
          groups[sub.student_email].latestScore = sub.score;
        });

        // Convert to array and sort by name
        const sortedGroups = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
        setStudentGroups(sortedGroups);
      }
      setLoading(false);
    }

    fetchData();
  }, [assignmentId]);

  const toggleExpand = (email: string) => {
    setExpandedEmail(expandedEmail === email ? null : email);
  };

  const unreleasedCount = studentGroups.reduce(
    (count, group) => count + group.submissions.filter(s => s.status === 'graded' && !s.email_sent).length,
    0
  );

  // Count exemplars across all submissions
  const exemplarCount = studentGroups.reduce(
    (count, group) => count + group.submissions.filter(s => s.is_exemplar).length,
    0
  );

  // Count eligible submissions for regrade
  const regradeEligibleCount = studentGroups.reduce(
    (count, group) => count + group.submissions.filter(s =>
      s.status === 'graded' && !s.is_exemplar && !s.manually_edited
    ).length,
    0
  );

  const handleDownloadCSV = () => {
    if (studentGroups.length === 0) return;

    const headers = ["Student Name", "Email", "Latest Score", "Latest Status", "Number of Drafts"];

    const rows = studentGroups.map(group => [
      `"${group.name}"`,
      `"${group.email}"`,
      `"${group.latestScore || ''}"`,
      `"${group.latestStatus}"`,
      `"${group.submissions.length}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `grades_${assignmentTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExemplar = async (submissionId: string, currentStatus: boolean, studentEmail: string) => {
    const { error } = await supabase
      .from('submissions')
      .update({ is_exemplar: !currentStatus })
      .eq('id', submissionId);

    if (!error) {
      // Update local state
      setStudentGroups(prevGroups => prevGroups.map(group => {
        if (group.email === studentEmail) {
          return {
            ...group,
            submissions: group.submissions.map(sub =>
              sub.id === submissionId ? { ...sub, is_exemplar: !currentStatus } : sub
            )
          };
        }
        return group;
      }));
    } else {
      console.error("Failed to toggle exemplar", error);
      alert("Failed to toggle exemplar status.");
    }
  };

  const startEditing = (sub: Submission) => {
    setEditingSubId(sub.id);
    setEditScore(sub.score || "");
    setEditFeedback(sub.feedback || "");
  };

  const handleReleaseGrades = async () => {
    if (!confirm("Are you sure you want to release all pending grades? This will send emails to all students who have graded submissions that haven't been emailed yet.")) {
      return;
    }

    setReleasingGrades(true);
    try {
      const res = await fetch('/api/release_grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignmentId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to release grades');

      alert(`Successfully released ${data.count} grades!`);

      // Update local state to mark them all as sent
      setStudentGroups(prevGroups => prevGroups.map(group => ({
        ...group,
        submissions: group.submissions.map(sub =>
          (sub.status === 'graded' && !sub.email_sent) ? { ...sub, email_sent: true } : sub
        )
      })));

    } catch (e: unknown) {
      const err = e as Error;
      alert(`Error releasing grades: ${err.message}`);
    }
    setReleasingGrades(false);
  };

  const cancelEditing = () => {
    setEditingSubId(null);
    setEditScore("");
    setEditFeedback("");
  };

  const saveGradeOverride = async (sub: Submission, email: string) => {
    const { error } = await supabase
      .from('submissions')
      .update({ score: editScore, feedback: editFeedback, manually_edited: true })
      .eq('id', sub.id);

    if (!error) {
      setStudentGroups(prevGroups => prevGroups.map(group => {
        if (group.email === email) {
          const updatedSubmissions = group.submissions.map(s =>
            s.id === sub.id ? { ...s, score: editScore, feedback: editFeedback, manually_edited: true } : s
          );
          return {
            ...group,
            submissions: updatedSubmissions,
            latestScore: updatedSubmissions[updatedSubmissions.length - 1].score
          };
        }
        return group;
      }));
      setEditingSubId(null);
    } else {
      console.error("Failed to save grade override", error);
      alert("Failed to save edited grade.");
    }
  };

  // ── Regrade Handler ──
  const handleRegrade = async () => {
    setShowRegradeConfirm(false);
    setRegrading(true);
    setRegradeProgress(`Regrading ${regradeEligibleCount} submissions with ${exemplarCount} exemplar${exemplarCount !== 1 ? 's' : ''}...`);

    try {
      const res = await fetch('/api/regrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Regrade failed');

      // Refresh data from DB to get updated scores
      const { data: subData } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });

      if (subData) {
        const groups: Record<string, StudentGroup> = {};
        subData.forEach((sub: Submission) => {
          if (!groups[sub.student_email]) {
            groups[sub.student_email] = {
              email: sub.student_email,
              name: sub.student_name,
              submissions: [],
              latestStatus: sub.status,
              latestScore: sub.score,
            };
          }
          groups[sub.student_email].submissions.push(sub);
          groups[sub.student_email].latestStatus = sub.status;
          groups[sub.student_email].latestScore = sub.score;
        });
        const sortedGroups = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
        setStudentGroups(sortedGroups);
      }

      const msg = data.failures > 0
        ? `Regraded ${data.count} submissions (${data.failures} failed). Review the updated scores below.`
        : `Successfully regraded ${data.count} submissions! Review the updated scores below.`;

      alert(msg);

    } catch (e: unknown) {
      const err = e as Error;
      alert(`Regrade error: ${err.message}`);
    }

    setRegrading(false);
    setRegradeProgress(null);
  };

  // ── Score Diff Helper ──
  const ScoreDiff = ({ oldScore, newScore }: { oldScore: string; newScore: string }) => {
    const parseNum = (s: string) => {
      const match = s.match(/^([\d.]+)/);
      return match ? parseFloat(match[1]) : null;
    };
    const oldNum = parseNum(oldScore);
    const newNum = parseNum(newScore);

    let color = 'text-gray-500 bg-gray-50 border-gray-200';
    let arrow = '→';
    if (oldNum !== null && newNum !== null) {
      if (newNum > oldNum) {
        color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        arrow = '↑';
      } else if (newNum < oldNum) {
        color = 'text-red-700 bg-red-50 border-red-200';
        arrow = '↓';
      }
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
        {oldScore} {arrow} {newScore}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="pb-6 border-b border-gray-200 flex justify-between items-end">
          <div>
            <Link href="/teacher" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4 transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">Submissions</h1>
            <p className="text-gray-500 mt-1">{assignmentTitle}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Exemplar Badge */}
            <div className="relative group">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${exemplarCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                <Star size={14} className={exemplarCount > 0 ? 'fill-amber-500 text-amber-500' : ''} />
                {exemplarCount} Exemplar{exemplarCount !== 1 ? 's' : ''}
              </span>
              {exemplarCount > 0 && exemplarCount < 5 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  We recommend 5+ exemplars spanning a range of scores
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>

            {/* Regrade Button */}
            <button
              onClick={() => setShowRegradeConfirm(true)}
              disabled={regrading || regradeEligibleCount === 0}
              className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              {regrading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {regrading ? 'Regrading...' : `Regrade (${regradeEligibleCount})`}
            </button>

            {unreleasedCount > 0 && (
              <button
                onClick={handleReleaseGrades}
                disabled={releasingGrades}
                className="flex items-center gap-2 bg-indigo-600 border border-transparent text-white hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                <Send size={16} />
                {releasingGrades ? "Releasing..." : `Release ${unreleasedCount} Grades`}
              </button>
            )}

            <button
              onClick={handleDownloadCSV}
              disabled={studentGroups.length === 0}
              className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>

        {/* Regrade Confirmation Modal */}
        {showRegradeConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRegradeConfirm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <RefreshCw size={20} className="text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Regrade with Exemplars</h3>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-sm text-gray-600">
                  The AI will re-grade <strong>{regradeEligibleCount} submission{regradeEligibleCount !== 1 ? 's' : ''}</strong> using
                  {' '}<strong>{exemplarCount} exemplar{exemplarCount !== 1 ? 's' : ''}</strong> as calibration data.
                </p>

                {exemplarCount === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <strong>⚠️ No exemplars marked.</strong> The AI will use the rubric only (same as initial grading). Star some graded submissions first for better calibration.
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 space-y-1">
                  <p>✅ Exemplar submissions will <strong>not</strong> be regraded</p>
                  <p>✅ Manually edited grades will <strong>not</strong> be changed</p>
                  <p>✅ Already-emailed students will receive an <strong>updated grade</strong> email</p>
                  <p>✅ Submission limits are <strong>not</strong> affected</p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRegradeConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegrade}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  Regrade {regradeEligibleCount} Submissions
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Regrade Progress Banner */}
        {regrading && regradeProgress && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3 animate-pulse">
            <Loader2 size={20} className="text-purple-600 animate-spin" />
            <p className="text-sm font-medium text-purple-800">{regradeProgress}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading submissions...</div>
        ) : studentGroups.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">No submissions yet</h3>
            <p className="text-gray-500">Students have not submitted any work for this assignment.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drafts</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Score</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {studentGroups.map((group) => (
                    <React.Fragment key={group.email}>
                      {/* Parent Row */}
                      <tr
                        className={`hover: bg - gray - 50 transition - colors cursor - pointer ${expandedEmail === group.email ? 'bg-indigo-50/50' : ''}`}
                        onClick={() => toggleExpand(group.email)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {expandedEmail === group.email ? (
                              <ChevronDown size={18} className="text-gray-400 mr-2" />
                            ) : (
                              <ChevronRight size={18} className="text-gray-400 mr-2" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{group.name}</div>
                              <div className="text-sm text-gray-500">{group.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                          {group.submissions.length} submission{group.submissions.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {group.latestStatus === 'graded' ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                <CheckCircle2 size={12} className="mr-1" /> Graded
                              </span>
                              {!group.submissions[group.submissions.length - 1].email_sent && (
                                <span className="text-[10px] text-orange-600 mt-1 font-medium ml-1 flex items-center">
                                  <Clock size={10} className="mr-1" /> Pending Release
                                </span>
                              )}
                            </div>
                          ) : group.latestStatus === 'pending' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Clock size={12} className="mr-1" /> Grading...
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertCircle size={12} className="mr-1" /> Error
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {group.latestScore || '-'}
                        </td>
                      </tr>

                      {/* Expanded Drafts - Child Rows */}
                      {expandedEmail === group.email && (
                        <tr>
                          <td colSpan={5} className="bg-gray-50 p-0 border-b border-gray-200">
                            <div className="px-12 py-4 animate-in fade-in slide-in-from-top-2 duration-200">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Submission History</h4>
                              <div className="space-y-3">
                                {group.submissions.map((sub, index) => (
                                  <div key={sub.id} className="bg-white border text-sm border-gray-200 rounded-lg p-4 flex flex-col gap-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                          {index + 1}
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-900">Draft {index + 1}</p>
                                            {sub.manually_edited && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 border border-blue-200 text-blue-700">
                                                Manually Edited
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-gray-500">{new Date(sub.created_at).toLocaleString()}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-6">
                                        {/* Score Block */}
                                        {sub.status === 'graded' && sub.score ? (
                                          editingSubId === sub.id ? (
                                            <div className="flex flex-col">
                                              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Score</p>
                                              <input
                                                type="text"
                                                value={editScore}
                                                onChange={(e) => setEditScore(e.target.value)}
                                                className="border border-gray-300 rounded px-2 py-1 text-sm font-bold w-20 text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                              />
                                            </div>
                                          ) : (
                                            <div className="text-center">
                                              <p className="text-xs text-gray-500 uppercase font-semibold">Score</p>
                                              <p className="font-bold text-gray-900">{sub.score}</p>
                                              {/* Before/After diff pill */}
                                              {sub.pre_regrade_score && (
                                                <div className="mt-1">
                                                  <ScoreDiff oldScore={sub.pre_regrade_score} newScore={sub.score} />
                                                </div>
                                              )}
                                            </div>
                                          )
                                        ) : sub.status === 'pending' ? (
                                          <p className="text-yellow-600 font-medium text-xs flex items-center"><Clock size={12} className="mr-1" /> Grading in progress...</p>
                                        ) : null}

                                        <div className="flex flex-col gap-2 relative z-10">
                                          <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-md font-medium text-xs">
                                            <FileText size={14} /> View Document
                                          </a>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleExemplar(sub.id, sub.is_exemplar, group.email);
                                            }}
                                            className={`flex items-center justify-center gap-1.5 transition-colors border px-3 py-1.5 rounded-md font-medium text-xs ${sub.is_exemplar
                                              ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-amber-600"
                                              }`}
                                          >
                                            <Star size={14} className={sub.is_exemplar ? "fill-amber-500 text-amber-500" : ""} />
                                            {sub.is_exemplar ? "Unmark Exemplar" : "Mark as Exemplar"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Feedback & Editing Actions row */}
                                    {sub.status === 'graded' && (
                                      <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                                        {editingSubId === sub.id ? (
                                          <>
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Feedback</p>
                                            <textarea
                                              value={editFeedback}
                                              onChange={(e) => setEditFeedback(e.target.value)}
                                              rows={3}
                                              className="border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none w-full"
                                            />
                                            <div className="flex justify-end gap-2 mt-2">
                                              <button onClick={(e) => { e.stopPropagation(); cancelEditing(); }} className="flex items-center px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors relative z-10">
                                                <X size={14} className="mr-1" /> Cancel
                                              </button>
                                              <button onClick={(e) => { e.stopPropagation(); saveGradeOverride(sub, group.email); }} className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors relative z-10">
                                                <Save size={14} className="mr-1" /> Save Override
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="flex justify-between items-start gap-4">
                                              <div className="flex-1">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Feedback</p>
                                                <p className="text-gray-700 italic">&quot;{sub.feedback}&quot;</p>
                                              </div>
                                              <button onClick={(e) => { e.stopPropagation(); startEditing(sub); }} className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors bg-white border border-gray-200 hover:border-indigo-200 px-3 py-1.5 rounded-md relative z-10">
                                                <Edit2 size={14} /> Edit Grade
                                              </button>
                                            </div>

                                            {/* Before/After Feedback Comparison (expandable) */}
                                            {sub.pre_regrade_feedback && (
                                              <details className="mt-2">
                                                <summary className="cursor-pointer text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">
                                                  View previous feedback (before regrade)
                                                </summary>
                                                <div className="mt-2 bg-purple-50 border border-purple-100 rounded-lg p-3">
                                                  <p className="text-xs text-purple-500 uppercase font-semibold mb-1">Previous Feedback</p>
                                                  <p className="text-sm text-purple-800 italic">&quot;{sub.pre_regrade_feedback}&quot;</p>
                                                </div>
                                              </details>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
