"use client";
import React, { useState } from "react";
import { Settings, Save, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AssignmentSettingsProps {
  assignment: any;
  onUpdate: (updated: any) => void;
}

export function AssignmentSettings({ assignment, onUpdate }: AssignmentSettingsProps) {
  const [title, setTitle] = useState(assignment.title || "");
  const [rubric, setRubric] = useState(assignment.rubric || "");
  const [maxScore, setMaxScore] = useState(assignment.max_score?.toString() || "100");
  const [framework, setFramework] = useState(assignment.grading_framework || "criteria");
  const [isSocratic, setIsSocratic] = useState(assignment.is_socratic || false);
  const [autoSendEmails, setAutoSendEmails] = useState(assignment.auto_send_emails || false);
  const [maxAttempts, setMaxAttempts] = useState(assignment.max_attempts?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("assignments")
      .update({
        title,
        rubric,
        max_score: parseInt(maxScore) || 100,
        grading_framework: framework,
        is_socratic: isSocratic,
        auto_send_emails: autoSendEmails,
        max_attempts: maxAttempts ? parseInt(maxAttempts) : null,
      })
      .eq("id", assignment.id)
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      onUpdate(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <details className="bg-white border border-gray-200 rounded-xl shadow-sm group">
      <summary className="cursor-pointer px-6 py-4 flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-indigo-700 transition-colors select-none">
        <Settings size={16} className="text-gray-400 group-open:text-indigo-600 transition-colors" />
        Edit Assignment Settings
      </summary>
      <div className="px-6 pb-6 pt-2 border-t border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>

        {/* Framework */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Grading Framework</label>
          <select value={framework} onChange={e => setFramework(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="criteria">Criteria-Based</option>
            <option value="ngss_skills">NGSS SEP Skills</option>
            <option value="ngss_rubric">NGSS Rubric</option>
          </select>
        </div>

        {/* Rubric */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rubric</label>
          <textarea value={rubric} onChange={e => setRubric(e.target.value)} rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Max Score */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max Score</label>
            <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          {/* Max Attempts */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Submission Limit</label>
            <input type="number" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} placeholder="Unlimited"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={isSocratic} onChange={e => setIsSocratic(e.target.checked)}
              className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
            Socratic Feedback
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={autoSendEmails} onChange={e => setAutoSendEmails(e.target.checked)}
              className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
            Auto-Send Emails
          </label>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? "Saved ✓" : saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </details>
  );
}
