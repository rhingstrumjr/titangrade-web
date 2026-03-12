"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

const supabase = createClient();
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight, FileText, Download, Star, Edit2, X, Save, Send, RefreshCw, Loader2, BarChart3, Pencil } from "lucide-react";

import { Submission, StudentGroup } from "@/types/submission";
import { CategoryBreakdown } from "@/components/submissions/CategoryBreakdown";
import { RegradeModal } from "@/components/submissions/RegradeModal";
import { ScoreDiff } from "@/components/submissions/ScoreDiff";
import { AssignmentSettings } from "@/components/assignments/AssignmentSettings";
import { ActionsDropdown } from "@/components/assignments/ActionsDropdown";
import { AnalyticsDrawer } from "@/components/assignments/AnalyticsDrawer";

export default function AssignmentView() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const [assignment, setAssignment] = useState<any>(null);
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

  // Category score editing state
  const [editCategoryScores, setEditCategoryScores] = useState<{ category: string; earned: number; possible: number }[]>([]);
  const [editSkillAssessments, setEditSkillAssessments] = useState<{ level: string; dimension: string; skill: string; status: string }[]>([]);

  // Google Classroom integration state
  const [isGradingGc, setIsGradingGc] = useState(false);
  const [gcProgress, setGcProgress] = useState({ current: 0, total: 0 });
  const [gcCourseId, setGcCourseId] = useState<string | null>(null);
  const [gcCourseworkId, setGcCourseworkId] = useState<string | null>(null);
  const [syncingToGc, setSyncingToGc] = useState(false);
  const [syncingFromGc, setSyncingFromGc] = useState(false);
  const [autoSynced, setAutoSynced] = useState(false);
  const [releasingFeedback, setReleasingFeedback] = useState(false);
  
  // Analytics State
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  const isMarzano = assignment?.grading_framework === 'marzano';

  const getScoreColor = (scoreStr: string | null) => {
    if (!scoreStr) return "text-gray-900";
    const scoreNum = parseFloat(scoreStr.split('/')[0]);
    if (isNaN(scoreNum)) return "text-gray-900";

    if (!isMarzano) {
      const maxScore = assignment?.max_score || 100;
      const pct = (scoreNum / maxScore) * 100;
      if (pct >= 80) return "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded";
      if (pct >= 60) return "text-amber-700 bg-amber-50 px-2 py-0.5 rounded";
      return "text-red-700 bg-red-50 px-2 py-0.5 rounded";
    }

    // Marzano Score-based colors
    if (scoreNum >= 4.0) return "text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded";
    if (scoreNum >= 3.5) return "text-blue-700 bg-blue-50 px-2 py-0.5 rounded";
    if (scoreNum >= 3.0) return "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded"; // Proficient
    if (scoreNum >= 2.5) return "text-amber-700 bg-amber-50 px-2 py-0.5 rounded";
    if (scoreNum >= 2.0) return "text-orange-700 bg-orange-50 px-2 py-0.5 rounded";
    return "text-red-700 bg-red-50 px-2 py-0.5 rounded";
  };

  // Helper to group submission data
  const groupSubmissions = (subData: Submission[]) => {
    const groups: Record<string, StudentGroup> = {};
    subData.forEach((sub: Submission) => {
      if (!groups[sub.student_email]) {
        groups[sub.student_email] = { email: sub.student_email, name: sub.student_name, submissions: [], latestStatus: sub.status, latestScore: sub.score };
      }
      groups[sub.student_email].submissions.push(sub);
      groups[sub.student_email].latestStatus = sub.status;
      groups[sub.student_email].latestScore = sub.score;
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  };

  useEffect(() => {
    async function fetchData() {
      if (!assignmentId) return;

      const { data: assignData } = await supabase.from('assignments').select('*').eq('id', assignmentId).single();

      if (assignData) {
        setAssignment(assignData);
        setAssignmentTitle(assignData.title);
        setAssignmentCost(Number(assignData.ai_cost) || 0);
        setGcCourseId(assignData.gc_course_id);
        setGcCourseworkId(assignData.gc_coursework_id);
      }

      const { data: subData } = await supabase.from('submissions').select('*').eq('assignment_id', assignmentId).order('created_at', { ascending: true });

      if (subData) {
        const sortedGroups = groupSubmissions(subData);
        setStudentGroups(sortedGroups);
        const initialSelection = new Set<string>();
        sortedGroups.forEach(group => {
          const latest = group.submissions[group.submissions.length - 1];
          if ((latest.status === 'graded' || latest.status === 'error') && !latest.is_exemplar && !latest.manually_edited) {
            initialSelection.add(latest.id);
          }
        });
        setSelectedForRegrade(initialSelection);
      }
      setLoading(false);

      // Real-time subscriptions
      const channel = supabase
        .channel(`assignment_${assignmentId}_changes`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `assignment_id=eq.${assignmentId}` },
          (payload) => {
            if (!payload?.new) return;
            const updatedSub = payload.new as Submission;
            setStudentGroups(prevGroups => prevGroups.map(group => {
              if (group.email === updatedSub.student_email) {
                const updatedSubmissions = group.submissions.map(s => s.id === updatedSub.id ? updatedSub : s);
                return { ...group, submissions: updatedSubmissions, latestStatus: updatedSub.status, latestScore: updatedSub.score !== null ? updatedSub.score : group.latestScore };
              }
              return group;
            }));
          }
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignments', filter: `id=eq.${assignmentId}` },
          (payload) => {
            if (!payload?.new) return;
            const newA = payload.new as any;
            if (newA.title !== undefined) setAssignmentTitle(newA.title);
            if (newA.ai_cost !== undefined) setAssignmentCost(Number(newA.ai_cost) || 0);
            if (newA.gc_course_id !== undefined) setGcCourseId(newA.gc_course_id);
            if (newA.gc_coursework_id !== undefined) setGcCourseworkId(newA.gc_coursework_id);
            setAssignment((prev: any) => ({ ...prev, ...newA }));
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }

    const cleanup = fetchData();
    return () => { cleanup.then(fn => fn && fn()); };
  }, [assignmentId]);

  // Auto-sync from Google Classroom on page load
  useEffect(() => {
    if (!gcCourseId || !gcCourseworkId || autoSynced || loading) return;
    setAutoSynced(true);

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;
      if (!providerToken) return;

      try {
        const res = await fetch('/api/classroom/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${providerToken}` },
          body: JSON.stringify({ assignmentId })
        });
        const data = await res.json();
        if (res.ok && (data.newSubmissionsCount > 0 || data.updatedCount > 0)) {
          // Refresh submissions
          const { data: subData } = await supabase.from('submissions').select('*').eq('assignment_id', assignmentId).order('created_at', { ascending: true });
          if (subData) setStudentGroups(groupSubmissions(subData));
        }
      } catch (e) { console.error("Auto-sync error:", e); }
    })();
  }, [gcCourseId, gcCourseworkId, autoSynced, loading, assignmentId]);

  const toggleExpand = (email: string) => setExpandedEmail(expandedEmail === email ? null : email);

  const unreleasedCount = studentGroups.reduce(
    (count, group) => count + group.submissions.filter(s => s.status === 'graded' && !s.email_sent).length, 0
  );
  const exemplarCount = studentGroups.reduce(
    (count, group) => count + group.submissions.filter(s => s.is_exemplar).length, 0
  );
  const regradeEligibleCount = studentGroups.reduce(
    (count, group) => count + group.submissions.filter(s =>
      (s.status === 'graded' || s.status === 'error') && !s.is_exemplar && !s.manually_edited
    ).length, 0
  );
  const totalAiCost = assignmentCost + studentGroups.reduce(
    (total, group) => total + group.submissions.reduce((subTotal, s) => subTotal + (Number(s.ai_cost) || 0), 0), 0
  );

  // ── All handler functions (carried over from submissions page) ──

  const handleDownloadCSV = () => {
    if (studentGroups.length === 0) return;
    const headers = ["Student Name", "Email", "Latest Score", "Latest Status", "Number of Drafts"];
    const sampleSub = studentGroups[0]?.submissions[studentGroups[0].submissions.length - 1];
    const hasCategoryScores = sampleSub?.category_scores && sampleSub.category_scores.length > 0;
    const hasSkillAssessments = sampleSub?.skill_assessments && sampleSub.skill_assessments.length > 0;
    if (hasCategoryScores) sampleSub.category_scores!.forEach(cs => headers.push(`"${cs.category}"`));
    else if (hasSkillAssessments) sampleSub.skill_assessments!.forEach(sa => headers.push(`"${sa.level} ${sa.dimension}: ${sa.skill}"`));
    const rows = studentGroups.map(group => {
      const latest = group.submissions[group.submissions.length - 1];
      const row = [`"${group.name}"`, `"${group.email}"`, `"${group.latestScore || ''}"`, `"${group.latestStatus}"`, `"${group.submissions.length}"`];
      if (hasCategoryScores && latest.category_scores) latest.category_scores.forEach(cs => row.push(`"${cs.earned}/${cs.possible}"`));
      else if (hasSkillAssessments && latest.skill_assessments) latest.skill_assessments.forEach(sa => row.push(`"${sa.status}"`));
      return row;
    });
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `grades_${assignmentTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExemplar = async (submissionId: string, currentStatus: boolean, studentEmail: string) => {
    const { error } = await supabase.from('submissions').update({ is_exemplar: !currentStatus }).eq('id', submissionId);
    if (!error) {
      setStudentGroups(prevGroups => prevGroups.map(group => {
        if (group.email === studentEmail) {
          return { ...group, submissions: group.submissions.map(sub => sub.id === submissionId ? { ...sub, is_exemplar: !currentStatus } : sub) };
        }
        return group;
      }));
    } else { alert("Failed to toggle exemplar status."); }
  };

  const startEditing = (sub: Submission) => {
    setEditingSubId(sub.id);
    setEditScore(sub.score || "");
    setEditFeedback(sub.feedback || "");
    setEditSkillAssessments(sub.skill_assessments?.map(sa => ({ ...sa })) || []);
    setEditCategoryScores(sub.category_scores?.map(cs => ({ ...cs })) || []);
  };

  const cancelEditing = () => { setEditingSubId(null); setEditScore(""); setEditFeedback(""); };

  const saveGradeOverride = async (sub: Submission, email: string) => {
    const updatePayload: Record<string, unknown> = { score: editScore, feedback: editFeedback, manually_edited: true };
    if (sub.skill_assessments && sub.skill_assessments.length > 0) updatePayload.skill_assessments = editSkillAssessments;
    if (sub.category_scores && sub.category_scores.length > 0) updatePayload.category_scores = editCategoryScores;
    const { error } = await supabase.from('submissions').update(updatePayload).eq('id', sub.id);
    if (!error) {
      setStudentGroups(prevGroups => prevGroups.map(group => {
        if (group.email === email) {
          const updatedSubmissions = group.submissions.map(s =>
            s.id === sub.id ? { ...s, score: editScore, feedback: editFeedback, ...(sub.skill_assessments?.length ? { skill_assessments: editSkillAssessments } : {}), ...(sub.category_scores?.length ? { category_scores: editCategoryScores } : {}), manually_edited: true } : s
          );
          return { ...group, submissions: updatedSubmissions, latestScore: updatedSubmissions[updatedSubmissions.length - 1].score };
        }
        return group;
      }));
      setEditingSubId(null);
    } else { alert("Failed to save edited grade."); }
  };

  const handleReleaseGrades = async () => {
    if (!confirm("Release all pending grades? This sends emails to students.")) return;
    setReleasingGrades(true);
    try {
      const res = await fetch('/api/release_grades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignmentId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      alert(`Successfully released ${data.count} grades!`);
      setStudentGroups(prevGroups => prevGroups.map(group => ({
        ...group, submissions: group.submissions.map(sub => (sub.status === 'graded' && !sub.email_sent) ? { ...sub, email_sent: true } : sub)
      })));
    } catch (e: unknown) { alert(`Error: ${(e as Error).message}`); }
    setReleasingGrades(false);
  };

  // Regrade helpers
  const toggleRegradeSelection = (subId: string) => {
    setSelectedForRegrade(prev => { const next = new Set(prev); next.has(subId) ? next.delete(subId) : next.add(subId); return next; });
  };
  const selectAllForRegrade = () => {
    const all = new Set<string>();
    studentGroups.forEach(g => g.submissions.forEach(s => { if ((s.status === 'graded' || s.status === 'error') && !s.is_exemplar && !s.manually_edited) all.add(s.id); }));
    setSelectedForRegrade(all);
  };
  const selectLatestForRegrade = () => {
    const latest = new Set<string>();
    studentGroups.forEach(g => { const l = g.submissions[g.submissions.length - 1]; if ((l.status === 'graded' || l.status === 'error') && !l.is_exemplar && !l.manually_edited) latest.add(l.id); });
    setSelectedForRegrade(latest);
  };

  const handleRegrade = async () => {
    setShowRegradeConfirm(false);
    setRegrading(true);
    setRegradeProgress(`Regrading ${selectedForRegrade.size} submission(s) with ${exemplarCount} exemplar(s)...`);
    try {
      const res = await fetch('/api/regrade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignmentId, submissionIds: Array.from(selectedForRegrade) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Regrade failed');
      const { data: subData } = await supabase.from('submissions').select('*').eq('assignment_id', assignmentId).order('created_at', { ascending: true });
      if (subData) setStudentGroups(groupSubmissions(subData));
      alert(data.failures > 0 ? `Regraded ${data.count} (${data.failures} failed).` : `Successfully regraded ${data.count} submissions!`);
    } catch (e: unknown) { alert(`Regrade error: ${(e as Error).message}`); }
    setRegrading(false);
    setRegradeProgress(null);
  };

  // Google Classroom handlers — only count submissions that are "Ready for Feedback" (pending), not "Not Submitted"
  const pendingGcSubmissions = studentGroups.flatMap(g => g.submissions).filter(s => s.file_url?.startsWith('drive:') && s.status !== 'awaiting_submission');

  const handleGradeGcSubmissions = async () => {
    if (pendingGcSubmissions.length === 0) return;
    setIsGradingGc(true);
    setGcProgress({ current: 0, total: pendingGcSubmissions.length });
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    if (!providerToken) { alert("Google auth expired. Reconnect on Dashboard."); setIsGradingGc(false); return; }
    try {
      const batchSize = 5;
      for (let i = 0; i < pendingGcSubmissions.length; i += batchSize) {
        const batch = pendingGcSubmissions.slice(i, i + batchSize);
        setStudentGroups(prevGroups => prevGroups.map(group => {
          const inBatch = batch.some(s => s.student_email === group.email);
          if (inBatch) { return { ...group, submissions: group.submissions.map(s => batch.some(ps => ps.id === s.id) ? { ...s, status: 'grading' as any } : s), latestStatus: 'grading' as any }; }
          return group;
        }));
        await Promise.all(batch.map(async (submission) => {
          try {
            await fetch('/api/classroom/grade-single-bg', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${providerToken}` }, body: JSON.stringify({ submission, assignmentId }) });
          } catch (e) { console.error(`Fetch error for ${submission.id}:`, e); }
          finally { setGcProgress(prev => ({ ...prev, current: prev.current + 1 })); }
        }));
      }
    } catch (err: any) { alert("Batch grading error. Some may have failed."); }
    setIsGradingGc(false);
  };

  const handleGradeSingle = async (submission: Submission) => {
    setIsGradingGc(true);
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    if (!providerToken) { alert("Google auth expired."); setIsGradingGc(false); return; }
    setStudentGroups(prevGroups => prevGroups.map(group => {
      if (group.email === submission.student_email) { return { ...group, submissions: group.submissions.map(s => s.id === submission.id ? { ...s, status: 'grading' as any } : s), latestStatus: 'grading' as any }; }
      return group;
    }));
    try {
      const res = await fetch('/api/classroom/grade-single-bg', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${providerToken}` }, body: JSON.stringify({ submission, assignmentId }) });
      if (!res.ok) { const err = await res.json(); alert(`Grade failed: ${err.error || "Unknown error"}`); }
    } catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setIsGradingGc(false); }
  };

  // Auto-start GC import if query param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('gcImport') === 'true' && pendingGcSubmissions.length > 0 && !isGradingGc) {
        window.history.replaceState({}, document.title, window.location.pathname);
        handleGradeGcSubmissions();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGcSubmissions.length]);

  const handleSyncFromClassroom = async () => {
    if (!gcCourseId || !gcCourseworkId) return;
    setSyncingFromGc(true);
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    if (!providerToken) { alert("Google auth expired."); setSyncingFromGc(false); return; }
    try {
      const res = await fetch('/api/classroom/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${providerToken}` }, body: JSON.stringify({ assignmentId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      if (data.newSubmissionsCount > 0 || data.updatedCount > 0) {
        let msg = "Synced!";
        if (data.newSubmissionsCount > 0) msg += ` Added ${data.newSubmissionsCount} new.`;
        if (data.updatedCount > 0) msg += ` Updated ${data.updatedCount}.`;
        alert(msg);
        window.location.reload();
      } else { alert("Already up to date."); }
    } catch (err: any) { alert("Sync failed: " + err.message); }
    setSyncingFromGc(false);
  };

  const handlePushGradesToGc = async () => {
    if (!gcCourseId || !gcCourseworkId) return;
    setSyncingToGc(true);
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    if (!providerToken) { alert("Google auth expired."); setSyncingToGc(false); return; }
    try {
      const gradesToSync: { gcSubmissionId: string, assignedGrade: number }[] = [];
      studentGroups.forEach(group => {
        const latest = group.submissions[group.submissions.length - 1];
        if (latest.status === 'graded' && latest.gc_submission_id && latest.score) {
          const scoreMatch = latest.score.match(/^([\d.]+)/);
          if (scoreMatch) gradesToSync.push({ gcSubmissionId: latest.gc_submission_id, assignedGrade: parseFloat(scoreMatch[1]) });
        }
      });
      if (gradesToSync.length === 0) { alert("No graded submissions with GC links."); setSyncingToGc(false); return; }
      const res = await fetch('/api/classroom/return-grades', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${providerToken}` }, body: JSON.stringify({ courseId: gcCourseId, courseWorkId: gcCourseworkId, grades: gradesToSync }) });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error || "Failed");
      alert(res.status === 207 ? data.message : (data.message || "Grades synced to Classroom."));
    } catch (err: any) { alert(`Sync Error: ${err.message}`); }
    setSyncingToGc(false);
  };

  const handleReleaseFeedback = async () => {
    if (!gcCourseId || !gcCourseworkId) return;
    setReleasingFeedback(true);
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    if (!providerToken) { alert("Google auth expired."); setReleasingFeedback(false); return; }
    try {
      const res = await fetch('/api/classroom/post-feedback-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${providerToken}` },
        body: JSON.stringify({ assignmentId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release feedback");
      if (data.count === 0) {
        const reasons = data.debug?.skippedReasons?.length 
          ? `\n\nReasons:\n${data.debug.skippedReasons.join('\n')}`
          : "\n\n(No specific skip reasons were returned by the server.)";
        alert(`0 students were updated.${reasons}`);
      } else {
        alert(`Successfully generated and attached feedback to ${data.count} student(s) in Google Classroom!`);
      }
    } catch (err: any) { alert(`Release Error: ${err.message}`); }
    setReleasingFeedback(false);
  };

  // ── Status badge helper ──
  const StatusBadge = ({ status, emailSent }: { status: string; emailSent?: boolean }) => {
    if (status === 'graded') return (
      <div className="flex flex-col">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
          <CheckCircle2 size={12} className="mr-1" /> Graded
        </span>
        {!emailSent && <span className="text-[10px] text-orange-600 mt-0.5 font-medium ml-1 flex items-center"><Clock size={10} className="mr-1" /> Pending Release</span>}
      </div>
    );
    if (status === 'pending') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Clock size={12} className="mr-1" /> Ready for Feedback</span>;
    if (status === 'awaiting_submission') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><Clock size={12} className="mr-1" /> Not Submitted</span>;
    if (status === 'grading') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse"><Loader2 size={12} className="mr-1 animate-spin" /> Grading...</span>;
    if (status === 'error') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle size={12} className="mr-1" /> Error</span>;
    return <span className="text-gray-400 text-xs">{status}</span>;
  };

  // ── JSX ──
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="pb-4 border-b border-gray-200">
          <Link href="/teacher" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-3 transition-colors">
            <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">{assignmentTitle}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {assignment?.grading_framework && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    {assignment.grading_framework === 'ngss_skills' ? 'NGSS SEP Skills' : assignment.grading_framework === 'ngss_rubric' ? 'NGSS Rubric' : 'Criteria-Based'}
                  </span>
                )}
                {assignment?.max_score && <span className="text-xs text-gray-500 font-medium">Max: {assignment.max_score} pts</span>}
                {assignment?.max_attempts && <span className="text-xs text-gray-500 font-medium">Limit: {assignment.max_attempts} attempt{assignment.max_attempts !== 1 ? 's' : ''}</span>}
                {totalAiCost > 0 && <span className="text-xs text-emerald-600 font-medium">AI Cost: ${totalAiCost.toFixed(4)}</span>}
                {exemplarCount > 0 && <span className="text-xs text-amber-600 font-medium">⭐ {exemplarCount} exemplar{exemplarCount !== 1 ? 's' : ''}</span>}
                {gcCourseId && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Google Classroom</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {assignment && <AssignmentSettings assignment={assignment} onUpdate={(updated) => { setAssignment(updated); setAssignmentTitle(updated.title); }} />}

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Primary: Release Grades */}
          {unreleasedCount > 0 && (
            <button onClick={handleReleaseGrades} disabled={releasingGrades}
              className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
              <Send size={16} /> {releasingGrades ? "Releasing..." : `Release ${unreleasedCount} Grades`}
            </button>
          )}

          {/* Primary: Grade GC Submissions */}
          {pendingGcSubmissions.length > 0 && (
            <button onClick={handleGradeGcSubmissions} disabled={isGradingGc}
              className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
              {isGradingGc ? <><Loader2 size={16} className="animate-spin" /> Grading {gcProgress.current}/{gcProgress.total}...</> : <><Download size={16} /> Grade {pendingGcSubmissions.length} Ungraded</>}
            </button>
          )}

          {/* Secondary: Actions Dropdown & Analytics */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsAnalyticsOpen(true)}
              className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <BarChart3 size={16} /> Analytics
            </button>
            <ActionsDropdown
            assignmentId={assignmentId}
            onRegrade={() => setShowRegradeConfirm(true)}
            regrading={regrading}
            selectedRegradeCount={selectedForRegrade.size}
            onSyncFromClassroom={handleSyncFromClassroom}
            syncingFromGc={syncingFromGc}
            onPushGradesToGc={handlePushGradesToGc}
            syncingToGc={syncingToGc}
            onReleaseFeedback={handleReleaseFeedback}
            releasingFeedback={releasingFeedback}
            onDownloadCSV={handleDownloadCSV}
            hasStudents={studentGroups.length > 0}
            isGcLinked={!!(gcCourseId && gcCourseworkId)}
            isGradingGc={isGradingGc}
          />
          </div>
        </div>

        {/* Analytics Drawer */}
        <AnalyticsDrawer 
          isOpen={isAnalyticsOpen} 
          onClose={() => setIsAnalyticsOpen(false)} 
          assignment={assignment} 
          submissions={studentGroups.flatMap(g => g.submissions)} 
        />

        {/* Regrade Modal */}
        <RegradeModal isOpen={showRegradeConfirm} onClose={() => setShowRegradeConfirm(false)} onRegrade={handleRegrade} regrading={regrading} selectedCount={selectedForRegrade.size} exemplarCount={exemplarCount} regradeEligibleCount={regradeEligibleCount} onSelectLatest={selectLatestForRegrade} onSelectAll={selectAllForRegrade} onClearSelection={() => setSelectedForRegrade(new Set())} />

        {/* Regrade Progress */}
        {regrading && regradeProgress && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3 animate-pulse">
            <Loader2 size={20} className="text-purple-600 animate-spin" />
            <p className="text-sm font-medium text-purple-800">{regradeProgress}</p>
          </div>
        )}

        {/* Submissions Table */}
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
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                      <input type="checkbox"
                        checked={selectedForRegrade.size > 0 && selectedForRegrade.size === regradeEligibleCount}
                        onChange={() => selectedForRegrade.size === regradeEligibleCount ? setSelectedForRegrade(new Set()) : selectAllForRegrade()}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        title="Select all for regrade"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drafts</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {studentGroups.map((group) => {
                    const latest = group.submissions[group.submissions.length - 1];
                    const isRegradeEligible = (latest.status === 'graded' || latest.status === 'error') && !latest.is_exemplar && !latest.manually_edited;
                    const isGradeEligible = latest.status === 'pending' && latest.file_url?.startsWith('drive:');
                    const showCheckbox = isRegradeEligible || isGradeEligible;

                    return (
                      <React.Fragment key={group.email}>
                        {/* Top-level row — always visible */}
                        <tr className={`hover:bg-gray-50 transition-colors ${expandedEmail === group.email ? 'bg-indigo-50/50' : ''}`}>
                          <td className="px-4 py-3">
                            {showCheckbox && (
                              <input type="checkbox" checked={selectedForRegrade.has(latest.id)} onChange={() => toggleRegradeSelection(latest.id)}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer" title={isRegradeEligible ? "Include in regrade" : "Select for grading"} />
                            )}
                          </td>
                          {/* Student name - clickable to expand */}
                          <td className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpand(group.email)}>
                            <div className="flex items-center">
                              {expandedEmail === group.email ? <ChevronDown size={16} className="text-gray-400 mr-2" /> : <ChevronRight size={16} className="text-gray-400 mr-2" />}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{group.name}</div>
                                <div className="text-xs text-gray-500">{group.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-medium">
                            {group.submissions.length}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={group.latestStatus} emailSent={latest.email_sent} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-sm font-bold ${getScoreColor(group.latestScore)}`}>{group.latestScore || '—'}</span>
                            {latest.pre_regrade_score && <div className="mt-0.5"><ScoreDiff oldScore={latest.pre_regrade_score} newScore={latest.score || ''} /></div>}
                          </td>
                          {/* Compact action icons */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* Exemplar toggle */}
                              {latest.status === 'graded' && (
                                <button onClick={(e) => { e.stopPropagation(); toggleExemplar(latest.id, latest.is_exemplar, group.email); }}
                                  className={`p-1.5 rounded-md transition-colors ${latest.is_exemplar ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
                                  title={latest.is_exemplar ? "Unmark exemplar" : "Mark as exemplar"}>
                                  <Star size={14} className={latest.is_exemplar ? "fill-amber-500" : ""} />
                                </button>
                              )}
                              {/* Edit grade */}
                              {latest.status === 'graded' && (
                                <button onClick={(e) => { e.stopPropagation(); startEditing(latest); toggleExpand(group.email); }}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit grade">
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {/* View doc */}
                              {latest.file_url && !latest.file_url.startsWith('drive:') && (
                                <a href={latest.file_url} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View document">
                                  <FileText size={14} />
                                </a>
                              )}
                              {/* Grade single pending import */}
                              {latest.file_url?.startsWith('drive:') && (
                                <button onClick={(e) => { e.stopPropagation(); handleGradeSingle(latest); }} disabled={isGradingGc}
                                  className="p-1.5 rounded-md text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 transition-colors" title="Import & grade">
                                  {isGradingGc ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {expandedEmail === group.email && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50 p-0 border-b border-gray-200">
                              <div className="px-10 py-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Submission History</h4>
                                <div className="space-y-3">
                                  {group.submissions.map((sub, index) => (
                                    <div key={sub.id} className="bg-white border text-sm border-gray-200 rounded-lg p-4 flex flex-col gap-4 shadow-sm">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">{index + 1}</div>
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <p className="font-medium text-gray-900">Draft {index + 1}</p>
                                              {sub.manually_edited && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 border border-blue-200 text-blue-700">Manually Edited</span>}
                                            </div>
                                            <p className="text-xs text-gray-500">{new Date(sub.created_at).toLocaleString()}</p>
                                            {sub.ai_cost != null && <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Est. Cost: ${Number(sub.ai_cost).toFixed(4)}</p>}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                          {sub.status === 'graded' && sub.score ? (
                                            editingSubId === sub.id ? (
                                              <div className="flex flex-col">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Score</p>
                                                <input type="text" value={editScore} onChange={(e) => setEditScore(e.target.value)}
                                                  className="border border-gray-300 rounded px-2 py-1 text-sm font-bold w-20 text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                                              </div>
                                            ) : (
                                              <div className="text-center">
                                                <p className="text-xs text-gray-500 uppercase font-semibold">Score</p>
                                                <p className="font-bold text-gray-900">{sub.score}</p>
                                                {sub.pre_regrade_score && <div className="mt-1"><ScoreDiff oldScore={sub.pre_regrade_score} newScore={sub.score} /></div>}
                                              </div>
                                            )
                                          ) : sub.status === 'pending' ? (
                                            <p className="text-amber-600 font-medium text-xs flex items-center"><Clock size={12} className="mr-1" /> Ready for Feedback</p>
                                          ) : null}

                                          <div className="flex flex-col gap-2 relative z-10">
                                            {sub.file_url?.startsWith('drive:') ? (
                                              <button disabled={isGradingGc} onClick={(e) => { e.stopPropagation(); handleGradeSingle(sub); }}
                                                className="flex items-center justify-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-md font-medium text-xs shadow-sm">
                                                {isGradingGc ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Pending Import
                                              </button>
                                            ) : sub.file_urls && sub.file_urls.length > 1 ? (
                                              <div className="flex flex-wrap gap-1">
                                                {sub.file_urls.map((url, idx) => (
                                                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md font-medium text-[10px]">
                                                    <FileText size={10} /> Doc {idx + 1}
                                                  </a>
                                                ))}
                                              </div>
                                            ) : (
                                              <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-md font-medium text-xs">
                                                <FileText size={14} /> View Document
                                              </a>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); toggleExemplar(sub.id, sub.is_exemplar, group.email); }}
                                              className={`flex items-center justify-center gap-1.5 transition-colors border px-3 py-1.5 rounded-md font-medium text-xs ${sub.is_exemplar ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-amber-600"}`}>
                                              <Star size={14} className={sub.is_exemplar ? "fill-amber-500 text-amber-500" : ""} />
                                              {sub.is_exemplar ? "Unmark Exemplar" : "Mark as Exemplar"}
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Feedback & Error */}
                                      {(sub.status === 'graded' || sub.status === 'error') && (
                                        <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                                          {sub.status === 'error' && (
                                            <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-red-700 text-xs mb-2">
                                              <strong>Error:</strong> {sub.feedback || "Unknown error."}
                                            </div>
                                          )}
                                          {sub.status === 'graded' && (
                                            <>
                                              {editingSubId === sub.id ? (
                                                <>
                                                  <p className="text-xs text-gray-500 uppercase font-semibold">Feedback</p>
                                                  <textarea value={editFeedback} onChange={(e) => setEditFeedback(e.target.value)} rows={3}
                                                    className="border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none w-full" />
                                                  <CategoryBreakdown sub={sub} isEditing={true} editSkillAssessments={editSkillAssessments} setEditSkillAssessments={setEditSkillAssessments} editCategoryScores={editCategoryScores} setEditCategoryScores={setEditCategoryScores} />
                                                  <div className="flex justify-end gap-2 mt-2">
                                                    <button onClick={(e) => { e.stopPropagation(); cancelEditing(); }} className="flex items-center px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors relative z-10"><X size={14} className="mr-1" /> Cancel</button>
                                                    <button onClick={(e) => { e.stopPropagation(); saveGradeOverride(sub, group.email); }} className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors relative z-10"><Save size={14} className="mr-1" /> Save</button>
                                                  </div>
                                                </>
                                              ) : (
                                                <>
                                                  <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-1">
                                                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Feedback</p>
                                                      <p className="text-gray-700 italic whitespace-pre-wrap">&quot;{sub.feedback}&quot;</p>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); startEditing(sub); }} className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors bg-white border border-gray-200 hover:border-indigo-200 px-3 py-1.5 rounded-md relative z-10"><Edit2 size={14} /> Edit Grade</button>
                                                  </div>
                                                  {sub.pre_regrade_feedback && (
                                                    <details className="mt-2">
                                                      <summary className="cursor-pointer text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">View previous feedback</summary>
                                                      <div className="mt-2 bg-purple-50 border border-purple-100 rounded-lg p-3">
                                                        <p className="text-sm text-purple-800 italic whitespace-pre-wrap">&quot;{sub.pre_regrade_feedback}&quot;</p>
                                                      </div>
                                                    </details>
                                                  )}
                                                  <CategoryBreakdown sub={sub} />
                                                  {((sub.transcription?.length ?? 0) > 0 || (sub.reasoning?.length ?? 0) > 0) && (
                                                    <details className="mt-4 border border-indigo-100 rounded-lg bg-indigo-50/50">
                                                      <summary className="cursor-pointer text-sm font-semibold text-indigo-700 hover:text-indigo-800 transition-colors p-3 bg-indigo-50/80 rounded-t-lg">View AI Grading Details</summary>
                                                      <div className="p-4 space-y-4">
                                                        {sub.transcription && sub.transcription.length > 0 && (
                                                          <div><h4 className="text-xs uppercase font-bold text-indigo-900 mb-2">1. AI Extracted Answers</h4>
                                                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">{sub.transcription.map((step: any, idx: number) => <li key={idx}>{step}</li>)}</ul></div>
                                                        )}
                                                        {sub.reasoning && sub.reasoning.length > 0 && (
                                                          <div><h4 className="text-xs uppercase font-bold text-indigo-900 mb-2">2. AI Scoring Reasoning</h4>
                                                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">{sub.reasoning.map((step: any, idx: number) => <li key={idx}>{step}</li>)}</ul></div>
                                                        )}
                                                      </div>
                                                    </details>
                                                  )}
                                                </>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
