"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Standard, LearningTarget, AssignmentTarget } from "@/types/standards";
import {
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Loader2,
  BookOpen,
  Save,
  ExternalLink,
} from "lucide-react";

const supabase = createClient();

interface EvaluationMatrixProps {
  assignmentId: string;
}

const LEVEL_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  "2.0": { bg: "bg-amber-50", text: "text-amber-700", label: "Foundational" },
  "3.0": { bg: "bg-green-50", text: "text-green-700", label: "Target" },
  "4.0": { bg: "bg-indigo-50", text: "text-indigo-700", label: "Advanced" },
};

const DIM_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  SEP: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  DCI: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  CCC: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

export function EvaluationMatrix({ assignmentId }: EvaluationMatrixProps) {
  const [standards, setStandards] = useState<(Standard & { learning_targets: LearningTarget[] })[]>([]);
  const [linkedTargetIds, setLinkedTargetIds] = useState<Set<string>>(new Set());
  const [initialLinkedIds, setInitialLinkedIds] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const [standardsRes, targetsRes] = await Promise.all([
      supabase
        .from("standards")
        .select("*, learning_targets(*)")
        .order("code", { ascending: true }),
      supabase
        .from("assignment_targets")
        .select("learning_target_id")
        .eq("assignment_id", assignmentId),
    ]);

    if (standardsRes.data) {
      setStandards(standardsRes.data as any);
    }

    if (targetsRes.data) {
      const ids = new Set(targetsRes.data.map((t: any) => t.learning_target_id));
      setLinkedTargetIds(ids);
      setInitialLinkedIds(new Set(ids));
      // Auto-expand standards that have linked targets
      const expandedIds = new Set<string>();
      for (const std of (standardsRes.data || []) as any[]) {
        for (const lt of std.learning_targets || []) {
          if (ids.has(lt.id)) {
            expandedIds.add(std.id);
            break;
          }
        }
      }
      setExpandedStandards(expandedIds);
    }

    setIsLoading(false);
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleTarget = (targetId: string) => {
    setLinkedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
    setSaved(false);
  };

  const toggleStandard = (standardId: string) => {
    setExpandedStandards((prev) => {
      const next = new Set(prev);
      if (next.has(standardId)) {
        next.delete(standardId);
      } else {
        next.add(standardId);
      }
      return next;
    });
  };

  const selectAllForStandard = (standard: Standard & { learning_targets: LearningTarget[] }) => {
    setLinkedTargetIds((prev) => {
      const next = new Set(prev);
      const targets = standard.learning_targets || [];
      const allSelected = targets.every((t) => next.has(t.id));
      if (allSelected) {
        targets.forEach((t) => next.delete(t.id));
      } else {
        targets.forEach((t) => next.add(t.id));
      }
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Delete all existing assignment_targets for this assignment
    await supabase.from("assignment_targets").delete().eq("assignment_id", assignmentId);

    // Insert new selections
    if (linkedTargetIds.size > 0) {
      const rows = Array.from(linkedTargetIds).map((ltId) => ({
        assignment_id: assignmentId,
        learning_target_id: ltId,
      }));
      const { error } = await supabase.from("assignment_targets").insert(rows);
      if (error) {
        console.error("Failed to save assignment targets:", error);
        alert("Failed to save learning targets.");
        setIsSaving(false);
        return;
      }
    }

    setInitialLinkedIds(new Set(linkedTargetIds));
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasChanges = (() => {
    if (linkedTargetIds.size !== initialLinkedIds.size) return true;
    for (const id of linkedTargetIds) {
      if (!initialLinkedIds.has(id)) return true;
    }
    return false;
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading standards...
      </div>
    );
  }

  if (standards.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
        <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 font-medium mb-1">No standards in your library</p>
        <p className="text-xs text-gray-500 mb-3">
          Import or create standards first, then come back to link them to this assignment.
        </p>
        <a
          href="/teacher/standards"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <ExternalLink size={14} /> Go to Standards Library
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs text-gray-500">
            Select which learning targets this assignment assesses. The AI grader will evaluate
            students against these specific targets.
          </p>
        </div>
        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full flex-shrink-0">
          {linkedTargetIds.size} selected
        </span>
      </div>

      <div className="space-y-2">
        {standards.map((std) => {
          const isExpanded = expandedStandards.has(std.id);
          const targets = std.learning_targets || [];
          const selectedCount = targets.filter((t) => linkedTargetIds.has(t.id)).length;
          const dim = std.dimension || "DCI";
          const dimStyle = DIM_STYLE[dim] || DIM_STYLE.DCI;

          return (
            <div key={std.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Standard Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleStandard(std.id)}
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${dimStyle.bg} ${dimStyle.text} ${dimStyle.border}`}
                >
                  {dim}
                </span>
                <span className="font-mono text-xs font-bold text-indigo-700 flex-shrink-0">
                  {std.code}
                </span>
                <span className="text-sm text-gray-700 truncate flex-1">{std.description}</span>
                {selectedCount > 0 && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    {selectedCount}/{targets.length}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAllForStandard(std);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0 underline"
                >
                  {selectedCount === targets.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              {/* Learning Targets */}
              {isExpanded && targets.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2 space-y-1.5">
                  {targets
                    .sort((a, b) => parseFloat(a.level) - parseFloat(b.level))
                    .map((target) => {
                      const isChecked = linkedTargetIds.has(target.id);
                      const lvl = LEVEL_STYLE[target.level] || LEVEL_STYLE["3.0"];

                      return (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => toggleTarget(target.id)}
                          className={`flex items-start gap-2.5 w-full text-left px-3 py-2 rounded-lg border transition-all ${
                            isChecked
                              ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100"
                              : "bg-white border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Square size={16} className="text-gray-300 flex-shrink-0 mt-0.5" />
                          )}
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded ${lvl.bg} ${lvl.text} flex-shrink-0`}
                          >
                            {target.level}
                          </span>
                          <span className="text-sm text-gray-700 flex-1">{target.description}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? "Saved ✓" : isSaving ? "Saving..." : "Save Targets"}
        </button>
      </div>
    </div>
  );
}
