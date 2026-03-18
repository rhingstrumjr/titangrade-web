"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, BookOpen } from "lucide-react";

const supabase = createClient();

interface StandardsHeatmapProps {
  classId: string;
  students: { id: string; name: string; email: string }[];
}

interface HeatmapCell {
  studentEmail: string;
  learningTargetId: string;
  avgScore: number;
  count: number;
}

interface TargetColumn {
  id: string;
  level: string;
  description: string;
  standardCode: string;
  standardId: string;
}

const SCORE_COLORS: Record<string, string> = {
  high: "bg-emerald-200 text-emerald-900",
  mid: "bg-amber-100 text-amber-800",
  low: "bg-red-200 text-red-900",
  none: "bg-gray-50 text-gray-400",
};

function getScoreColor(score: number | null): string {
  if (score === null) return SCORE_COLORS.none;
  if (score >= 0.8) return SCORE_COLORS.high;
  if (score >= 0.5) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

function getScoreLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 1) return "✅";
  if (score >= 0.5) return "⚠️";
  return "❌";
}

export function StandardsHeatmap({ classId, students }: StandardsHeatmapProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [targetColumns, setTargetColumns] = useState<TargetColumn[]>([]);
  const [heatmapData, setHeatmapData] = useState<Map<string, HeatmapCell>>(new Map());

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    // Fetch all assignments for this class
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id")
      .eq("class_id", classId);

    if (!assignments || assignments.length === 0) {
      setIsLoading(false);
      return;
    }

    const assignmentIds = assignments.map(a => a.id);

    // Fetch all assignment_targets for these assignments → get linked learning_target_ids
    const { data: assignmentTargets } = await supabase
      .from("assignment_targets")
      .select("learning_target_id")
      .in("assignment_id", assignmentIds);

    if (!assignmentTargets || assignmentTargets.length === 0) {
      setIsLoading(false);
      return;
    }

    const targetIds = [...new Set(assignmentTargets.map((at: any) => at.learning_target_id))];

    // Fetch the learning target details with standard info
    const { data: targets } = await supabase
      .from("learning_targets")
      .select("*, standard:standards(id, code)")
      .in("id", targetIds)
      .order("level");

    if (!targets || targets.length === 0) {
      setIsLoading(false);
      return;
    }

    const columns: TargetColumn[] = targets.map((t: any) => ({
      id: t.id,
      level: t.level,
      description: t.description,
      standardCode: t.standard?.code || "???",
      standardId: t.standard?.id || "",
    }));

    // Sort by standard code then by level
    columns.sort((a, b) => {
      if (a.standardCode !== b.standardCode) return a.standardCode.localeCompare(b.standardCode);
      return parseFloat(a.level) - parseFloat(b.level);
    });

    setTargetColumns(columns);

    // Fetch all submission_scores for these targets and assignments
    const { data: submissions } = await supabase
      .from("submissions")
      .select("id, student_email")
      .in("assignment_id", assignmentIds);

    if (!submissions || submissions.length === 0) {
      setIsLoading(false);
      return;
    }

    const subIds = submissions.map(s => s.id);
    const emailBySubId = new Map<string, string>();
    for (const sub of submissions) {
      emailBySubId.set(sub.id, sub.student_email);
    }

    // Batch fetch submission_scores
    const { data: scores } = await supabase
      .from("submission_scores")
      .select("submission_id, learning_target_id, ai_score, teacher_override_score")
      .in("submission_id", subIds)
      .in("learning_target_id", targetIds);

    // Build heatmap: key = "email|targetId" → avg score
    const cellMap = new Map<string, { total: number; count: number }>();

    for (const sc of (scores || [])) {
      const email = emailBySubId.get(sc.submission_id);
      if (!email) continue;
      const effectiveScore = sc.teacher_override_score ?? sc.ai_score ?? 0;
      const key = `${email}|${sc.learning_target_id}`;
      const existing = cellMap.get(key);
      if (existing) {
        existing.total += effectiveScore;
        existing.count += 1;
      } else {
        cellMap.set(key, { total: effectiveScore, count: 1 });
      }
    }

    const heatmap = new Map<string, HeatmapCell>();
    for (const [key, val] of cellMap) {
      const [email, targetId] = key.split("|");
      heatmap.set(key, {
        studentEmail: email,
        learningTargetId: targetId,
        avgScore: val.total / val.count,
        count: val.count,
      });
    }

    setHeatmapData(heatmap);
    setIsLoading(false);
  }, [classId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading standards heatmap...
      </div>
    );
  }

  if (targetColumns.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 font-medium">No learning targets linked to assignments</p>
        <p className="text-xs text-gray-500 mt-1">
          Link standards targets via {'"'}Edit Settings{'"'} → Evaluation Matrix on Marzano assignments.
        </p>
      </div>
    );
  }

  // Group columns by standardCode for grouping header
  const standardGroups: { code: string; targets: TargetColumn[] }[] = [];
  let currentGroup: { code: string; targets: TargetColumn[] } | null = null;
  for (const col of targetColumns) {
    if (!currentGroup || currentGroup.code !== col.standardCode) {
      currentGroup = { code: col.standardCode, targets: [] };
      standardGroups.push(currentGroup);
    }
    currentGroup.targets.push(col);
  }

  return (
    <div className="inline-block min-w-full bg-white">
      <table className="text-left border-collapse w-full">
        <thead className="sticky top-0 bg-white z-10 shadow-sm">
          {/* Standard group headers */}
          <tr>
            <th className="bg-white border-b border-gray-200 z-20 sticky left-0 w-[240px] min-w-[240px] p-3 text-sm font-semibold text-gray-600 shadow-[1px_0_0_0_#e5e7eb]">
              Students
            </th>
            {standardGroups.map(g => (
              <th
                key={g.code}
                colSpan={g.targets.length}
                className="border-b border-l border-gray-200 p-2 text-center text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50/60"
              >
                {g.code}
              </th>
            ))}
          </tr>

          {/* Target level headers */}
          <tr>
            <th className="bg-white border-b border-gray-200 z-20 sticky left-0 shadow-[1px_0_0_0_#e5e7eb] p-2 align-bottom">
              <div className="text-xs text-gray-400 font-normal">Learning Target Level</div>
            </th>
            {targetColumns.map(col => {
              const levelColor =
                col.level === "4.0" ? "text-indigo-700 bg-indigo-50" :
                col.level === "3.0" ? "text-green-700 bg-green-50" :
                "text-amber-700 bg-amber-50";
              return (
                <th
                  key={col.id}
                  className="border-b border-l border-gray-200 p-2 text-center w-12 min-w-[48px]"
                  title={col.description}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${levelColor}`}>
                    {col.level}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.id} className="group border-b border-gray-100 hover:bg-indigo-50/30 transition-colors">
              <td className="py-1.5 px-3 sticky left-0 z-10 bg-white group-hover:bg-indigo-50/80 shadow-[1px_0_0_0_#e5e7eb] transition-colors">
                <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={student.name}>
                  {student.name}
                </div>
              </td>
              {targetColumns.map(col => {
                const key = `${student.email}|${col.id}`;
                const cell = heatmapData.get(key);
                const score = cell ? cell.avgScore : null;

                return (
                  <td key={col.id} className="border-l border-gray-100 p-1 text-center">
                    <div
                      className={`mx-auto w-8 h-6 flex items-center justify-center rounded text-xs font-medium ${getScoreColor(score)}`}
                      title={cell ? `Avg: ${(score! * 100).toFixed(0)}% (${cell.count} assessment${cell.count > 1 ? 's' : ''})` : 'Not assessed'}
                    >
                      {getScoreLabel(score)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan={100} className="p-12 text-center text-gray-500 italic">
                No students found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
