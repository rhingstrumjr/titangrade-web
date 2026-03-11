"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AssignmentCard } from "@/components/dashboard/AssignmentCard";
import { ClassTabs } from "@/components/dashboard/ClassTabs";
import { ManageRosterModal } from "@/components/dashboard/ManageRosterModal";
import { CreateAssignmentModal } from "@/components/dashboard/CreateAssignmentModal";
import { GoogleClassroomImportModal } from "@/components/dashboard/GoogleClassroomImportModal";
import { PublishToGCModal } from "@/components/dashboard/PublishToGCModal";
import type { Class, Assignment } from "@/types/dashboard";
import { PlusCircle, Loader2 } from "lucide-react";

export default function TeacherDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [providerToken, setProviderToken] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);

  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showArchivedClasses, setShowArchivedClasses] = useState(false);

  // Modals state
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [manageRosterClassId, setManageRosterClassId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [publishTargetAssignmentId, setPublishTargetAssignmentId] = useState<string | null>(null);

  const [isSyncingClasses, setIsSyncingClasses] = useState(false);

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.push("/auth/signin");
      return;
    }
    const token = session.provider_token;
    if (token) {
      setProviderToken(token);
      setGoogleConnected(true);
    }
    await fetchData();
  };

  const fetchData = async () => {
    setIsLoading(true);
    const [cRes, aRes] = await Promise.all([
      supabase.from("classes").select("*").order("created_at", { ascending: true }),
      supabase.from("assignments").select("*").order("created_at", { ascending: false })
    ]);
    if (cRes.data) setClasses(cRes.data);
    if (aRes.data) setAssignments(aRes.data);
    setIsLoading(false);
  };

  // --- External Integrations ---

  const handleConnectGoogle = async () => {
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

  const handleSyncGoogleClasses = async () => {
    if (!providerToken) {
      handleConnectGoogle();
      return;
    }
    setIsSyncingClasses(true);
    try {
      const res = await fetch("/api/classroom/courses", {
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      const data = await res.json();
      
      if (data.courses && Array.isArray(data.courses)) {
        let addedCount = 0;
        const newClasses = [];
        
        for (const gcCourse of data.courses) {
          const exists = classes.some(c => c.gc_course_id === gcCourse.id);
          if (!exists) {
            const { data: newClass, error } = await supabase.from('classes').insert([{
              name: gcCourse.name,
              gc_course_id: gcCourse.id,
            }]).select().single();
            
            if (newClass && !error) {
              newClasses.push(newClass);
              addedCount++;
            }
          }
        }
        
        if (addedCount > 0) {
          setClasses([...classes, ...newClasses]);
          alert(`Successfully synced ${addedCount} classes from Google Classroom!`);
        } else {
          alert("All your Google Classroom courses are already matched in TitanGrade.");
        }
      }
    } catch (err: any) {
      console.error(err);
      alert("Error syncing classes: " + err.message);
    }
    setIsSyncingClasses(false);
  };

  // --- Classes and Roster ---

  const handleCreateClass = async (name: string) => {
    const { data: newClass, error } = await supabase.from('classes').insert([{ name }]).select().single();
    if (!error && newClass) {
      setClasses([...classes, newClass]);
      setSelectedClassId(newClass.id);
    } else {
      console.error(error);
      alert("Failed to create class.");
    }
  };

  const handleArchiveClass = async (classId: string, archiveStatus: boolean) => {
    const { error } = await supabase.from('classes').update({ is_archived: archiveStatus }).eq('id', classId);
    if (!error) {
      setClasses(classes.map(c => c.id === classId ? { ...c, is_archived: archiveStatus } : c));
      if (archiveStatus && selectedClassId === classId && !showArchivedClasses) {
        setSelectedClassId(null);
      }
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm("Are you sure you want to COMPLETELY DELETE this class? All associated assignments will be unlinked (but not deleted).")) return;
    
    await supabase.from('assignments').update({ class_id: null }).eq('class_id', classId);
    await supabase.from('roster_students').delete().eq('class_id', classId);
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    
    if (!error) {
      setClasses(classes.filter(c => c.id !== classId));
      if (selectedClassId === classId) setSelectedClassId(null);
      setManageRosterClassId(null);
      
      const updatedRes = await supabase.from("assignments").select("*").order("created_at", { ascending: false });
      if (updatedRes.data) setAssignments(updatedRes.data);
    }
  };

  // --- Assignments CRUD ---

  const handleCreateAssignment = async (title: string, classIds: string[]) => {
    const inserts = classIds.length > 0
      ? classIds.map(classId => ({
          title, class_id: classId, grading_framework: 'standard', max_score: 100, max_attempts: 1, feedback_release_mode: 'immediate', is_socratic: false
        }))
      : [{
          title, class_id: selectedClassId || null, grading_framework: 'standard', max_score: 100, max_attempts: 1, feedback_release_mode: 'immediate', is_socratic: false
        }];

    const { data, error } = await supabase.from('assignments').insert(inserts).select();

    if (error) {
      console.error("Error creating assignment:", error);
      alert("Failed to create assignment");
    } else if (data && data.length > 0) {
      // Redirect to the first assignment created
      window.location.href = `/teacher/assignments/${data[0].id}`;
    }
  };

  const handleDuplicateAssignment = async (assignmentId: string) => {
    const source = assignments.find(a => a.id === assignmentId);
    if (!source) return;

    const { data, error } = await supabase.from('assignments').insert([{
      title: source.title + " (Copy)",
      max_score: source.max_score,
      description: source.description,
      rubric: source.rubric,
      rubrics: source.rubrics,
      structured_rubric: source.structured_rubric,
      exemplar_url: source.exemplar_url,
      exemplar_urls: source.exemplar_urls,
      grading_framework: source.grading_framework,
      max_attempts: source.max_attempts,
      is_socratic: source.is_socratic,
      feedback_release_mode: source.feedback_release_mode || 'immediate',
      generated_key: source.generated_key,
      class_id: source.class_id,
    }]).select().single();

    if (error) {
      console.error(error);
      alert("Failed to duplicate assignment.");
    } else if (data) {
      setAssignments([data, ...assignments]);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this assignment and all submissions?")) return;
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
    if (!error) {
      setAssignments(assignments.filter(a => a.id !== assignmentId));
    }
  };

  // --- Sub-components data ---
  const activeClasses = classes.filter(c => showArchivedClasses || !c.is_archived);
  const displayedAssignments = selectedClassId 
    ? assignments.filter(a => a.class_id === selectedClassId)
    : assignments;

  const manageClassObj = manageRosterClassId ? classes.find(c => c.id === manageRosterClassId) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-indigo-600 border-2 border-indigo-600 rounded-md px-2 py-0.5">T</span> 
            TitanGrade
          </h1>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth/signin'); }} className="text-gray-500 hover:text-gray-700 font-medium">
            Sign Out
          </button>
        </div>
      </header>
      
      <main className="flex-grow max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Teacher Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage classes, assignments, and student submissions.</p>
          </div>
          
          <div className="flex gap-3">
            {!googleConnected ? (
              <button
                onClick={handleConnectGoogle}
                className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Connect Classroom
              </button>
            ) : (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#ffffff" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ffffff" />
                </svg>
                Import from GC
              </button>
            )}
            <button
              onClick={() => setIsCreatingAssignment(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
            >
              <PlusCircle size={18} /> New Assignment
            </button>
          </div>
        </div>

        {/* Classes Navigation */}
        <ClassTabs 
          classes={classes}
          activeClasses={activeClasses}
          selectedClassId={selectedClassId}
          assignments={assignments}
          showArchivedClasses={showArchivedClasses}
          googleConnected={googleConnected}
          isSyncingClasses={isSyncingClasses}
          onSelectClass={setSelectedClassId}
          onToggleArchived={setShowArchivedClasses}
          onManageRoster={setManageRosterClassId}
          onCreateClass={handleCreateClass}
          onSyncGoogleClasses={handleSyncGoogleClasses}
        />

        {/* Assignments List */}
        <div className="mt-8 space-y-4">
          {displayedAssignments.length === 0 ? (
            <div className="bg-white border-dashed border-2 border-gray-300 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-lg font-medium mb-1">No assignments found</p>
              <p className="text-sm">Click "New Assignment" or "Import from GC" to get started.</p>
            </div>
          ) : (
            displayedAssignments.map(assignment => (
              <AssignmentCard 
                key={assignment.id} 
                assignment={assignment} 
                isDuplicating={false}
                isDeleting={false}
                googleConnected={googleConnected}
                onDelete={handleDeleteAssignment}
                onDuplicate={handleDuplicateAssignment}
                onPublish={(id) => setPublishTargetAssignmentId(id)}
              />
            ))
          )}
        </div>

      </main>

      {/* Modals */}
      {isCreatingAssignment && (
        <CreateAssignmentModal
          classes={classes}
          initialClassId={selectedClassId}
          onClose={() => setIsCreatingAssignment(false)}
          onCreate={handleCreateAssignment}
        />
      )}

      {manageClassObj && (
        <ManageRosterModal
          cls={manageClassObj}
          onClose={() => setManageRosterClassId(null)}
          onArchiveClass={(arch) => handleArchiveClass(manageClassObj.id, arch)}
          onDeleteClass={() => handleDeleteClass(manageClassObj.id)}
        />
      )}

      {isImportModalOpen && (
        <GoogleClassroomImportModal
          providerToken={providerToken}
          classes={classes}
          assignments={assignments}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={() => {}}
        />
      )}

      {publishTargetAssignmentId && (
        <PublishToGCModal
          providerToken={providerToken}
          assignmentId={publishTargetAssignmentId}
          classes={classes}
          assignments={assignments}
          onClose={() => setPublishTargetAssignmentId(null)}
        />
      )}

    </div>
  );
}
