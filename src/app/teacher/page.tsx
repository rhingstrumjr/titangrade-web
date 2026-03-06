"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Users, PlusCircle, Trash2, FileText, Link as LinkIcon, Pencil, XCircle, Sparkles, Loader2, Copy } from "lucide-react";

const supabase = createClient();

import Link from "next/link";
import { AnswerKeyEditor } from "./AnswerKeyEditor";
import { RubricBuilder } from "@/components/RubricBuilder";
import type { RubricCriterion } from "@/types/submission";

interface Class {
  id: string;
  name: string;
  created_at: string;
}

interface RosterStudent {
  id: string;
  name: string;
  email: string;
  class_id: string;
}

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
  auto_send_emails: boolean;
  class_id?: string | null;
  gc_course_id?: string | null;
  gc_coursework_id?: string | null;
  generated_key?: any;
  structured_rubric?: RubricCriterion[];
  ai_cost?: number;
  created_at: string;
}

export default function TeacherDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Google Classroom Import State
  const [providerToken, setProviderToken] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [gcCourses, setGcCourses] = useState<any[]>([]);
  const [selectedGcCourseId, setSelectedGcCourseId] = useState<string>("");
  const [gcAssignments, setGcAssignments] = useState<any[]>([]);
  const [selectedGcAssignmentId, setSelectedGcAssignmentId] = useState<string>("");
  const [isFetchingGc, setIsFetchingGc] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishTargetAssignmentId, setPublishTargetAssignmentId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [gradingFramework, setGradingFramework] = useState<"standard" | "marzano">("standard");
  const [newScore, setNewScore] = useState(100);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [isSocratic, setIsSocratic] = useState(false);
  const [autoSendEmails, setAutoSendEmails] = useState(true);
  const [rubricType, setRubricType] = useState<"text" | "file">("text");
  const [newRubricText, setNewRubricText] = useState("");
  const [newRubricFiles, setNewRubricFiles] = useState<File[]>([]);
  const [newExemplarFiles, setNewExemplarFiles] = useState<File[]>([]);
  const [structuredCriteria, setStructuredCriteria] = useState<RubricCriterion[]>([]);
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [autoParseError, setAutoParseError] = useState("");
  const [selectedClassesForNewAssignment, setSelectedClassesForNewAssignment] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [isDuplicatingId, setIsDuplicatingId] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<any>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKeyCost, setGeneratedKeyCost] = useState<number>(0);

  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  // Roster state
  const [isManagingRoster, setIsManagingRoster] = useState(false);
  const [classRoster, setClassRoster] = useState<RosterStudent[]>([]);
  const [rosterText, setRosterText] = useState("");
  const [singleStudentName, setSingleStudentName] = useState("");
  const [singleStudentEmail, setSingleStudentEmail] = useState("");
  const [savingRoster, setSavingRoster] = useState(false);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setClasses(data);
    }
  };

  const fetchAssignments = async () => {
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

  // Fetch initial data
  useEffect(() => {
    const checkGoogleAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.provider_token) {
        setGoogleConnected(true);
        setProviderToken(session.provider_token);
      }
    };
    checkGoogleAuth();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClasses();
    fetchAssignments();
  }, []);

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/classroom.rosters.readonly https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/drive.readonly',
        redirectTo: `${window.location.origin}/teacher`
      }
    });
    if (error) {
      console.error("Error signing in with Google:", error);
      alert("Failed to connect to Google Classroom.");
    }
  };

  const handleOpenImportModal = async () => {
    setIsImportModalOpen(true);
    if (gcCourses.length === 0 && providerToken) {
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
    }
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

  const executeGoogleClassroomImport = async () => {
    if (!selectedGcCourseId || !selectedGcAssignmentId || !providerToken) return;
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

      // 2. Create Assignment in DB
      let rubricText = data.assignment.description || "Edit assignment to add a detailed rubric.";

      const { data: newAssignment, error: assignError } = await supabase.from('assignments').insert([{
        title: data.assignment.title || "Imported Assignment",
        max_score: data.assignment.maxPoints || 100,
        rubric: rubricText,
        grading_framework: "standard",
        max_attempts: 1,
        class_id: selectedClassId || null,
        gc_course_id: selectedGcCourseId,
        gc_coursework_id: selectedGcAssignmentId
      }]).select().single();

      if (assignError) throw assignError;

      // 3. Insert Submissions in DB as 'pending'
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

      // 4. Redirect to Submissions page
      window.location.href = `/teacher/submissions/${newAssignment.id}`;

    } catch (err: any) {
      console.error(err);
      alert("Error importing from Google Classroom: " + err.message);
    }

    setIsImporting(false);
    setIsImportModalOpen(false);
  };

  const handleOpenPublishModal = async (assignmentId: string) => {
    setPublishTargetAssignmentId(assignmentId);
    setSelectedGcCourseId("");
    setIsPublishModalOpen(true);
    if (gcCourses.length === 0 && providerToken) {
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
    }
  };

  const executePublishToGc = async () => {
    if (!publishTargetAssignmentId || !selectedGcCourseId || !providerToken) return;
    setIsPublishing(true);
    try {
      const res = await fetch("/api/classroom/create-coursework", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}` },
        body: JSON.stringify({ assignmentId: publishTargetAssignmentId, courseId: selectedGcCourseId })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Successfully published. Refresh assignments.
      await fetchAssignments();
      setIsPublishModalOpen(false);
      setPublishTargetAssignmentId(null);
      alert("Successfully published assignment to Google Classroom!");
    } catch (err: any) {
      console.error(err);
      alert("Error publishing to Google Classroom: " + err.message);
    }
    setIsPublishing(false);
  };

  const handleCopyFromAssignment = (assignmentId: string) => {
    if (!assignmentId) return;
    const source = assignments.find(a => a.id === assignmentId);
    if (source) {
      setNewTitle(source.title + " (Copy)");
      setGradingFramework(source.grading_framework || "standard");
      setNewScore(source.max_score || 100);

      // If the source had a file-based rubric originally, 
      // the contents would just be the URL in the rubric text field.
      // We'll set it as text so it can be edited or overwritten.
      setRubricType("text");
      setNewRubricText(source.rubric || "");
      setStructuredCriteria(source.structured_rubric || []);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);

    // ── Auto-Parse Handler (inline) ──
    // (moved to a separate function below)

    let finalRubricValue = newRubricText;
    let finalRubricsArray = newRubricText ? [newRubricText] : [];
    let finalStructuredRubric: RubricCriterion[] | null = null;

    // Always check if the builder has criteria (it's always visible now)
    if (structuredCriteria.length > 0) {
      finalStructuredRubric = structuredCriteria.filter(c => c.name.trim());
      if (finalStructuredRubric.length > 0) {
        // Auto-generate plain text from structured criteria for backward compat
        const plainText = finalStructuredRubric.map(c => {
          let line = `${c.name} (${c.maxPoints} pts): ${c.description}`;
          if (c.levels && c.levels.length > 0) {
            const levelText = c.levels.map(l => `  - ${l.label} (${l.points} pts): ${l.description}`).join('\n');
            line += '\n' + levelText;
          }
          return line;
        }).join('\n\n');
        // Only override text if rubric type is text and text is empty, or always set as fallback
        if (!finalRubricValue.trim()) {
          finalRubricValue = plainText;
          finalRubricsArray = [plainText];
        }
      } else {
        finalStructuredRubric = null;
      }
    }

    if (rubricType === "file") {
      if (newRubricFiles.length > 0) {
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
      } else if (editingAssignment) {
        finalRubricValue = editingAssignment.rubric;
        finalRubricsArray = editingAssignment.rubrics || (editingAssignment.rubric ? [editingAssignment.rubric] : []);
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
    } else if (editingAssignment) {
      finalExemplarValue = editingAssignment.exemplar_url;
      finalExemplarArray = editingAssignment.exemplar_urls;
    }

    const finalScore = gradingFramework === "marzano" ? 4 : (finalStructuredRubric && finalStructuredRubric.length > 0 ? finalStructuredRubric.reduce((sum, c) => sum + c.maxPoints, 0) : newScore);

    if (editingAssignment) {
      const { error } = await supabase
        .from('assignments')
        .update({
          title: newTitle,
          max_score: finalScore,
          rubric: finalRubricValue,
          rubrics: finalRubricsArray.length > 0 ? finalRubricsArray : null,
          structured_rubric: finalStructuredRubric,
          exemplar_url: finalExemplarValue,
          exemplar_urls: finalExemplarArray,
          grading_framework: gradingFramework,
          max_attempts: maxAttempts,
          is_socratic: isSocratic,
          auto_send_emails: autoSendEmails,
          generated_key: generatedKey,
        })
        .eq('id', editingAssignment.id);

      if (error) {
        console.error("Error updating assignment:", error);
        alert("Failed to update assignment");
      } else {
        setAssignments(assignments.map(a => a.id === editingAssignment.id ? {
          ...a,
          title: newTitle,
          max_score: finalScore,
          rubric: finalRubricValue,
          rubrics: finalRubricsArray.length > 0 ? finalRubricsArray : null,
          exemplar_url: finalExemplarValue,
          exemplar_urls: finalExemplarArray,
          grading_framework: gradingFramework,
          max_attempts: maxAttempts,
          is_socratic: isSocratic,
          auto_send_emails: autoSendEmails,
          generated_key: generatedKey,
          ai_cost: generatedKeyCost,
        } as Assignment : a));
        resetFormState();
      }
      setCreateLoading(false);
      return;
    }

    const inserts = selectedClassesForNewAssignment.length > 0
      ? selectedClassesForNewAssignment.map(classId => ({
        title: newTitle,
        max_score: finalScore,
        rubric: finalRubricValue,
        rubrics: finalRubricsArray.length > 0 ? finalRubricsArray : null,
        structured_rubric: finalStructuredRubric,
        exemplar_url: finalExemplarValue,
        exemplar_urls: finalExemplarArray,
        grading_framework: gradingFramework,
        max_attempts: maxAttempts,
        is_socratic: isSocratic,
        auto_send_emails: autoSendEmails,
        class_id: classId,
        generated_key: generatedKey,
        ai_cost: generatedKeyCost
      }))
      : [{
        title: newTitle,
        max_score: finalScore,
        rubric: finalRubricValue,
        rubrics: finalRubricsArray.length > 0 ? finalRubricsArray : null,
        structured_rubric: finalStructuredRubric,
        exemplar_url: finalExemplarValue,
        exemplar_urls: finalExemplarArray,
        grading_framework: gradingFramework,
        max_attempts: maxAttempts,
        is_socratic: isSocratic,
        auto_send_emails: autoSendEmails,
        class_id: selectedClassId,
        generated_key: generatedKey,
        ai_cost: generatedKeyCost
      }];

    const { data, error } = await supabase
      .from('assignments')
      .insert(inserts)
      .select();

    if (error) {
      console.error("Error creating assignment:", error);
      alert("Failed to create assignment");
    } else if (data && data.length > 0) {
      setAssignments([...data, ...assignments]);
      resetFormState();
    }
    setCreateLoading(false);
  };

  const resetFormState = () => {
    setIsCreating(false);
    setEditingAssignment(null);
    setNewTitle("");
    setNewScore(100);
    setMaxAttempts(1);
    setIsSocratic(false);
    setAutoSendEmails(true);
    setGradingFramework("standard");
    setNewRubricText("");
    setNewRubricFiles([]);
    setNewExemplarFiles([]);
    setSelectedClassesForNewAssignment([]);
    setGeneratedKey(null);
    setGeneratedKeyCost(0);
    setStructuredCriteria([]);
    setAutoParseError("");
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setNewTitle(assignment.title);
    setGradingFramework(assignment.grading_framework);
    setNewScore(assignment.max_score);
    setMaxAttempts(assignment.max_attempts || 1);
    setIsSocratic(assignment.is_socratic || false);
    setAutoSendEmails(assignment.auto_send_emails !== false); // default to true if undefined
    setGeneratedKey(assignment.generated_key || null);
    setGeneratedKeyCost(assignment.ai_cost || 0);

    if (assignment.structured_rubric && assignment.structured_rubric.length > 0) {
      setStructuredCriteria(assignment.structured_rubric);
    }

    if (assignment.rubric && assignment.rubric.startsWith('http')) {
      setRubricType("file");
    } else {
      setRubricType("text");
      setNewRubricText(assignment.rubric || "");
    }

    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleDuplicateAssignment = async (assignment: Assignment) => {
    setIsDuplicatingId(assignment.id);

    const newAssignment = {
      title: `${assignment.title} (Copy)`,
      max_score: assignment.max_score,
      rubric: assignment.rubric,
      rubrics: assignment.rubrics,
      structured_rubric: assignment.structured_rubric,
      exemplar_url: assignment.exemplar_url,
      exemplar_urls: assignment.exemplar_urls,
      grading_framework: assignment.grading_framework,
      max_attempts: assignment.max_attempts,
      is_socratic: assignment.is_socratic,
      auto_send_emails: assignment.auto_send_emails,
      class_id: assignment.class_id,
      generated_key: assignment.generated_key,
    };

    const { data, error } = await supabase
      .from('assignments')
      .insert([newAssignment])
      .select();

    if (error) {
      console.error("Error duplicating assignment:", error);
      alert("Failed to duplicate assignment");
    } else if (data && data.length > 0) {
      setAssignments([data[0], ...assignments]);
    }

    setIsDuplicatingId(null);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const { data, error } = await supabase
      .from('classes')
      .insert([{ name: newClassName.trim() }])
      .select();

    if (!error && data && data[0]) {
      setClasses([...classes, data[0]]);
      setNewClassName("");
      setIsCreatingClass(false);
      setSelectedClassId(data[0].id);
    } else {
      console.error(error);
      alert("Failed to create class.");
    }
  };

  const handleOpenRoster = (classId: string) => {
    setSelectedClassId(classId);
    fetchRoster(classId);
    setIsManagingRoster(true);
  };

  const fetchRoster = async (classId: string) => {
    const { data, error } = await supabase
      .from('roster_students')
      .select('*')
      .eq('class_id', classId)
      .order('name');
    if (!error && data) {
      setClassRoster(data);
    }
  };

  const handleSaveRoster = async () => {
    if (!selectedClassId) return;
    setSavingRoster(true);

    // Parse bulk text (Name, Email separated by tab or comma)
    const lines = rosterText.split('\n');
    const newStudents = lines.map(line => {
      const parts = line.split(/[\t,]/).map(p => p.trim());
      if (parts.length >= 2 && parts[1].includes('@')) {
        return {
          class_id: selectedClassId,
          name: parts[0],
          email: parts[1]
        };
      }
      return null;
    }).filter(s => s !== null);

    if (newStudents.length > 0) {
      const { error } = await supabase
        .from('roster_students')
        .insert(newStudents);

      if (!error) {
        setRosterText("");
        fetchRoster(selectedClassId);
      } else {
        alert("Failed to import roster. Check format.");
      }
    }
    setSavingRoster(false);
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to remove this student from the roster?")) return;
    const { error } = await supabase.from('roster_students').delete().eq('id', studentId);
    if (!error) {
      setClassRoster(classRoster.filter(s => s.id !== studentId));
    }
  };

  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !singleStudentName.trim() || !singleStudentEmail.trim() || !singleStudentEmail.includes("@")) return;

    setSavingRoster(true);
    const { error } = await supabase
      .from('roster_students')
      .insert([{
        class_id: selectedClassId,
        name: singleStudentName.trim(),
        email: singleStudentEmail.trim()
      }]);

    if (!error) {
      setSingleStudentName("");
      setSingleStudentEmail("");
      fetchRoster(selectedClassId);
    } else {
      console.error(error);
      alert("Failed to add student. Error: " + error.message);
    }
    setSavingRoster(false);
  };

  const handleDeleteClass = async () => {
    if (!selectedClassId) return;
    if (!confirm("Are you sure you want to delete this CLASS completely? This will delete all its roster students. (Assignments will NOT be deleted, but they will lose their class tag).")) return;

    // First clear out the assignments pointing to this class
    await supabase.from('assignments').update({ class_id: null }).eq('class_id', selectedClassId);

    // Roster is likely cascade deleted, but delete just to be safe
    await supabase.from('roster_students').delete().eq('class_id', selectedClassId);

    const { error } = await supabase.from('classes').delete().eq('id', selectedClassId);
    if (!error) {
      setClasses(classes.filter(c => c.id !== selectedClassId));
      setIsManagingRoster(false);
      setSelectedClassId(null);
    } else {
      alert("Failed to delete class.");
    }
  };

  const displayedAssignments = selectedClassId
    ? assignments.filter(a => a.class_id === selectedClassId)
    : assignments;

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">TitanGrade Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage your class assignments and view student submissions</p>
          </div>
          <div className="flex items-center gap-3">
            {!googleConnected ? (
              <button
                onClick={handleGoogleLogin}
                className="bg-white border text-gray-700 hover:bg-gray-50 border-gray-300 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Connect Google Classroom
              </button>
            ) : (
              <button
                onClick={handleOpenImportModal}
                className="bg-emerald-50 border text-emerald-700 hover:bg-emerald-100 border-emerald-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center"
              >
                <Sparkles size={16} className="mr-2 text-emerald-600" /> Import from Classroom
              </button>
            )}

            {!isCreating && (
              <button
                onClick={() => { resetFormState(); setIsCreating(true); }}
                className="bg-indigo-600 border border-transparent text-white hover:bg-indigo-700 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md flex items-center"
              >
                <PlusCircle size={18} className="mr-2" /> Create Assignment
              </button>
            )}
          </div>
        </div>

        {isCreating && (
          <div className="bg-white p-6 md:p-8 border border-gray-200 rounded-xl mb-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold text-gray-900">{editingAssignment ? "Edit Assignment" : "Create New Assignment"}</h2>
              <button onClick={() => resetFormState()} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-6">
              {!editingAssignment && assignments.length > 0 && (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="text-indigo-600 mt-0.5">
                    <Copy size={20} />
                  </div>
                  <div className="flex-grow">
                    <label className="block text-sm font-semibold text-indigo-900 mb-1">Save time: Copy rubric from existing assignment</label>
                    <select
                      className="w-full border border-indigo-200 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                      onChange={(e) => handleCopyFromAssignment(e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>-- Select an assignment to copy from... --</option>
                      {assignments.map(a => (
                        <option key={a.id} value={a.id}>{a.title} {a.class_id ? `(${classes.find(c => c.id === a.class_id)?.name})` : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
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

                {!editingAssignment && classes.length > 0 && (
                  <div className="md:col-span-4 p-4 border border-gray-200 rounded-lg">
                    <label className="block text-sm font-semibold mb-2">Assign to Classes</label>
                    <div className="flex flex-wrap gap-3">
                      {classes.map(cls => (
                        <label key={cls.id} className="flex items-center space-x-2 text-sm bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedClassesForNewAssignment.includes(cls.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClassesForNewAssignment([...selectedClassesForNewAssignment, cls.id]);
                              } else {
                                setSelectedClassesForNewAssignment(selectedClassesForNewAssignment.filter(id => id !== cls.id));
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="font-medium text-gray-700">{cls.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

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

                <div className="md:col-span-4 flex items-center p-4 bg-gray-50 border border-gray-200 rounded-lg mt-2">
                  <input
                    id="auto-send-toggle"
                    type="checkbox"
                    checked={autoSendEmails}
                    onChange={(e) => setAutoSendEmails(e.target.checked)}
                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <label htmlFor="auto-send-toggle" className="font-semibold text-gray-900 cursor-pointer text-sm">
                      Auto-Send Grade Emails
                    </label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      If enabled, students will receive an email with their feedback as soon as the AI finishes grading. If disabled, you can manually release grades later.
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

                {/* Input Area */}
                {rubricType === "text" ? (
                  <textarea
                    required={!editingAssignment && structuredCriteria.length === 0}
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
                            required={!editingAssignment && structuredCriteria.length === 0}
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
                      {newRubricFiles.length > 0 ? (
                        <p className="text-sm font-semibold text-indigo-900 mt-2">{newRubricFiles.length} file(s) selected</p>
                      ) : (
                        editingAssignment && rubricType === "file" && (
                          <p className="text-sm font-semibold text-indigo-900 mt-2">Keeping previously uploaded file.</p>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-Parse Button */}
                {((rubricType === "text" && newRubricText.trim().length > 20) || (rubricType === "file" && newRubricFiles.length > 0)) && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsAutoParsing(true);
                        setAutoParseError("");
                        try {
                          let body: Record<string, string> = {};
                          if (rubricType === "file" && newRubricFiles.length > 0) {
                            const file = newRubricFiles[0];
                            const buffer = await file.arrayBuffer();
                            const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));
                            body = { file: base64, mimeType: file.type };
                          } else {
                            body = { text: newRubricText };
                          }
                          if (editingAssignment) body.assignmentId = editingAssignment.id;

                          const res = await fetch("/api/parse-rubric", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          });
                          const data = await res.json();
                          if (data.success && data.criteria) {
                            setStructuredCriteria(data.criteria);
                          } else {
                            setAutoParseError(data.error || "Failed to parse rubric.");
                          }
                        } catch (err) {
                          console.error(err);
                          setAutoParseError("Error connecting to AI.");
                        } finally {
                          setIsAutoParsing(false);
                        }
                      }}
                      disabled={isAutoParsing}
                      className="flex items-center gap-2 w-full justify-center bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                      {isAutoParsing ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Parsing rubric with AI...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          ✨ Auto-Parse into Structured Rubric
                        </>
                      )}
                    </button>
                    {autoParseError && (
                      <p className="text-sm text-red-600 mt-1">{autoParseError}</p>
                    )}
                  </div>
                )}

                {/* Structured Rubric Builder — always visible */}
                <div className="mt-4">
                  <RubricBuilder
                    criteria={structuredCriteria}
                    onChange={setStructuredCriteria}
                  />
                </div>
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
                    {newExemplarFiles.length > 0 ? (
                      <p className="text-sm font-semibold text-emerald-900 mt-2">{newExemplarFiles.length} file(s) selected</p>
                    ) : (
                      editingAssignment && editingAssignment.exemplar_url && (
                        <p className="text-sm font-semibold text-emerald-900 mt-2">Keeping previously uploaded exemplar.</p>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Optional: Auto-Generate Answer Key (AI)</label>
                <div className="mt-1 flex flex-col px-6 pt-5 pb-6 border border-gray-300 rounded-md bg-white">
                  {!generatedKey ? (
                    <div className="space-y-4 text-center">
                      <p className="text-sm text-gray-600">Upload a blank worksheet to automatically generate a structured JSON answer key using Gemini.</p>
                      <p className="text-xs text-indigo-600 font-medium bg-indigo-50 p-2 rounded-md inline-block">
                        <strong>Required Formats: PDF, PNG, or JPG.</strong> <br />
                        For Google Docs or Microsoft Word, please select <em>File &rarr; Download &rarr; PDF</em> first.
                      </p>

                      <div className="flex text-sm text-gray-600 justify-center">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 px-4 py-2 border border-blue-200 shadow-sm transition-colors hover:bg-blue-50">
                          {isGeneratingKey ? "Analyzing Document..." : "Select Blank Worksheet & Generate"}
                          <input
                            type="file"
                            className="sr-only"
                            accept=".pdf, .png, .jpg, .jpeg"
                            disabled={isGeneratingKey}
                            onChange={async (e) => {
                              if (e.target.files && e.target.files[0]) {
                                setIsGeneratingKey(true);
                                const formData = new FormData();
                                formData.append("file", e.target.files[0]);
                                try {
                                  const res = await fetch("/api/generate-key", { method: "POST", body: formData });
                                  const data = await res.json();
                                  if (data.success && data.answerKey) {
                                    setGeneratedKey(data.answerKey);
                                    if (data.estCost) setGeneratedKeyCost(data.estCost);
                                  } else {
                                    alert(data.error || "Failed to generate answer key.");
                                  }
                                } catch (err) {
                                  console.error(err);
                                  alert("Error generating key.");
                                } finally {
                                  setIsGeneratingKey(false);
                                }
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-emerald-600">Answer Key Generated!</span>
                        <button type="button" onClick={() => setGeneratedKey(null)} className="text-xs text-red-500 hover:underline">Clear Key</button>
                      </div>
                      <AnswerKeyEditor answerKey={generatedKey} onChange={setGeneratedKey} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-sm"
                >
                  {createLoading ? "Saving..." : (editingAssignment ? "Update Assignment" : "Create Assignment")}
                </button>
              </div>
            </form>
          </div>
        )
        }

        {/* Class Navigation & Assignment List */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto border border-gray-200">
              <button
                onClick={() => setSelectedClassId(null)}
                className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${selectedClassId === null ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"}`}
              >
                All Classes
              </button>
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${selectedClassId === cls.id ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"}`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsCreatingClass(!isCreatingClass)}
              className="text-sm flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap bg-indigo-50 px-3 py-1.5 rounded-full"
            >
              <PlusCircle size={16} /> Add Class
            </button>
          </div>

          {isCreatingClass && (
            <div className="bg-white p-4 border border-gray-200 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <input
                type="text"
                autoFocus
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g. Period 1 Biology"
                className="flex-grow border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateClass(e as unknown as React.FormEvent)}
              />
              <button onClick={handleCreateClass} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors">Save</button>
              <button onClick={() => setIsCreatingClass(false)} className="text-gray-500 hover:text-gray-700 text-sm font-medium">Cancel</button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">
                {selectedClassId ? classes.find(c => c.id === selectedClassId)?.name : "All Assignments"}
              </h2>
              {selectedClassId && (
                <button
                  onClick={() => handleOpenRoster(selectedClassId)}
                  className="text-sm border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5"
                >
                  <Users size={16} /> Manage Roster
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading assignments...</div>
          ) : displayedAssignments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No assignments found</h3>
              <p className="text-gray-500 mb-4">Create your first assignment for this class to start accepting submissions.</p>
              <button
                onClick={() => setIsCreating(true)}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Create New Assignment
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedAssignments.map((assignment) => (
                <div key={assignment.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <div className="p-6 flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-gray-900 truncate pr-2" title={assignment.title}>
                        {assignment.title}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleEditAssignment(assignment);
                          }}
                          className="text-gray-400 hover:text-indigo-600 transition-colors p-1.5 rounded-md hover:bg-indigo-50 focus:outline-none"
                          title="Edit Assignment"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleDuplicateAssignment(assignment);
                          }}
                          disabled={isDuplicatingId === assignment.id}
                          className="text-gray-400 hover:text-emerald-600 transition-colors p-1.5 rounded-md hover:bg-emerald-50 focus:outline-none flex-shrink-0"
                          title="Duplicate Assignment"
                        >
                          {isDuplicatingId === assignment.id ? (
                            <Loader2 className="animate-spin h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
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
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mb-4 mt-2">
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
                    <div className="flex items-center gap-2">
                      {!assignment.gc_coursework_id && googleConnected && (
                        <button
                          onClick={() => handleOpenPublishModal(assignment.id)}
                          className="flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-800 border border-emerald-300 rounded hover:bg-emerald-50 px-2 py-1 transition-colors bg-white shadow-sm"
                          title="Publish to Google Classroom"
                        >
                          <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          Publish to GC
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(assignment.id)}
                        className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-100 px-2 py-1 transition-colors bg-white shadow-sm"
                        title="Copy Student Submission Link"
                      >
                        <LinkIcon size={14} className="mr-1.5" />
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div >

      {/* Roster Management Modal */}
      {
        isManagingRoster && selectedClassId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  Class Roster: {classes.find(c => c.id === selectedClassId)?.name}
                  <button
                    onClick={handleDeleteClass}
                    className="text-xs bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-2 py-1 rounded flex items-center transition-colors"
                    title="Delete Class completely"
                  >
                    <Trash2 size={12} className="mr-1" /> Delete Class
                  </button>
                </h3>
                <button onClick={() => setIsManagingRoster(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-grow space-y-6">

                {/* Add Single Student Area */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-900 mb-3">Add Single Student</h4>
                  <form onSubmit={handleAddSingleStudent} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      value={singleStudentName}
                      onChange={(e) => setSingleStudentName(e.target.value)}
                      placeholder="Full Name"
                      className="flex-grow border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="email"
                      required
                      value={singleStudentEmail}
                      onChange={(e) => setSingleStudentEmail(e.target.value)}
                      placeholder="Student Email"
                      className="flex-grow border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={savingRoster}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
                    >
                      Add User
                    </button>
                  </form>
                </div>

                {/* Add Students Area */}
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                  <h4 className="font-semibold text-indigo-900 mb-2">Bulk Import Students</h4>
                  <p className="text-sm text-indigo-700 mb-3">
                    Paste a list of names and emails from your gradebook (spreadsheets/CSV). Ensure the format is <strong>Name, Email</strong> or separated by tabs.
                  </p>
                  <textarea
                    value={rosterText}
                    onChange={(e) => setRosterText(e.target.value)}
                    placeholder="John Doe, jdoe@school.org&#nJane Smith    jane.smith@school.org"
                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={handleSaveRoster}
                      disabled={savingRoster || !rosterText.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {savingRoster ? "Importing..." : "Import Roster"}
                    </button>
                  </div>
                </div>

                {/* Roster List */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Enrolled Students ({classRoster.length})</h4>
                  {classRoster.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No students added to this roster yet.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Name</th>
                            <th className="px-4 py-2 text-left font-medium">Email</th>
                            <th className="px-4 py-2 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {classRoster.map(s => (
                            <tr key={s.id} className="text-sm">
                              <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                              <td className="px-4 py-2 text-gray-500">{s.email}</td>
                              <td className="px-4 py-2 text-right">
                                <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700" title="Remove student">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )
      }

      {/* Google Classroom Import Modal */}
      {isImportModalOpen && (
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
              <button disabled={isImporting} onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
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
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImporting}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeGoogleClassroomImport}
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
      )}

      {/* Publish to Google Classroom Modal */}
      {isPublishModalOpen && (
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
              <button disabled={isPublishing} onClick={() => setIsPublishModalOpen(false)} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
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
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Select Google Classroom Course</label>
                    <select
                      className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      value={selectedGcCourseId}
                      onChange={(e) => setSelectedGcCourseId(e.target.value)}
                      disabled={isPublishing}
                    >
                      <option value="">-- Choose a Class --</option>
                      {gcCourses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      This will create a new coursework assignment in Google Classroom.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setIsPublishModalOpen(false)}
                disabled={isPublishing}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executePublishToGc}
                disabled={!selectedGcCourseId || isPublishing}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center shadow-sm"
              >
                {isPublishing ? (
                  <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Publishing...</>
                ) : (
                  "Publish"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
