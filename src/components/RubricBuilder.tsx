"use client";

import { useState } from "react";
import { Trash2, PlusCircle, Sparkles, Loader2 } from "lucide-react";
import type { RubricCriterion } from "@/types/submission";

interface RubricBuilderProps {
  criteria: RubricCriterion[];
  onChange: (criteria: RubricCriterion[]) => void;
  assignmentId?: string;
}

export function RubricBuilder({ criteria, onChange, assignmentId }: RubricBuilderProps) {
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [autoParseText, setAutoParseText] = useState("");
  const [autoParseFile, setAutoParseFile] = useState<File | null>(null);
  const [showAutoParsePanel, setShowAutoParsePanel] = useState(false);
  const [autoParseError, setAutoParseError] = useState("");

  const totalMaxScore = criteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0);

  const updateCriterion = (index: number, field: keyof RubricCriterion, value: string | number) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addCriterion = () => {
    onChange([...criteria, { name: "", maxPoints: 10, description: "" }]);
  };

  const removeCriterion = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  const handleAutoParse = async () => {
    if (!autoParseText.trim() && !autoParseFile) return;
    setIsAutoParsing(true);
    setAutoParseError("");

    try {
      let body: Record<string, string> = {};

      if (autoParseFile) {
        const buffer = await autoParseFile.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        body = { file: base64, mimeType: autoParseFile.type };
      } else {
        body = { text: autoParseText };
      }

      if (assignmentId) {
        body.assignmentId = assignmentId;
      }

      const res = await fetch("/api/parse-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success && data.criteria) {
        onChange(data.criteria);
        setShowAutoParsePanel(false);
        setAutoParseText("");
        setAutoParseFile(null);
      } else {
        setAutoParseError(data.error || "Failed to parse rubric. Try adding more detail.");
      }
    } catch (err) {
      console.error(err);
      setAutoParseError("Error connecting to AI. Please try again.");
    } finally {
      setIsAutoParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Auto-Parse Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Rubric Criteria</span>
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
            Total: {totalMaxScore} pts
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowAutoParsePanel(!showAutoParsePanel)}
          className="flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Sparkles size={14} />
          ✨ Auto-Parse
        </button>
      </div>

      {showAutoParsePanel && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-amber-800 font-medium">
            Paste rubric text or upload a rubric file — AI will extract the criteria for you.
          </p>
          <textarea
            value={autoParseText}
            onChange={(e) => { setAutoParseText(e.target.value); setAutoParseFile(null); }}
            placeholder="Paste your rubric here... e.g.&#10;Scientific Question (10 pts): Clear, testable question&#10;Hypothesis (10 pts): If/then format&#10;Data Collection (20 pts): Organized table with units"
            rows={5}
            className="w-full border border-amber-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white font-mono"
          />
          <div className="flex items-center gap-3">
            <label className="relative cursor-pointer bg-white rounded-lg font-medium text-amber-700 hover:text-amber-800 border border-amber-300 hover:bg-amber-50 px-3 py-1.5 text-sm transition-colors">
              Or Upload File
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.docx"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setAutoParseFile(e.target.files[0]);
                    setAutoParseText("");
                  }
                }}
              />
            </label>
            {autoParseFile && (
              <span className="text-sm text-amber-700 font-medium">{autoParseFile.name}</span>
            )}
          </div>
          {autoParseError && (
            <p className="text-sm text-red-600 font-medium">{autoParseError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAutoParse}
              disabled={isAutoParsing || (!autoParseText.trim() && !autoParseFile)}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              {isAutoParsing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Parse with AI
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Criteria Rows */}
      <div className="space-y-3">
        {criteria.map((criterion, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow"
          >
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
                <div className="flex items-end">
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                value={criterion.description}
                onChange={(e) => updateCriterion(index, "description", e.target.value)}
                placeholder="Describe what earns full credit for this criterion..."
                rows={2}
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add Button */}
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
