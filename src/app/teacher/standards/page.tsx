"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Standard, LearningTarget } from "@/types/standards";
import {
  ArrowLeft,
  PlusCircle,
  Upload,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Loader2,
  BookOpen,
  FileText,
  Sparkles,
} from "lucide-react";

const DIMENSION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SEP: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  DCI: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  CCC: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

const LEVEL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "2.0": { bg: "bg-amber-50", text: "text-amber-800", label: "Foundational" },
  "3.0": { bg: "bg-green-50", text: "text-green-800", label: "Target Mastery" },
  "4.0": { bg: "bg-indigo-50", text: "text-indigo-800", label: "Advanced" },
};

export default function StandardsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [standards, setStandards] = useState<(Standard & { learning_targets: LearningTarget[] })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create standard form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDimension, setNewDimension] = useState<string>("DCI");
  const [createLoading, setCreateLoading] = useState(false);

  // PDF import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);

  // Inline editing
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editingTargetDesc, setEditingTargetDesc] = useState("");

  // Adding target
  const [addingTargetStandardId, setAddingTargetStandardId] = useState<string | null>(null);
  const [newTargetLevel, setNewTargetLevel] = useState<string>("3.0");
  const [newTargetDesc, setNewTargetDesc] = useState("");

  const fetchStandards = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("standards")
      .select("*, learning_targets(*)")
      .order("code", { ascending: true });

    if (data && !error) {
      setStandards(data as any);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStandards();
  }, [fetchStandards]);

  // --- CRUD: Standards ---

  const handleCreateStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newDescription.trim()) return;
    setCreateLoading(true);

    const { data, error } = await supabase
      .from("standards")
      .insert([{ code: newCode.trim(), description: newDescription.trim(), dimension: newDimension }])
      .select("*, learning_targets(*)")
      .single();

    if (data && !error) {
      setStandards((prev) => [...prev, data as any].sort((a, b) => a.code.localeCompare(b.code)));
      setNewCode("");
      setNewDescription("");
      setShowCreateForm(false);
    }
    setCreateLoading(false);
  };

  const handleDeleteStandard = async (standardId: string) => {
    if (!confirm("Delete this standard and all its learning targets?")) return;
    const { error } = await supabase.from("standards").delete().eq("id", standardId);
    if (!error) {
      setStandards((prev) => prev.filter((s) => s.id !== standardId));
    }
  };

  // --- CRUD: Learning Targets ---

  const handleAddTarget = async (standardId: string) => {
    if (!newTargetDesc.trim()) return;

    const { data, error } = await supabase
      .from("learning_targets")
      .insert([{ standard_id: standardId, level: newTargetLevel, description: newTargetDesc.trim() }])
      .select()
      .single();

    if (data && !error) {
      setStandards((prev) =>
        prev.map((s) =>
          s.id === standardId ? { ...s, learning_targets: [...(s.learning_targets || []), data] } : s
        )
      );
      setNewTargetDesc("");
      setAddingTargetStandardId(null);
    }
  };

  const handleUpdateTarget = async (targetId: string, standardId: string) => {
    if (!editingTargetDesc.trim()) return;

    const { error } = await supabase
      .from("learning_targets")
      .update({ description: editingTargetDesc.trim() })
      .eq("id", targetId);

    if (!error) {
      setStandards((prev) =>
        prev.map((s) =>
          s.id === standardId
            ? {
                ...s,
                learning_targets: s.learning_targets.map((t) =>
                  t.id === targetId ? { ...t, description: editingTargetDesc.trim() } : t
                ),
              }
            : s
        )
      );
      setEditingTargetId(null);
    }
  };

  const handleDeleteTarget = async (targetId: string, standardId: string) => {
    const { error } = await supabase.from("learning_targets").delete().eq("id", targetId);
    if (!error) {
      setStandards((prev) =>
        prev.map((s) =>
          s.id === standardId
            ? { ...s, learning_targets: s.learning_targets.filter((t) => t.id !== targetId) }
            : s
        )
      );
    }
  };

  // --- PDF Import ---

  const handleImportParse = async () => {
    if (!importFile && !importText.trim()) return;
    setImportLoading(true);
    setImportPreview(null);

    try {
      const formData = new FormData();
      if (importFile) {
        formData.append("file", importFile);
      } else {
        formData.append("text", importText);
      }

      const res = await fetch("/api/parse-standard", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success && data.standards) {
        setImportPreview(data.standards);
      } else {
        alert("Failed to parse: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Import error: " + err.message);
    }
    setImportLoading(false);
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImportLoading(true);

    for (const std of importPreview) {
      const { data: inserted, error } = await supabase
        .from("standards")
        .insert([{ code: std.code, description: std.description, dimension: std.dimension || null }])
        .select()
        .single();

      if (inserted && !error && std.learning_targets?.length > 0) {
        const targets = std.learning_targets.map((lt: any) => ({
          standard_id: inserted.id,
          level: lt.level,
          description: lt.description,
        }));
        await supabase.from("learning_targets").insert(targets);
      }
    }

    setImportPreview(null);
    setImportFile(null);
    setImportText("");
    setShowImportModal(false);
    setImportLoading(false);
    await fetchStandards();
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/teacher")}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="text-indigo-600" size={22} />
              Standards & Learning Targets
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <Upload size={16} />
              Import from PDF
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <PlusCircle size={16} />
              Add Standard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Stats bar */}
        <div className="flex gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex-1 text-center">
            <div className="text-2xl font-bold text-indigo-600">{standards.length}</div>
            <div className="text-xs text-gray-500 font-medium">Standards</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex-1 text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {standards.reduce((sum, s) => sum + (s.learning_targets?.length || 0), 0)}
            </div>
            <div className="text-xs text-gray-500 font-medium">Learning Targets</div>
          </div>
        </div>

        {/* Create Standard Form */}
        {showCreateForm && (
          <div className="bg-white border border-indigo-200 rounded-xl p-5 mb-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Add New Standard</h3>
            <form onSubmit={handleCreateStandard} className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Code (e.g., HS-PS1-8)"
                  required
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select
                  value={newDimension}
                  onChange={(e) => setNewDimension(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="DCI">DCI</option>
                  <option value="SEP">SEP</option>
                  <option value="CCC">CCC</option>
                </select>
              </div>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Performance expectation description..."
                required
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {createLoading && <Loader2 size={14} className="animate-spin" />}
                  Save Standard
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Standards List */}
        {standards.length === 0 ? (
          <div className="bg-white border-dashed border-2 border-gray-300 rounded-xl p-12 text-center text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-lg font-medium mb-1">No standards yet</p>
            <p className="text-sm">Click &quot;Add Standard&quot; or &quot;Import from PDF&quot; to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {standards.map((standard) => {
              const isExpanded = expandedId === standard.id;
              const dim = standard.dimension || "DCI";
              const dimStyle = DIMENSION_COLORS[dim] || DIMENSION_COLORS.DCI;
              const sortedTargets = [...(standard.learning_targets || [])].sort((a, b) =>
                parseFloat(a.level) - parseFloat(b.level)
              );

              return (
                <div key={standard.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  {/* Standard Header */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : standard.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                      )}
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${dimStyle.bg} ${dimStyle.text} ${dimStyle.border} flex-shrink-0`}
                      >
                        {dim}
                      </span>
                      <span className="font-mono font-bold text-sm text-indigo-700 flex-shrink-0">
                        {standard.code}
                      </span>
                      <span className="text-sm text-gray-700 truncate">{standard.description}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className="text-xs text-gray-400">
                        {standard.learning_targets?.length || 0} targets
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStandard(standard.id);
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: Learning Targets */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                      {sortedTargets.length === 0 ? (
                        <p className="text-sm text-gray-400 italic mb-3">No learning targets yet.</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {sortedTargets.map((target) => {
                            const lvl = LEVEL_COLORS[target.level] || LEVEL_COLORS["3.0"];
                            const isEditing = editingTargetId === target.id;

                            return (
                              <div
                                key={target.id}
                                className={`flex items-start gap-3 px-3 py-2 rounded-lg border ${lvl.bg} border-gray-200`}
                              >
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${lvl.bg} ${lvl.text} border border-current/20 flex-shrink-0 mt-0.5`}
                                >
                                  {target.level} — {lvl.label}
                                </span>
                                {isEditing ? (
                                  <div className="flex-1 flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editingTargetDesc}
                                      onChange={(e) => setEditingTargetDesc(e.target.value)}
                                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleUpdateTarget(target.id, standard.id)}
                                      className="text-green-600 hover:text-green-800"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      onClick={() => setEditingTargetId(null)}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex-1 flex items-center justify-between gap-2">
                                    <span className={`text-sm ${lvl.text}`}>{target.description}</span>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        onClick={() => {
                                          setEditingTargetId(target.id);
                                          setEditingTargetDesc(target.description);
                                        }}
                                        className="text-gray-300 hover:text-gray-600 transition-colors"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTarget(target.id, standard.id)}
                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Target inline form */}
                      {addingTargetStandardId === standard.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <select
                            value={newTargetLevel}
                            onChange={(e) => setNewTargetLevel(e.target.value)}
                            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          >
                            <option value="2.0">2.0 — Foundational</option>
                            <option value="3.0">3.0 — Target</option>
                            <option value="4.0">4.0 — Advanced</option>
                          </select>
                          <input
                            type="text"
                            value={newTargetDesc}
                            onChange={(e) => setNewTargetDesc(e.target.value)}
                            placeholder="Learning target description..."
                            className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddTarget(standard.id)}
                            disabled={!newTargetDesc.trim()}
                            className="text-green-600 hover:text-green-800 disabled:opacity-30"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setAddingTargetStandardId(null);
                              setNewTargetDesc("");
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingTargetStandardId(standard.id);
                            setNewTargetDesc("");
                          }}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mt-1"
                        >
                          <PlusCircle size={14} /> Add Learning Target
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-emerald-600" size={20} />
              <h3 className="text-lg font-bold text-gray-900">AI Standards Import</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Upload an NGSS Evidence Statement PDF or paste standards text. The AI will parse it into
              standards with Marzano 2.0/3.0/4.0 learning targets.
            </p>

            {!importPreview ? (
              <>
                {/* File upload */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Upload PDF</label>
                  <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        setImportFile(e.target.files?.[0] || null);
                        setImportText("");
                      }}
                    />
                    <div className="text-center">
                      <FileText className="mx-auto text-gray-400 mb-2" size={28} />
                      <p className="text-sm text-gray-600">
                        {importFile ? importFile.name : "Click to select PDF, DOCX, or TXT"}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">OR</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Text input */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Paste Standards Text</label>
                  <textarea
                    value={importText}
                    onChange={(e) => {
                      setImportText(e.target.value);
                      setImportFile(null);
                    }}
                    placeholder="Paste NGSS performance expectations here..."
                    rows={5}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportText("");
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportParse}
                    disabled={importLoading || (!importFile && !importText.trim())}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {importLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {importLoading ? "Parsing with AI..." : "Parse Standards"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Preview */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Preview — {importPreview.length} standard{importPreview.length !== 1 ? "s" : ""} found
                  </h4>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                    {importPreview.map((std: any, i: number) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                        <div className="flex items-center gap-2 mb-2">
                          {std.dimension && (
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                (DIMENSION_COLORS[std.dimension] || DIMENSION_COLORS.DCI).bg
                              } ${(DIMENSION_COLORS[std.dimension] || DIMENSION_COLORS.DCI).text} ${
                                (DIMENSION_COLORS[std.dimension] || DIMENSION_COLORS.DCI).border
                              }`}
                            >
                              {std.dimension}
                            </span>
                          )}
                          <span className="font-mono font-bold text-sm text-indigo-700">{std.code}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{std.description}</p>
                        {std.learning_targets?.map((lt: any, j: number) => {
                          const lvl = LEVEL_COLORS[lt.level] || LEVEL_COLORS["3.0"];
                          return (
                            <div key={j} className={`text-xs px-2 py-1 rounded mb-1 ${lvl.bg} ${lvl.text}`}>
                              <span className="font-semibold">{lt.level}:</span> {lt.description}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setImportPreview(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleImportConfirm}
                    disabled={importLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {importLoading && <Loader2 size={16} className="animate-spin" />}
                    Import {importPreview.length} Standard{importPreview.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
