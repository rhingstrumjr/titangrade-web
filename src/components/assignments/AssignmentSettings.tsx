"use client";
import React, { useState } from "react";
import { Settings, Save, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { RubricBuilder } from "@/components/RubricBuilder";
import { AnswerKeyEditor } from "@/app/teacher/AnswerKeyEditor";
import type { RubricCriterion } from "@/types/submission";

const supabase = createClient();

interface AssignmentSettingsProps {
  assignment: any;
  onUpdate: (updated: any) => void;
}

export function AssignmentSettings({ assignment, onUpdate }: AssignmentSettingsProps) {
  // ── Basic settings ──
  const [title, setTitle] = useState(assignment.title || "");
  const [description, setDescription] = useState(assignment.description || "");
  const [rubricText, setRubricText] = useState(
    assignment.rubric && !assignment.rubric.startsWith("http") ? assignment.rubric : ""
  );
  const [maxScore, setMaxScore] = useState(assignment.max_score?.toString() || "100");
  const [framework, setFramework] = useState(assignment.grading_framework || "standard");
  const [isSocratic, setIsSocratic] = useState(assignment.is_socratic || false);
  const [feedbackReleaseMode, setFeedbackReleaseMode] = useState<"immediate" | "manual">(
    assignment.feedback_release_mode || "immediate"
  );
  const [maxAttempts, setMaxAttempts] = useState(assignment.max_attempts?.toString() || "1");

  // ── Rubric ──
  const existingRubricIsFile = assignment.rubric && assignment.rubric.startsWith("http");
  const [rubricType, setRubricType] = useState<"text" | "file">(existingRubricIsFile ? "file" : "text");
  const [newRubricFiles, setNewRubricFiles] = useState<File[]>([]);
  const [structuredCriteria, setStructuredCriteria] = useState<RubricCriterion[]>(
    assignment.structured_rubric || []
  );
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [autoParseError, setAutoParseError] = useState("");

  // ── Exemplar ──
  const [newExemplarFiles, setNewExemplarFiles] = useState<File[]>([]);

  // ── Answer Key ──
  const [generatedKey, setGeneratedKey] = useState<any>(assignment.generated_key || null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // ── Save state ──
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // ── Auto-Parse handler ──
  const handleAutoParse = async () => {
    setIsAutoParsing(true);
    setAutoParseError("");
    try {
      let body: Record<string, string> = {};
      if (rubricType === "file" && newRubricFiles.length > 0) {
        const file = newRubricFiles[0];
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        body = { file: base64, mimeType: file.type };
      } else {
        body = { text: rubricText };
      }
      body.assignmentId = assignment.id;

      const res = await fetch("/api/parse-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.criteria) {
        setStructuredCriteria(data.criteria);
      } else {
        setAutoParseError(data.error || "Failed to parse rubric.");
      }
    } catch (err) {
      console.error(err);
      setAutoParseError("Error connecting to AI.");
    } finally {
      setIsAutoParsing(false);
    }
  };

  // ── Save handler ──
  const handleSave = async () => {
    setSaving(true);

    // Build final rubric values
    let finalRubricValue = rubricText;
    let finalRubricsArray = rubricText ? [rubricText] : [];
    let finalStructuredRubric: RubricCriterion[] | null = null;

    // Structured criteria
    if (structuredCriteria.length > 0) {
      finalStructuredRubric = structuredCriteria.filter((c) => c.name.trim());
      if (finalStructuredRubric.length > 0) {
        const plainText = finalStructuredRubric
          .map((c) => {
            let line = `${c.name} (${c.maxPoints} pts): ${c.description}`;
            if (c.levels && c.levels.length > 0) {
              const levelText = c.levels
                .map((l) => `  - ${l.label} (${l.points} pts): ${l.description}`)
                .join("\n");
              line += "\n" + levelText;
            }
            return line;
          })
          .join("\n\n");
        if (!finalRubricValue.trim()) {
          finalRubricValue = plainText;
          finalRubricsArray = [plainText];
        }
      } else {
        finalStructuredRubric = null;
      }
    }

    // Upload rubric files if new ones selected
    if (rubricType === "file" && newRubricFiles.length > 0) {
      try {
        const urls = await Promise.all(
          newRubricFiles.map(async (file) => {
            const fileExt = file.name.split(".").pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_rubric.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from("rubrics").upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from("rubrics").getPublicUrl(fileName);
            return publicUrlData.publicUrl;
          })
        );
        finalRubricValue = urls[0];
        finalRubricsArray = urls;
      } catch (uploadError) {
        console.error("Error uploading rubrics:", uploadError);
        alert("Failed to upload the rubric files.");
        setSaving(false);
        return;
      }
    } else if (rubricType === "file" && newRubricFiles.length === 0) {
      // Keep existing file rubric
      finalRubricValue = assignment.rubric;
      finalRubricsArray = assignment.rubrics || (assignment.rubric ? [assignment.rubric] : []);
    }

    // Upload exemplar files if new ones selected
    let finalExemplarValue = assignment.exemplar_url;
    let finalExemplarArray = assignment.exemplar_urls;
    if (newExemplarFiles.length > 0) {
      try {
        const urls = await Promise.all(
          newExemplarFiles.map(async (file) => {
            const fileExt = file.name.split(".").pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_exemplar.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from("rubrics").upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from("rubrics").getPublicUrl(fileName);
            return publicUrlData.publicUrl;
          })
        );
        finalExemplarValue = urls[0];
        finalExemplarArray = urls;
      } catch (uploadError) {
        console.error("Error uploading exemplars:", uploadError);
        alert("Failed to upload the exemplar files.");
        setSaving(false);
        return;
      }
    }

    // Compute final score
    const finalScore =
      framework === "marzano"
        ? 4
        : finalStructuredRubric && finalStructuredRubric.length > 0
          ? finalStructuredRubric.reduce((sum, c) => sum + c.maxPoints, 0)
          : parseInt(maxScore) || 100;

    const { data, error } = await supabase
      .from("assignments")
      .update({
        title,
        description,
        rubric: finalRubricValue,
        rubrics: finalRubricsArray.length > 0 ? finalRubricsArray : null,
        structured_rubric: finalStructuredRubric,
        max_score: finalScore,
        grading_framework: framework,
        is_socratic: isSocratic,
        feedback_release_mode: feedbackReleaseMode,
        max_attempts: maxAttempts ? parseInt(maxAttempts) : null,
        exemplar_url: finalExemplarValue,
        exemplar_urls: finalExemplarArray,
        generated_key: generatedKey,
      })
      .eq("id", assignment.id)
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      onUpdate(data);
      setSaved(true);
      setIsOpen(false);
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert("Failed to save settings.");
    }
  };

  return (
    <details 
      open={isOpen} 
      onToggle={(e: any) => setIsOpen(e.target.open)} 
      className="bg-white border border-gray-200 rounded-xl shadow-sm group"
    >
      <summary className="cursor-pointer px-6 py-4 flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-indigo-700 transition-colors select-none">
        <Settings size={16} className="text-gray-400 group-open:text-indigo-600 transition-colors" />
        Edit Assignment Settings
      </summary>
      <div className="px-6 pb-6 pt-2 border-t border-gray-100 space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
        {/* ── Row 1: Title + Framework ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Grading Framework
            </label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="standard">Standard Percentage</option>
              <option value="marzano">Marzano Scale (4.0)</option>
            </select>
          </div>
        </div>

        {/* ── Row 1.5: Description ── */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Description (Visible to Students)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Instructions or prompt for the student... (This will sync to Google Classroom)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* ── Row 2: Max Score + Max Attempts ── */}
        <div className="grid grid-cols-2 gap-4">
          {framework !== "marzano" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max Score</label>
              <input
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Submission Limit
            </label>
            <input
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              placeholder="Unlimited"
              min={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Allowed drafts</p>
          </div>
        </div>

        {/* ── Row 3: Toggles ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
            <input
              id="settings-socratic-toggle"
              type="checkbox"
              checked={isSocratic}
              onChange={(e) => setIsSocratic(e.target.checked)}
              className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <div className="ml-3">
              <label htmlFor="settings-socratic-toggle" className="font-semibold text-indigo-900 cursor-pointer text-sm">
                Enable Socratic Tutor Mode
              </label>
              <p className="text-xs text-indigo-700 mt-0.5">
                The AI will never reveal the correct answer directly. Instead, it will guide the student to find the answer themselves.
              </p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <select
              id="settings-feedback-release"
              value={feedbackReleaseMode}
              onChange={(e) => setFeedbackReleaseMode(e.target.value as "immediate" | "manual")}
              className="h-9 w-32 px-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="immediate">Immediate</option>
              <option value="manual">Manual / Later</option>
            </select>
            <div className="ml-3">
              <label htmlFor="settings-feedback-release" className="font-semibold text-gray-900 cursor-pointer text-sm">
                Feedback Release (Google Classroom)
              </label>
              <p className="text-xs text-gray-600 mt-0.5">
                Should students receive their feedback immediately when generated, or should it wait until you release it manually?
              </p>
            </div>
          </div>
        </div>

        {/* ── Rubric Section ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase">Grading Rubric</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setRubricType("text")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${rubricType === "text" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}
              >
                Type Text
              </button>
              <button
                type="button"
                onClick={() => setRubricType("file")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${rubricType === "file" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}
              >
                Upload File
              </button>
            </div>
          </div>

          {rubricType === "text" ? (
            <textarea
              value={rubricText}
              onChange={(e) => setRubricText(e.target.value)}
              placeholder="Paste your rubric and evaluation criteria here. The more detailed, the better the AI will grade."
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          ) : (
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="space-y-1 text-center">
                <div className="flex text-sm text-gray-600 justify-center">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                    <span>Click to upload rubric</span>
                    <input
                      type="file"
                      className="sr-only"
                      multiple
                      accept=".pdf, .png, .jpg, .jpeg"
                      onChange={(e) => {
                        if (e.target.files) setNewRubricFiles(Array.from(e.target.files));
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">Upload one or multiple pages (PDF, PNG, JPG)</p>
                {newRubricFiles.length > 0 ? (
                  <p className="text-sm font-semibold text-indigo-900 mt-2">
                    {newRubricFiles.length} file(s) selected
                  </p>
                ) : existingRubricIsFile ? (
                  <p className="text-sm font-semibold text-indigo-900 mt-2">Keeping previously uploaded file.</p>
                ) : null}
              </div>
            </div>
          )}

          {/* Auto-Parse Button */}
          {((rubricType === "text" && rubricText.trim().length > 20) ||
            (rubricType === "file" && newRubricFiles.length > 0)) && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleAutoParse}
                  disabled={isAutoParsing}
                  className="flex items-center gap-2 w-full justify-center bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                  {isAutoParsing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Parsing rubric with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      ✨ Auto-Parse into Structured Rubric
                    </>
                  )}
                </button>
                {autoParseError && <p className="text-sm text-red-600 mt-1">{autoParseError}</p>}
              </div>
            )}

          {/* Structured Rubric Builder */}
          <div className="mt-4">
            <RubricBuilder criteria={structuredCriteria} onChange={setStructuredCriteria} />
          </div>
        </div>

        {/* ── Exemplar Upload ── */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Optional: Answer Key Exemplar
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="space-y-1 text-center">
              <div className="flex text-sm text-gray-600 justify-center">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-emerald-500 px-2 py-1">
                  <span>Select absolute perfect 100% answer key</span>
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    accept=".pdf, .png, .jpg, .jpeg"
                    onChange={(e) => {
                      if (e.target.files) setNewExemplarFiles(Array.from(e.target.files));
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Select one or multiple pages. Uploading this eliminates AI hallucinations on answers.
              </p>
              {newExemplarFiles.length > 0 ? (
                <p className="text-sm font-semibold text-emerald-900 mt-2">
                  {newExemplarFiles.length} file(s) selected
                </p>
              ) : assignment.exemplar_url ? (
                <p className="text-sm font-semibold text-emerald-900 mt-2">Keeping previously uploaded exemplar.</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Answer Key Generator ── */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Optional: Auto-Generate Answer Key (AI)
          </label>
          <div className="mt-1 flex flex-col px-6 pt-5 pb-6 border border-gray-300 rounded-md bg-white">
            {!generatedKey ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-gray-600">
                  Upload a blank worksheet to automatically generate a structured JSON answer key using Gemini.
                </p>
                <p className="text-xs text-indigo-600 font-medium bg-indigo-50 p-2 rounded-md inline-block">
                  <strong>Required Formats: PDF, PNG, or JPG.</strong>
                  <br />
                  For Google Docs or Microsoft Word, please select <em>File → Download → PDF</em> first.
                </p>
                <div className="flex text-sm text-gray-600 justify-center">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 px-4 py-2 border border-blue-200 shadow-sm transition-colors hover:bg-blue-50">
                    {isGeneratingKey ? "Analyzing Document..." : "Select Blank Worksheet & Generate"}
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf, .png, .jpg, .jpeg"
                      disabled={isGeneratingKey}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          setIsGeneratingKey(true);
                          const formData = new FormData();
                          formData.append("file", e.target.files[0]);
                          try {
                            const res = await fetch("/api/generate-key", { method: "POST", body: formData });
                            const data = await res.json();
                            if (data.success && data.answerKey) {
                              setGeneratedKey(data.answerKey);
                            } else {
                              alert(data.error || "Failed to generate answer key.");
                            }
                          } catch (err) {
                            console.error(err);
                            alert("Error generating key.");
                          } finally {
                            setIsGeneratingKey(false);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-emerald-600">Answer Key Generated!</span>
                  <button type="button" onClick={() => setGeneratedKey(null)} className="text-xs text-red-500 hover:underline">
                    Clear Key
                  </button>
                </div>
                <AnswerKeyEditor answerKey={generatedKey} onChange={setGeneratedKey} />
              </div>
            )}
          </div>
        </div>

        {/* ── Save Button ── */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? "Saved ✓" : saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </details>
  );
}
