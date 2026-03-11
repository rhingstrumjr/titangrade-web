"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, ArrowLeft, Table as TableIcon } from "lucide-react";
import { GradebookCellModal } from "@/components/dashboard/GradebookCellModal";

export default function GradebookPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [classData, setClassData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignmentGroups, setAssignmentGroups] = useState<any[]>([]);

  // Modal State
  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [activeAnchorRect, setActiveAnchorRect] = useState<DOMRect | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<any | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [activeStudentName, setActiveStudentName] = useState("");

  // Bulk Selection State
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      // Fetch class details
      const { data: cData } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();
      setClassData(cData);

      // Fetch students for the class
      const { data: sData } = await supabase
        .from("roster_students")
        .select("*")
        .eq("class_id", classId)
        .order("name");
      if (sData) setStudents(sData);

      // Fetch assignments for the class
      const { data: aData } = await supabase
        .from("assignments")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: true });
      if (aData) setAssignments(aData);

      if (aData && aData.length > 0) {
        const assignmentIds = aData.map((a) => a.id);
        const { data: subData } = await supabase
          .from("submissions")
          .select("*")
          .in("assignment_id", assignmentIds);
        if (subData) setSubmissions(subData);
      }

      // Group assignments by topic
      const grouped: Record<string, any[]> = {};
      const ungrouped: any[] = [];
      
      aData?.forEach((a) => {
        if (a.topic) {
          if (!grouped[a.topic]) grouped[a.topic] = [];
          grouped[a.topic].push(a);
        } else {
          ungrouped.push(a);
        }
      });
      
      const orderedTopics = Object.keys(grouped).sort();
      const finalOrderedGroups = [];
      for (const t of orderedTopics) {
        finalOrderedGroups.push({ topic: t, assignments: grouped[t] });
      }
      if (ungrouped.length > 0) {
        finalOrderedGroups.push({ topic: "Ungrouped", assignments: ungrouped });
      }
      setAssignmentGroups(finalOrderedGroups);

      setIsLoading(false);
    }
    fetchData();
  }, [classId, supabase]);

  // Helper to get a percentage from score string like "85/100" or "3.5/4.0"
  const getPercentage = (scoreText?: string | null) => {
    if (!scoreText) return 0;
    const parts = scoreText.split("/");
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (den > 0) return (num / den) * 100;
    }
    return 0;
  };

  // Helper to get color class based on percentage
  const getHeatmapColor = (pct: number) => {
    if (pct >= 90) return "bg-green-100 text-green-800";
    if (pct >= 80) return "bg-emerald-50 text-emerald-800";
    if (pct >= 70) return "bg-yellow-100 text-yellow-800";
    if (pct >= 60) return "bg-orange-100 text-orange-800";
    if (pct > 0) return "bg-red-100 text-red-800";
    return "bg-gray-50 text-gray-500";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Calculate sparkline points for a student
  const getSparklinePoints = (studentEmail: string) => {
    // Collect all assignments in order
    const allAssignments = assignmentGroups.flatMap(g => g.assignments);
    const points: number[] = [];
    allAssignments.forEach(a => {
      const sub = submissions.find(s => s.assignment_id === a.id && s.student_email === studentEmail);
      if (sub && sub.score) {
        points.push(getPercentage(sub.score));
      }
    });
    return points;
  };

  const renderSparkline = (points: number[]) => {
    if (points.length < 2) return null;
    const padding = 2;
    const w = 40;
    const h = 20;
    const minVal = 0;
    const maxVal = 100;
    const dx = w / (points.length - 1);
    const dy = (h - padding * 2) / (maxVal - minVal);
    
    // Create path
    const pathData = points.map((p, i) => {
      const x = i * dx;
      const y = h - padding - (p - minVal) * dy;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const trend = points[points.length - 1] - points[0];
    const color = trend >= 0 ? "#10B981" : "#EF4444"; // green or red

    return (
      <svg width={w} height={h} className="overflow-visible ml-2">
        <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.length > 0 && (
          <circle cx={(points.length - 1) * dx} cy={h - padding - (points[points.length - 1] - minVal) * dy} r="2" fill={color} />
        )}
      </svg>
    );
  };

  const handleCellClick = (e: React.MouseEvent, sub: any, assignment: any, studentName: string) => {
    e.stopPropagation();
    if (!sub) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setActiveAnchorRect(rect);
    setActiveSubmission(sub);
    setActiveAssignment(assignment);
    setActiveStudentName(studentName);
    setCellModalOpen(true);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(new Set(students.map(s => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  const handleBulkCreateAssignment = () => {
    alert(`Creating individualized assignment for ${selectedStudentIds.size} selected students. Redirecting to Assignment Builder...`);
    // Example: router.push('/teacher/assignments/create?students=' + Array.from(selectedStudentIds).join(','));
  };

  const handleSaveCell = async (score: string, feedback: string) => {
    if (!activeSubmission) return;
    const { error } = await supabase
      .from('submissions')
      .update({ score, feedback, manually_edited: true })
      .eq('id', activeSubmission.id);
      
    if (!error) {
      setSubmissions(prev => prev.map(s => 
        s.id === activeSubmission.id 
          ? { ...s, score, feedback, manually_edited: true } 
          : s
      ));
    } else {
      alert("Failed to save edited grade.");
    }
  };

  const handleToggleExemplarCell = async () => {
    if (!activeSubmission) return;
    const newStatus = !activeSubmission.is_exemplar;
    const { error } = await supabase
      .from('submissions')
      .update({ is_exemplar: newStatus })
      .eq('id', activeSubmission.id);
      
    if (!error) {
      setSubmissions(prev => prev.map(s => 
        s.id === activeSubmission.id 
          ? { ...s, is_exemplar: newStatus } 
          : s
      ));
      setActiveSubmission({ ...activeSubmission, is_exemplar: newStatus });
    } else {
      alert("Failed to toggle exemplar status.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 pb-20 overflow-hidden">
      <header className="bg-white shadow z-10 relative">
        <div className="max-w-[100vw] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/teacher")}
              className="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={20} />
              <span className="font-medium hidden sm:inline">Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-l border-gray-300 pl-4">
              <TableIcon className="text-emerald-600" size={20} />
              Gradebook: {classData?.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full overflow-x-auto relative">
        <div className="inline-block min-w-full bg-white relative">
          
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              {/* Topic Headers */}
              <tr>
                <th className="bg-white border-b border-gray-200 z-20 sticky left-0 min-w-[280px] p-4 text-sm font-semibold text-gray-600 shadow-[1px_0_0_0_#e5e7eb]">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" 
                      checked={students.length > 0 && selectedStudentIds.size === students.length}
                      onChange={handleSelectAll}
                      title="Select All Students"
                    />
                    <span>Students</span>
                  </div>
                </th>
                {assignmentGroups.map((group, idx) => (
                  <th 
                    key={idx} 
                    colSpan={group.assignments.length}
                    className="border-b border-l border-gray-200 p-2 text-center text-xs font-bold uppercase tracking-wider text-gray-700 bg-gray-50/80"
                  >
                    {group.topic}
                  </th>
                ))}
                <th className="bg-white border-b border-gray-200 min-w-[80px] p-4"></th>
              </tr>
              
              {/* Assignment Tilted Headers */}
              <tr>
                <th className="bg-white border-b border-gray-200 z-20 sticky left-0 shadow-[1px_0_0_0_#e5e7eb] p-4 align-bottom">
                  <div className="text-xs text-gray-400 font-normal">Hover row to highlight</div>
                </th>
                {assignmentGroups.flatMap(group => group.assignments.map((a: any) => (
                  <th 
                    key={a.id} 
                    className="border-b border-l border-gray-200 h-32 align-bottom p-2 relative group hover:bg-gray-50 transition-colors"
                  >
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 shrink-0 origin-bottom-left -rotate-45">
                      <a 
                        href={`/teacher/assignments/${a.id}`} 
                        className="text-xs font-medium text-gray-600 hover:text-indigo-600 block w-[120px] truncate"
                        title={a.title}
                      >
                        {a.title}
                      </a>
                    </div>
                  </th>
                )))}
                <th className="bg-white border-b border-l border-gray-200 p-2 align-bottom text-xs font-semibold text-gray-500 text-center">
                  Trend
                </th>
              </tr>
            </thead>
            
            <tbody>
              {students.map((student) => {
                const sparklinePoints = getSparklinePoints(student.email);
                const isSelected = selectedStudentIds.has(student.id);
                return (
                  <tr key={student.id} className={`group transition-colors border-b border-gray-100 ${isSelected ? 'bg-indigo-50/50 hover:bg-indigo-50/80' : 'hover:bg-indigo-50/30'}`}>
                    <td className={`p-3 sticky left-0 z-10 shadow-[1px_0_0_0_#e5e7eb] transition-colors flex items-center justify-between ${isSelected ? 'bg-indigo-50/80' : 'bg-white group-hover:bg-indigo-50/80'}`}>
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          checked={isSelected}
                          onChange={() => handleSelectRow(student.id)}
                        />
                        <div>
                          <div className="text-sm font-semibold text-gray-900 truncate max-w-[180px]" title={student.name}>{student.name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[180px]" title={student.email}>{student.email}</div>
                        </div>
                      </div>
                    </td>
                    
                    {assignmentGroups.flatMap(group => group.assignments.map((a: any) => {
                      const sub = submissions.find(s => s.assignment_id === a.id && s.student_email === student.email);
                      const isPending = sub?.status === "pending";
                      const isError = sub?.status === "error";
                      const hasScore = sub && sub.score;
                      const pct = hasScore ? getPercentage(sub.score) : 0;
                      
                      return (
                        <td 
                          key={a.id} 
                          className="border-l border-gray-100 p-2 text-center"
                        >
                          <div 
                            className={`
                              relative mx-auto w-12 h-8 flex items-center justify-center rounded-md font-medium text-sm transition-all
                              ${sub ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'bg-gray-50 border border-gray-100 text-gray-300'}
                              ${hasScore ? getHeatmapColor(pct) : ''}
                            `}
                            onClick={(e) => {
                              if (sub) {
                                handleCellClick(e, sub, a, student.name);
                              }
                            }}
                          >
                            {/* Needs Action Indicator */}
                            {isPending && (
                              <span className="flex absolute -top-1 -right-1 h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" title="Needs Action"></span>
                              </span>
                            )}
                            {isError && (
                              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white" title="Error processing"></span>
                            )}

                            {hasScore ? (
                              a.grading_framework === "marzano" ? sub.score?.split("/")[0] : pct.toFixed(0)
                            ) : sub ? (
                              <span className="text-gray-400 text-xs">-</span>
                            ) : (
                              <span className="opacity-50 text-xs">N/A</span>
                            )}
                          </div>
                        </td>
                      );
                    }))}

                    {/* Sparkline Column */}
                    <td className="border-l border-gray-100 p-2 flex items-center justify-center h-full min-h-[50px]">
                      {renderSparkline(sparklinePoints)}
                    </td>
                  </tr>
                );
              })}
              
              {students.length === 0 && (
                <tr>
                  <td colSpan={100} className="p-12 text-center text-gray-500 italic">
                    No students found in this class yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
        </div>
      </main>

      {/* Bulk Action Bar */}
      {selectedStudentIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-indigo-900 text-white p-4 shadow-lg z-50 flex items-center justify-between animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-4">
            <span className="font-semibold bg-indigo-800 px-3 py-1 rounded-full text-indigo-100">
              {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? 's' : ''} selected
            </span>
            <span className="text-indigo-200 text-sm">Create a targeted intervention for this group.</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedStudentIds(new Set())}
              className="text-indigo-200 hover:text-white px-3 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleBulkCreateAssignment}
              className="bg-white text-indigo-900 hover:bg-indigo-50 px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
            >
              Create Individualized Assignment
            </button>
          </div>
        </div>
      )}

      <GradebookCellModal
        isOpen={cellModalOpen}
        onClose={() => setCellModalOpen(false)}
        anchorRect={activeAnchorRect}
        submission={activeSubmission}
        assignment={activeAssignment}
        studentName={activeStudentName}
        onSave={handleSaveCell}
        onToggleExemplar={handleToggleExemplarCell}
      />
    </div>
  );
}
