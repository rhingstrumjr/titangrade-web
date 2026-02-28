"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight, FileText } from "lucide-react";

interface Submission {
  id: string;
  student_name: string;
  student_email: string;
  file_url: string;
  score: string | null;
  feedback: string | null;
  status: string;
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="pb-6 border-b border-gray-200">
          <Link href="/teacher" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4 transition-colors">
            <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">Submissions</h1>
          <p className="text-gray-500 mt-1">{assignmentTitle}</p>
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

                                      <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-md font-medium">
                                        <FileText size={16} /> View Document
                                      </a>
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
