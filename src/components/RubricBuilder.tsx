"use client";

import { useState } from "react";
import { Trash2, PlusCircle, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { RubricCriterion, RubricLevel } from "@/types/submission";

interface RubricBuilderProps {
  criteria: RubricCriterion[];
  onChange: (criteria: RubricCriterion[]) => void;
}

const DEFAULT_LEVELS: RubricLevel[] = [
  { label: "Excellent", points: 10, description: "" },
  { label: "Proficient", points: 7, description: "" },
  { label: "Developing", points: 4, description: "" },
  { label: "Beginning", points: 1, description: "" },
];

export function RubricBuilder({ criteria, onChange }: RubricBuilderProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const totalMaxScore = criteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0);

  const updateCriterion = (index: number, field: keyof RubricCriterion, value: string | number) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addCriterion = () => {
    onChange([...criteria, { name: "", maxPoints: 10, description: "", levels: [] }]);
  };

  const removeCriterion = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const atomizeCriterion = (index: number) => {
    const criterion = criteria[index];
    if (!criterion.description) return;

    // Split by double newline or newline followed by bullet
    const parts = criterion.description
      .split(/\n\n|\n(?=-|\*|\d+\. )/)
      .map(p => p.trim())
      .filter(Boolean);

    if (parts.length <= 1) return;

    const newCriteria = [...criteria];
    const atomicItems: RubricCriterion[] = parts.map(part => ({
      ...criterion,
      description: part,
      // If there are levels, we keep them but teacher might need to adjust
      // Often levels are shared across parts of the same standard
    }));

    newCriteria.splice(index, 1, ...atomicItems);
    onChange(newCriteria);
  };

  // ── Level management ──
  const addDefaultLevels = (criterionIndex: number) => {
    const updated = [...criteria];
    const maxPts = updated[criterionIndex].maxPoints;
    updated[criterionIndex] = {
      ...updated[criterionIndex],
      levels: [
        { label: "Excellent", points: maxPts, description: "" },
        { label: "Proficient", points: Math.round(maxPts * 0.7), description: "" },
        { label: "Developing", points: Math.round(maxPts * 0.4), description: "" },
        { label: "Beginning", points: Math.round(maxPts * 0.1), description: "" },
      ],
    };
    onChange(updated);
  };

  const updateLevel = (criterionIndex: number, levelIndex: number, field: keyof RubricLevel, value: string | number) => {
    const updated = [...criteria];
    const levels = [...(updated[criterionIndex].levels || [])];
    levels[levelIndex] = { ...levels[levelIndex], [field]: value };
    updated[criterionIndex] = { ...updated[criterionIndex], levels };
    onChange(updated);
  };

  const addLevel = (criterionIndex: number) => {
    const updated = [...criteria];
    const levels = [...(updated[criterionIndex].levels || [])];
    levels.push({ label: "", points: 0, description: "" });
    updated[criterionIndex] = { ...updated[criterionIndex], levels };
    onChange(updated);
  };

  const removeLevel = (criterionIndex: number, levelIndex: number) => {
    const updated = [...criteria];
    const levels = (updated[criterionIndex].levels || []).filter((_, i) => i !== levelIndex);
    updated[criterionIndex] = { ...updated[criterionIndex], levels };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Structured Rubric</span>
          {criteria.length > 0 && (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {criteria.length} criteria · {totalMaxScore} pts
            </span>
          )}
        </div>
      </div>

      {criteria.length === 0 && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-500">No criteria yet. Use <strong>✨ Auto-Parse</strong> above to extract from your rubric, or add criteria manually.</p>
        </div>
      )}

      {/* Criteria Rows */}
      <div className="space-y-3">
        {criteria.map((criterion, index) => {
          const hasLevels = criterion.levels && criterion.levels.length > 0;
          const isExpanded = expandedIndex === index;

          return (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
            >
              {/* Criterion Header */}
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Category Name</label>
                      <input
                        type="text"
                        value={criterion.name}
                        onChange={(e) => updateCriterion(index, "name", e.target.value)}
                        placeholder="e.g. Scientific Question"
                        className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Max Points</label>
                      <input
                        type="number"
                        value={criterion.maxPoints}
                        onChange={(e) => updateCriterion(index, "maxPoints", parseInt(e.target.value) || 0)}
                        min={0}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => removeCriterion(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50"
                        title="Remove criterion"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Full Credit Description</label>
                  <textarea
                    value={criterion.description}
                    onChange={(e) => updateCriterion(index, "description", e.target.value)}
                    placeholder="Describe what earns full credit for this criterion..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
                  />
                  
                  {/* Split Button Helper */}
                  {criterion.description && (criterion.description.includes("\n\n") || criterion.description.split("\n").length > 2) && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => atomizeCriterion(index)}
                        className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition-colors border border-amber-200"
                      >
                        <Sparkles size={10} />
                        Split into separate skills
                      </button>
                    </div>
                  )}
                </div>

                {/* Performance Levels Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(index)}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Performance Levels {hasLevels ? `(${criterion.levels!.length})` : ""}
                  </button>
                  {!hasLevels && (
                    <button
                      type="button"
                      onClick={() => { addDefaultLevels(index); setExpandedIndex(index); }}
                      className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      + Add levels
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Levels */}
              {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  {(!criterion.levels || criterion.levels.length === 0) ? (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => addDefaultLevels(index)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        + Add default levels (Excellent / Proficient / Developing / Beginning)
                      </button>
                    </div>
                  ) : (
                    <>
                      {criterion.levels!.map((level, li) => (
                        <div key={li} className="flex items-start gap-2 bg-white border border-gray-200 rounded-md p-3">
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 flex-grow">
                            <div className="md:col-span-1">
                              <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Level</label>
                              <input
                                type="text"
                                value={level.label}
                                onChange={(e) => updateLevel(index, li, "label", e.target.value)}
                                placeholder="e.g. Proficient"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="md:col-span-1">
                              <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Points</label>
                              <input
                                type="number"
                                value={level.points}
                                onChange={(e) => updateLevel(index, li, "points", parseInt(e.target.value) || 0)}
                                min={0}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Description</label>
                              <input
                                type="text"
                                value={level.description}
                                onChange={(e) => updateLevel(index, li, "description", e.target.value)}
                                placeholder="What does this level look like?"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="md:col-span-1 flex items-end">
                              <button
                                type="button"
                                onClick={() => removeLevel(index, li)}
                                className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addLevel(index)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
                      >
                        + Add level
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Criterion Button */}
      <button
        type="button"
        onClick={addCriterion}
        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg border border-indigo-200 transition-colors w-full justify-center"
      >
        <PlusCircle size={16} />
        Add Criterion
      </button>
    </div>
  );
}
