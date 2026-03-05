"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight, FileText, Download, Star, Edit2, X, Save, Send, RefreshCw, Loader2, BarChart3, Pencil } from "lucide-react";

import { Submission, StudentGroup } from "@/types/submission";
import { CategoryBreakdown } from "@/components/submissions/CategoryBreakdown";
import { RegradeModal } from "@/components/submissions/RegradeModal";
import { ScoreDiff } from "@/components/submissions/ScoreDiff";

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
  const [selectedForRegrade, setSelectedForRegrade] = useState<Set<string>>(new Set());

  // AI cost tracking
  const [assignmentCost, setAssignmentCost] = useState<number>(0);

  // Submission limit state
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [editingMaxAttempts, setEditingMaxAttempts] = useState(false);
  const [tempMaxAttempts, setTempMaxAttempts] = useState<number>(1);
  const [savingMaxAttempts, setSavingMaxAttempts] = useState(false);

  // Category score editing state
  const [editCategoryScores, setEditCategoryScores] = useState<{ category: string; earned: number; possible: number }[]>([]);
  const [editSkillAssessments, setEditSkillAssessments] = useState<{ level: string; dimension: string; skill: string; status: string }[]>([]);

  // Google Classroom integration state
  const [isGradingGc, setIsGradingGc] = useState(false);
  const [gcProgress, setGcProgress] = useState({ current: 0, total: 0 });
  const [gcCourseId, setGcCourseId] = useState<string | null>(null);
  const [gcCourseworkId, setGcCourseworkId] = useState<string | null>(null);
  const [syncingToGc, setSyncingToGc] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!assignmentId) return;

      // Fetch assignment title and max_attempts, ai_cost, gc info
      const { data: assignData } = await supabase
        .from('assignments')
        .select('title, max_attempts, ai_cost, gc_course_id, gc_coursework_id')
        .eq('id', assignmentId)
        .single();

      if (assignData) {
        setAssignmentTitle(assignData.title);
        setMaxAttempts(assignData.max_attempts || 1);
        setTempMaxAttempts(assignData.max_attempts || 1);
        setAssignmentCost(Number(assignData.ai_cost) || 0);
        setGcCourseId(assignData.gc_course_id);
        setGcCourseworkId(assignData.gc_coursework_id);
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

        // Auto-select latest submission per student for regrade
        const initialSelection = new Set<string>();
        sortedGroups.forEach(group => {
          const latest = group.submissions[group.submissions.length - 1];
          if (latest.status === 'graded' && !latest.is_exemplar && !latest.manually_edited) {
            initialSelection.add(latest.id);
          }
        });
        setSelectedForRegrade(initialSelection);
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

  const totalAiCost = assignmentCost + studentGroups.reduce(
    (total, group) => total + group.submissions.reduce((subTotal, s) => subTotal + (Number(s.ai_cost) || 0), 0),
    0
  );

  const handleDownloadCSV = () => {
    if (studentGroups.length === 0) return;

    const headers = ["Student Name", "Email", "Latest Score", "Latest Status", "Number of Drafts"];

    // Detect dynamic category/skill columns from the first group's latest submission
    const sampleSub = studentGroups[0]?.submissions[studentGroups[0].submissions.length - 1];
    const hasCategoryScores = sampleSub?.category_scores && sampleSub.category_scores.length > 0;
    const hasSkillAssessments = sampleSub?.skill_assessments && sampleSub.skill_assessments.length > 0;

    if (hasCategoryScores) {
      sampleSub.category_scores!.forEach(cs => headers.push(`"${cs.category}"`));
    } else if (hasSkillAssessments) {
      sampleSub.skill_assessments!.forEach(sa => headers.push(`"${sa.level} ${sa.dimension}: ${sa.skill}"`));
    }

    const rows = studentGroups.map(group => {
      const latest = group.submissions[group.submissions.length - 1];
      const row = [
        `"${group.name}"`,
        `"${group.email}"`,
        `"${group.latestScore || ''}"`,
        `"${group.latestStatus}"`,
        `"${group.submissions.length}"`
      ];

      if (hasCategoryScores && latest.category_scores) {
        latest.category_scores.forEach(cs => row.push(`"${cs.earned}/${cs.possible}"`));
      } else if (hasSkillAssessments && latest.skill_assessments) {
        latest.skill_assessments.forEach(sa => row.push(`"${sa.status}"`));
      }

      return row;
    });

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
    if (sub.skill_assessments && sub.skill_assessments.length > 0) {
      setEditSkillAssessments(sub.skill_assessments.map(sa => ({ ...sa })));
    } else {
      setEditSkillAssessments([]);
    }
    if (sub.category_scores && sub.category_scores.length > 0) {
      setEditCategoryScores(sub.category_scores.map(cs => ({ ...cs })));
    } else {
      setEditCategoryScores([]);
    }
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
    const updatePayload: Record<string, unknown> = { score: editScore, feedback: editFeedback, manually_edited: true };

    if (sub.skill_assessments && sub.skill_assessments.length > 0) {
      updatePayload.skill_assessments = editSkillAssessments;
    }
    if (sub.category_scores && sub.category_scores.length > 0) {
      updatePayload.category_scores = editCategoryScores;
    }

    const { error } = await supabase
      .from('submissions')
      .update(updatePayload)
      .eq('id', sub.id);

    if (!error) {
      setStudentGroups(prevGroups => prevGroups.map(group => {
        if (group.email === email) {
          const updatedSubmissions = group.submissions.map(s =>
            s.id === sub.id ? {
              ...s,
              score: editScore,
              feedback: editFeedback,
              ...(updatePayload.skill_assessments ? { skill_assessments: editSkillAssessments } : {}),
              ...(updatePayload.category_scores ? { category_scores: editCategoryScores } : {}),
              manually_edited: true
            } : s
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

  // ── Submission Limit Handler ──
  const handleSaveMaxAttempts = async () => {
    setSavingMaxAttempts(true);
    const { error } = await supabase
      .from('assignments')
      .update({ max_attempts: tempMaxAttempts })
      .eq('id', assignmentId);

    if (!error) {
      setMaxAttempts(tempMaxAttempts);
      setEditingMaxAttempts(false);
    } else {
      alert('Failed to update submission limit');
    }
    setSavingMaxAttempts(false);
  };

  // ── Regrade Selection Helpers ──
  const toggleRegradeSelection = (subId: string) => {
    setSelectedForRegrade(prev => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  const selectAllForRegrade = () => {
    const allEligible = new Set<string>();
    studentGroups.forEach(group => {
      group.submissions.forEach(s => {
        if (s.status === 'graded' && !s.is_exemplar && !s.manually_edited) {
          allEligible.add(s.id);
        }
      });
    });
    setSelectedForRegrade(allEligible);
  };

  const selectLatestForRegrade = () => {
    const latestOnly = new Set<string>();
    studentGroups.forEach(group => {
      const latest = group.submissions[group.submissions.length - 1];
      if (latest.status === 'graded' && !latest.is_exemplar && !latest.manually_edited) {
        latestOnly.add(latest.id);
      }
    });
    setSelectedForRegrade(latestOnly);
  };

  // ── Regrade Handler ──
  const handleRegrade = async () => {
    setShowRegradeConfirm(false);
    setRegrading(true);
    const count = selectedForRegrade.size;
    setRegradeProgress(`Regrading ${count} submission${count !== 1 ? 's' : ''} with ${exemplarCount} exemplar${exemplarCount !== 1 ? 's' : ''}...`);

    try {
      const res = await fetch('/api/regrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, submissionIds: Array.from(selectedForRegrade) }),
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

  // Google Classroom Batch Grader - include 'error' to allow retrying failed imports
  const pendingGcSubmissions = studentGroups.flatMap(g => g.submissions).filter(s => (s.status === 'pending' || s.status === 'error') && s.file_url?.startsWith('drive:'));

  const handleGradeGcSubmissions = async () => {
    if (pendingGcSubmissions.length === 0) return;
    setIsGradingGc(true);
    setGcProgress({ current: 0, total: pendingGcSubmissions.length });

    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    if (!providerToken) {
      alert("Google Classroom authentication expired. Please return to the Dashboard to reconnect.");
      setIsGradingGc(false);
      return;
    }

    for (let i = 0; i < pendingGcSubmissions.length; i++) {
      const sub = pendingGcSubmissions[i];
      const fileId = sub.file_url.replace('drive:', '');

      try {
        // 1. Download file via our API to bypass CORS
        const dlRes = await fetch(`/api/classroom/download?fileId=${fileId}`, {
          headers: { Authorization: `Bearer ${providerToken}` }
        });

        if (!dlRes.ok) throw new Error("Failed to download file from Google Drive");

        const blob = await dlRes.blob();
        // Get content disposition filename or default
        const contentDisposition = dlRes.headers.get('Content-Disposition');
        let filename = `submission_${sub.student_name.replace(/\s+/g, '_')}.pdf`;
        if (contentDisposition && contentDisposition.includes('filename="')) {
          filename = contentDisposition.split('filename="')[1].split('"')[0];
        }

        const file = new File([blob], filename, { type: blob.type });

        // 2. Upload to Supabase Storage
        const filePath = `${assignmentId}/${Date.now()}_${Math.random().toString(36).substring(7)}_${filename}`;
        const { error: uploadError } = await supabase.storage.from('submissions').upload(filePath, file);
        if (uploadError) throw new Error("Failed to upload to storage: " + uploadError.message);

        const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);
        const finalUrl = publicUrlData.publicUrl;

        // 3. Update DB record
        await supabase.from('submissions').update({ file_url: finalUrl, file_urls: [finalUrl] }).eq('id', sub.id);

        // 4. Trigger grading API
        const gradeRes = await fetch('/api/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: sub.id, sendEmail: false })
        });

        if (!gradeRes.ok) {
          const errData = await gradeRes.json();
          await supabase.from('submissions').update({ status: 'error', feedback: errData.error }).eq('id', sub.id);
        }

      } catch (err: any) {
        console.error("Error grading submission:", sub.id, err);
        await supabase.from('submissions').update({ status: 'error', feedback: err.message || "Failed to grade Google Classroom attachment." }).eq('id', sub.id);
      }

      setGcProgress({ current: i + 1, total: pendingGcSubmissions.length });
    }

    setIsGradingGc(false);
    // Reload page to show grades
    window.location.reload();
  };

  // Check auto-start on mount (could be passed via query string)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('gcImport') === 'true' && pendingGcSubmissions.length > 0 && !isGradingGc) {
        // Remove param to avoid infinite loop on reload if user interrupts
        window.history.replaceState({}, document.title, window.location.pathname);
        // Auto start grading!
        handleGradeGcSubmissions();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGcSubmissions.length]);

  const handleSyncToClassroom = async () => {
    if (!gcCourseId || !gcCourseworkId) return;

    setSyncingToGc(true);
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

    if (!providerToken) {
      alert("Google Classroom authentication expired. Please reconnect on the Dashboard.");
      setSyncingToGc(false);
      return;
    }

    try {
      // Gather grades to sync: latest graded submission per student that has a GC submission ID
      const gradesToSync: { gcSubmissionId: string, assignedGrade: number }[] = [];
      studentGroups.forEach(group => {
        const latestInfo = group.submissions[group.submissions.length - 1];
        if (latestInfo.status === 'graded' && latestInfo.gc_submission_id && latestInfo.score) {
          // Parse score (e.g. "8/10") into a number
          const scoreMatch = latestInfo.score.match(/^([\d.]+)/);
          if (scoreMatch) {
            const numericScore = parseFloat(scoreMatch[1]);
            gradesToSync.push({ gcSubmissionId: latestInfo.gc_submission_id, assignedGrade: numericScore });
          }
        }
      });

      if (gradesToSync.length === 0) {
        alert("No graded submissions with Google Classroom links found.");
        setSyncingToGc(false);
        return;
      }

      const res = await fetch('/api/classroom/return-grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerToken}`
        },
        body: JSON.stringify({
          courseId: gcCourseId,
          courseWorkId: gcCourseworkId,
          grades: gradesToSync
        })
      });

      const data = await res.json();
      if (!res.ok && res.status !== 207) { // 207 means partial success
        throw new Error(data.error || data.message || "Failed to sync grades");
      }

      alert(data.message || "Successfully synced grades to Google Classroom.");
    } catch (err: any) {
      console.error(err);
      alert(`Sync Error: ${err.message}`);
    }

    setSyncingToGc(false);
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
            <div className="flex items-center gap-3 mt-1">
              <p className="text-gray-500">{assignmentTitle}</p>
              {/* Inline submission limit editor */}
              {editingMaxAttempts ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={tempMaxAttempts}
                    onChange={(e) => setTempMaxAttempts(parseInt(e.target.value) || 1)}
                    min={1}
                    className="w-16 border border-indigo-300 rounded px-2 py-0.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveMaxAttempts()}
                  />
                  <button onClick={handleSaveMaxAttempts} disabled={savingMaxAttempts} className="text-indigo-600 hover:text-indigo-800">
                    <Save size={14} />
                  </button>
                  <button onClick={() => { setEditingMaxAttempts(false); setTempMaxAttempts(maxAttempts); }} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingMaxAttempts(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                  title="Click to change submission limit"
                >
                  Max: {maxAttempts} submission{maxAttempts !== 1 ? 's' : ''}
                  <Pencil size={10} />
                </button>
              )}
              {totalAiCost !== undefined && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full" title="Total AI Cost for this assignment (including generation and grading)">
                  💲 Est. AI Cost: ${totalAiCost.toFixed(3)}
                </span>
              )}
            </div>
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

            {pendingGcSubmissions.length > 0 && (
              <button
                onClick={handleGradeGcSubmissions}
                disabled={isGradingGc || syncingToGc}
                className="flex items-center gap-2 bg-emerald-600 border border-transparent text-white hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                {isGradingGc ? (
                  <><Loader2 size={16} className="animate-spin" /> Grading {gcProgress.current}/{gcProgress.total} GC...</>
                ) : (
                  <><Download size={16} /> Grade {pendingGcSubmissions.length} Ungraded GC Submissions</>
                )}
              </button>
            )}

            {gcCourseId && gcCourseworkId && studentGroups.length > 0 && (
              <button
                onClick={handleSyncToClassroom}
                disabled={syncingToGc || isGradingGc}
                className="flex items-center gap-2 bg-[#dbedf9] border border-[#a2d0ef] text-[#1E3A8A] hover:bg-[#b0d9f5] disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                {syncingToGc ? (
                  <><Loader2 size={16} className="animate-spin text-[#1E3A8A]" /> Syncing to GC...</>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-[#1E3A8A]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-3H8v3H6v-7.14l6-4.46 6 4.46V16.5h-2v-3h-3v3h-2z" /></svg>
                    Sync to Google Classroom
                  </>
                )}
              </button>
            )}

            {/* Regrade Button */}
            <button
              onClick={() => setShowRegradeConfirm(true)}
              disabled={regrading || selectedForRegrade.size === 0}
              className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              {regrading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {regrading ? 'Regrading...' : `Regrade (${selectedForRegrade.size})`}
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

            <Link
              href={`/teacher/analytics/${assignmentId}`}
              className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <BarChart3 size={16} /> Analytics
            </Link>

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
        <RegradeModal
          isOpen={showRegradeConfirm}
          onClose={() => setShowRegradeConfirm(false)}
          onRegrade={handleRegrade}
          regrading={regrading}
          selectedCount={selectedForRegrade.size}
          exemplarCount={exemplarCount}
          regradeEligibleCount={regradeEligibleCount}
          onSelectLatest={selectLatestForRegrade}
          onSelectAll={selectAllForRegrade}
          onClearSelection={() => setSelectedForRegrade(new Set())}
        />

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
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedEmail === group.email ? 'bg-indigo-50/50' : ''}`}
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
                              <Clock size={12} className="mr-1" /> Grading in progress...
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
                                        {/* Regrade checkbox — only for eligible submissions */}
                                        {sub.status === 'graded' && !sub.is_exemplar && !sub.manually_edited && (
                                          <input
                                            type="checkbox"
                                            checked={selectedForRegrade.has(sub.id)}
                                            onChange={() => toggleRegradeSelection(sub.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                                            title="Include in regrade"
                                          />
                                        )}
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
                                          {sub.ai_cost !== undefined && sub.ai_cost !== null && (
                                            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Est. Cost: ${Number(sub.ai_cost).toFixed(4)}</p>
                                          )}
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
                                            <CategoryBreakdown
                                              sub={sub}
                                              isEditing={true}
                                              editSkillAssessments={editSkillAssessments}
                                              setEditSkillAssessments={setEditSkillAssessments}
                                              editCategoryScores={editCategoryScores}
                                              setEditCategoryScores={setEditCategoryScores}
                                            />

                                            <div className="flex justify-end gap-2 mt-2">
                                              <button onClick={(e) => { e.stopPropagation(); cancelEditing(); }} className="flex items-center px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors relative z-10">
                                                <X size={14} className="mr-1" /> Cancel
                                              </button>
                                              <button onClick={(e) => { e.stopPropagation(); saveGradeOverride(sub, group.email); }} className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors relative z-10">
                                                <Save size={14} className="mr-1" /> Save Changes
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

                                            {/* Category/Skill Breakdown */}
                                            <CategoryBreakdown sub={sub} />
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
