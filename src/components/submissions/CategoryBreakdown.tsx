import React from "react";
import { BarChart3 } from "lucide-react";
import { Submission, CategoryScore, SkillAssessment } from "@/types/submission";
import type { SubmissionScore } from "@/types/standards";

interface CategoryBreakdownProps {
  sub: Submission;
  normalizedScores?: SubmissionScore[];
  isEditing?: boolean;
  editSkillAssessments?: SkillAssessment[];
  setEditSkillAssessments?: (assessments: SkillAssessment[]) => void;
  editCategoryScores?: CategoryScore[];
  setEditCategoryScores?: (scores: CategoryScore[]) => void;
  editNormalizedScores?: SubmissionScore[];
  setEditNormalizedScores?: (scores: SubmissionScore[]) => void;
}

export function CategoryBreakdown({
  sub,
  normalizedScores,
  isEditing = false,
  editSkillAssessments = [],
  setEditSkillAssessments,
  editCategoryScores = [],
  setEditCategoryScores,
  editNormalizedScores = [],
  setEditNormalizedScores,
}: CategoryBreakdownProps) {
  const statusOptions = [
    { value: 'demonstrated', icon: '✅', label: 'Demonstrated' },
    { value: 'partial', icon: '⚠️', label: 'Partial' },
    { value: 'not_demonstrated', icon: '❌', label: 'Not Demonstrated' },
    { value: 'not_assessed', icon: '⬜', label: 'Not Assessed' },
  ];

  // ── Priority 1: Normalized submission_scores ──
  if (normalizedScores && normalizedScores.length > 0) {
    const displayData = isEditing ? editNormalizedScores : normalizedScores;

    // Check if these are Marzano-style (have learning_target_id) or standard-style
    const hasMarzano = displayData.some(s => s.learning_target_id);

    if (hasMarzano) {
      // Group by level from category_name pattern: "[2.0] Dimension: Skill"
      const levels = ['2.0', '3.0', '4.0'];
      const levelLabels: Record<string, string> = {
        '2.0': '2.0 — Foundational',
        '3.0': '3.0 — Target',
        '4.0': '4.0 — Advanced',
      };

      const getScoreDisplay = (score: number) => {
        if (score >= 1) return { icon: '✅', color: 'text-emerald-700', label: 'Demonstrated' };
        if (score >= 0.5) return { icon: '⚠️', color: 'text-amber-600', label: 'Partial' };
        return { icon: '❌', color: 'text-red-600', label: 'Not Demonstrated' };
      };

      return (
        <details className="mt-3" open={isEditing}>
          <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
            <BarChart3 size={14} /> Skill Assessment {isEditing && "(Editing)"}
          </summary>
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            {levels.map(level => {
              const scores = displayData.filter(s => s.category_name?.startsWith(`[${level}]`));
              if (scores.length === 0) return null;
              return (
                <div key={level}>
                  <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100">
                    <span className="text-xs font-bold text-indigo-700">{levelLabels[level] || `Level ${level}`}</span>
                  </div>
                  {scores.map((sc, i) => {
                    const effectiveScore = sc.teacher_override_score ?? sc.ai_score;
                    const display = getScoreDisplay(effectiveScore ?? 0);
                    const label = sc.category_name?.replace(/^\[\d\.\d\]\s*/, '') || 'Unknown';
                    const fullIdx = displayData.indexOf(sc);

                    return (
                      <div key={sc.id || i} className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
                        <span className="text-xs text-gray-700 flex-1">{label}</span>
                        {isEditing && setEditNormalizedScores ? (
                          <select
                            value={effectiveScore! >= 1 ? 'demonstrated' : effectiveScore! >= 0.5 ? 'partial' : 'not_demonstrated'}
                            onChange={(e) => {
                              const updated = [...editNormalizedScores];
                              const numVal = e.target.value === 'demonstrated' ? 1 : e.target.value === 'partial' ? 0.5 : 0;
                              updated[fullIdx] = { ...updated[fullIdx], teacher_override_score: numVal };
                              setEditNormalizedScores(updated);
                            }}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-indigo-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {statusOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs font-medium ${display.color} whitespace-nowrap`}>
                            {display.icon} {display.label}
                            {sc.teacher_override_score != null && (
                              <span className="ml-1 text-[10px] text-gray-400">(overridden)</span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </details>
      );
    } else {
      // Standard-style normalized scores
      return (
        <details className="mt-3" open={isEditing}>
          <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
            <BarChart3 size={14} /> Score Breakdown {isEditing && "(Editing)"}
          </summary>
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            {displayData.map((sc, i) => {
              const effectiveScore = sc.teacher_override_score ?? sc.ai_score ?? 0;
              const possible = sc.ai_possible ?? 0;
              const pct = possible > 0 ? Math.round((effectiveScore / possible) * 100) : 0;
              const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

              return (
                <div key={sc.id || i} className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
                  <span className="text-xs text-gray-700 flex-1">{sc.category_name || 'Unknown'}</span>
                  {isEditing && setEditNormalizedScores ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={possible}
                        value={effectiveScore}
                        onChange={(e) => {
                          const updated = [...editNormalizedScores];
                          updated[i] = { ...updated[i], teacher_override_score: Math.min(Number(e.target.value), possible) };
                          setEditNormalizedScores(updated);
                        }}
                        className="w-12 text-xs text-center border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-indigo-400"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-gray-500">/ {possible}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-gray-900 w-16 text-right">
                      {effectiveScore}/{possible}
                      {sc.teacher_override_score != null && (
                        <span className="ml-1 text-[10px] text-gray-400">(edited)</span>
                      )}
                    </span>
                  )}
                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      );
    }
  }

  // ── Fallback: Legacy JSONB skill_assessments ──
  if (sub.skill_assessments && sub.skill_assessments.length > 0) {
    const levels = ['2.0', '3.0', '4.0'];
    const levelLabels: Record<string, string> = {
      '2.0': '2.0 — Foundational',
      '3.0': '3.0 — Target',
      '4.0': '4.0 — Transfer',
    };
    const getStatusDisplay = (status: string, level: string) => {
      const base: Record<string, { icon: string; color: string; label: string }> = {
        'demonstrated': { icon: '✅', color: 'text-emerald-700', label: 'Demonstrated' },
        'partial': { icon: '⚠️', color: 'text-amber-600', label: 'Partial' },
        'not_demonstrated': { icon: '❌', color: 'text-red-600', label: 'Not Demonstrated' },
        'not_assessed': { icon: '⬜', color: 'text-gray-400', label: 'Not Assessed' },
      };
      const display = base[status] || base['not_assessed'];
      if (status === 'demonstrated') {
        if (level === '4.0') return { ...display, color: 'text-indigo-700 bg-indigo-50 px-1.5 rounded' };
        if (level === '3.0') return { ...display, color: 'text-emerald-700 bg-emerald-50 px-1.5 rounded' };
        if (level === '2.0') return { ...display, color: 'text-orange-700 bg-orange-50 px-1.5 rounded' };
      }
      return display;
    };

    const displayData = isEditing ? editSkillAssessments : sub.skill_assessments;

    return (
      <details className="mt-3" open={isEditing}>
        <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
          <BarChart3 size={14} /> Skill Assessment {isEditing && "(Editing)"}
        </summary>
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          {levels.map(level => {
            const skills = displayData!.filter(sa => sa.level === level);
            if (skills.length === 0) return null;
            return (
              <div key={level}>
                <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100">
                  <span className="text-xs font-bold text-indigo-700">{levelLabels[level] || `Level ${level}`}</span>
                </div>
                {skills.map((sa, i) => {
                  const display = getStatusDisplay(sa.status, sa.level);
                  const fullIdx = displayData!.indexOf(sa);
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase w-8 flex-shrink-0">{sa.dimension}</span>
                      <span className="text-xs text-gray-700 flex-1">{sa.skill}</span>
                      {isEditing && setEditSkillAssessments ? (
                        <select
                          value={sa.status}
                          onChange={(e) => {
                            const updated = [...editSkillAssessments];
                            updated[fullIdx] = { ...updated[fullIdx], status: e.target.value };
                            setEditSkillAssessments(updated);
                          }}
                          className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-indigo-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs font-medium ${display.color} whitespace-nowrap`}>
                          {display.icon} {display.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </details>
    );
  }

  // ── Fallback: Legacy JSONB category_scores ──
  if (sub.category_scores && sub.category_scores.length > 0) {
    const displayData = isEditing ? editCategoryScores : sub.category_scores;

    return (
      <details className="mt-3" open={isEditing}>
        <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
          <BarChart3 size={14} /> Score Breakdown {isEditing && "(Editing)"}
        </summary>
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          {displayData.map((cs, i) => {
            const pct = cs.possible > 0 ? Math.round((cs.earned / cs.possible) * 100) : 0;
            const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-xs text-gray-700 flex-1">{cs.category}</span>
                {isEditing && setEditCategoryScores ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={cs.possible}
                      value={cs.earned}
                      onChange={(e) => {
                        const updated = [...editCategoryScores];
                        updated[i] = { ...updated[i], earned: Math.min(Number(e.target.value), cs.possible) };
                        setEditCategoryScores(updated);
                      }}
                      className="w-12 text-xs text-center border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-indigo-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-gray-500">/ {cs.possible}</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-gray-900 w-16 text-right">{cs.earned}/{cs.possible}</span>
                )}
                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </details>
    );
  }

  return null;
}
