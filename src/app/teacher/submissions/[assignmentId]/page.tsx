"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight, FileText, Download, Star } from "lucide-react";

interface Submission {
  id: string;
  student_name: string;
  student_email: string;
  file_url: string;
  score: string | null;
  feedback: string | null;
  status: string;
  is_exemplar: boolean;
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

          <button
            onClick={handleDownloadCSV}
            disabled={studentGroups.length === 0}
            className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>

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
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle2 size={12} className="mr-1" /> Graded
                            </span>
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
                                  <div key={sub.id} className="bg-white border text-sm border-gray-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-4">
                                      <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                        {index + 1}
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900">Draft {index + 1}</p>
                                        <p className="text-xs text-gray-500">{new Date(sub.created_at).toLocaleString()}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                      {sub.status === 'graded' && sub.score ? (
                                        <div className="text-center">
                                          <p className="text-xs text-gray-500 uppercase font-semibold">Score</p>
                                          <p className="font-bold text-gray-900">{sub.score}</p>
                                        </div>
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
                                          className={`flex items-center justify-center gap-1.5 transition-colors border px-3 py-1.5 rounded-md font-medium text-xs
                                            ${sub.is_exemplar
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
