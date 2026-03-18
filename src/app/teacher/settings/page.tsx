"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ArrowLeft,
  Settings,
  Save,
  Loader2,
  CheckCircle2,
  User,
  Sparkles,
  BookOpen,
} from "lucide-react";
import type { TeacherProfile } from "@/types/standards";

const supabase = createClient();

const TONE_OPTIONS = [
  { value: "encouraging", label: "Encouraging", desc: "Warm, supportive language that celebrates effort", emoji: "🌟" },
  { value: "direct", label: "Direct", desc: "Clear, concise feedback focused on improvement", emoji: "🎯" },
  { value: "socratic", label: "Socratic", desc: "Guides through questions rather than stating answers", emoji: "🤔" },
  { value: "detailed", label: "Detailed", desc: "Thorough, in-depth explanations with examples", emoji: "📝" },
  { value: "growth-mindset", label: "Growth Mindset", desc: "Emphasizes learning process and potential", emoji: "🌱" },
];

export default function TeacherSettingsPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [defaultFramework, setDefaultFramework] = useState<"standard" | "marzano">("standard");
  const [defaultTone, setDefaultTone] = useState("encouraging");

  // Stats
  const [standardsCount, setStandardsCount] = useState(0);
  const [interventionsCount, setInterventionsCount] = useState(0);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUserId(user.id);

    // Fetch teacher profile
    const { data: profile } = await supabase
      .from("teacher_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      setProfileExists(true);
      setDefaultFramework((profile as TeacherProfile).default_framework || "standard");
      setDefaultTone((profile as TeacherProfile).default_tone || "encouraging");
    }

    // Fetch stats
    const [stdRes, intRes] = await Promise.all([
      supabase.from("standards").select("id", { count: "exact", head: true }).eq("teacher_id", user.id),
      supabase.from("intervention_bank").select("id", { count: "exact", head: true }).eq("teacher_id", user.id),
    ]);
    setStandardsCount(stdRes.count || 0);
    setInterventionsCount(intRes.count || 0);

    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);

    const profileData = {
      id: userId,
      default_framework: defaultFramework,
      default_tone: defaultTone,
    };

    let error;
    if (profileExists) {
      ({ error } = await supabase
        .from("teacher_profiles")
        .update(profileData)
        .eq("id", userId));
    } else {
      ({ error } = await supabase
        .from("teacher_profiles")
        .insert([profileData]));
      if (!error) setProfileExists(true);
    }

    setIsSaving(false);
    if (error) {
      console.error("Save profile error:", error);
      alert("Failed to save settings.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

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
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/teacher")}
              className="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={20} />
              <span className="font-medium hidden sm:inline">Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-l border-gray-300 pl-4">
              <Settings className="text-indigo-600" size={20} />
              Teacher Settings
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <CheckCircle2 size={14} />
            ) : (
              <Save size={14} />
            )}
            {saved ? "Saved ✓" : isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome / Profile Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <User size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Your Teaching Profile</h2>
              <p className="text-indigo-100 text-sm">
                Customize how TitanGrade&apos;s AI assistant grades and provides feedback.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-indigo-200 uppercase font-bold tracking-wider">Standards</p>
              <p className="text-2xl font-bold mt-1">{standardsCount}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-indigo-200 uppercase font-bold tracking-wider">Interventions</p>
              <p className="text-2xl font-bold mt-1">{interventionsCount}</p>
            </div>
          </div>
        </div>

        {/* Default Grading Framework */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Default Grading Framework</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            New assignments will default to this framework. You can always change it per-assignment.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDefaultFramework("standard")}
              className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
                defaultFramework === "standard"
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <span className="text-sm font-bold text-gray-900">Standard Percentage</span>
              <span className="text-xs text-gray-500 mt-1">Traditional 0-100% scoring with rubric categories</span>
            </button>
            <button
              type="button"
              onClick={() => setDefaultFramework("marzano")}
              className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
                defaultFramework === "marzano"
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <span className="text-sm font-bold text-gray-900">Marzano Scale (4.0)</span>
              <span className="text-xs text-gray-500 mt-1">Standards-based 2.0 / 3.0 / 4.0 learning targets</span>
            </button>
          </div>
        </div>

        {/* Default AI Feedback Tone */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">AI Feedback Tone</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Choose the default personality for AI-generated student feedback.
          </p>
          <div className="space-y-2">
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone.value}
                type="button"
                onClick={() => setDefaultTone(tone.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  defaultTone === tone.value
                    ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-100"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <span className="text-xl flex-shrink-0">{tone.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-gray-900">{tone.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{tone.desc}</p>
                </div>
                {defaultTone === tone.value && (
                  <CheckCircle2 size={18} className="text-indigo-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/teacher/standards"
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <BookOpen size={16} className="text-indigo-600" />
              Standards Library
            </a>
            <a
              href="/teacher"
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <ArrowLeft size={16} className="text-indigo-600" />
              Back to Dashboard
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
