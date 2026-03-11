import React, { useState, useEffect } from "react";
import { X, BarChart3, AlertTriangle, Lightbulb, Loader2, TrendingDown, TrendingUp, Users, CheckCircle2 } from "lucide-react";
import type { Submission } from "@/types/submission";

interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any; // Using any for assignment to match existing page usage loosely
  submissions: Submission[];
}

interface TroubleSpot {
  criterion: string;
  avgScore: string;
  avgPct: number;
  pctStruggling: number;
  totalStudents: number;
}

export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = ({ 
  isOpen, 
  onClose, 
  assignment, 
  submissions 
}) => {
  const [reteachPlan, setReteachPlan] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [reteachCost, setReteachCost] = useState<number>(0);
  const [selectedTroubleSpots, setSelectedTroubleSpots] = useState<Set<string>>(new Set());
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Reset state when drawer opens 
  useEffect(() => {
    if (isOpen) {
      setHasAutoSelected(false);
      setSelectedTroubleSpots(new Set());
      setReteachPlan(null);
      setReteachCost(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter for graded submissions
  const gradedSubmissions = submissions.filter(s => s.status === "graded");

  let content;

  if (!assignment || gradedSubmissions.length === 0) {
    content = (
      <div className="flex flex-col h-full bg-gray-50 items-center justify-center p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm w-full max-w-md">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No graded submissions yet</h3>
          <p className="text-gray-500">Analytics will appear once students have been graded.</p>
        </div>
      </div>
    );
  } else {
    // ── Compute Stats ──
    const isMarzano = assignment.grading_framework === "marzano";
    const maxScore = assignment.max_score;

    // Get latest submission per student
    const latestByStudent: Record<string, Submission> = {};
    for (const sub of gradedSubmissions) {
      if (!latestByStudent[sub.student_email] || new Date(sub.created_at) > new Date(latestByStudent[sub.student_email].created_at)) {
        latestByStudent[sub.student_email] = sub;
      }
    }
    const latestSubs = Object.values(latestByStudent);

    // Parse numeric scores
    const numericScores = latestSubs
      .map(s => {
        if (!s.score) return null;
        const num = parseFloat(s.score.split("/")[0]);
        return isNaN(num) ? null : num;
      })
      .filter((n): n is number => n !== null);

    if (numericScores.length === 0) {
      content = (
        <div className="p-8">
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-500">No numeric scores found for analytics.</p>
          </div>
        </div>
      );
    } else {
      const sortedScores = [...numericScores].sort((a, b) => a - b);
      const mean = numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
      const median = sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
        : sortedScores[Math.floor(sortedScores.length / 2)];
      const high = sortedScores[sortedScores.length - 1];
      const low = sortedScores[0];

      // ── Score Distribution Histogram ──
      let buckets: { label: string; count: number; pct: number }[];

      if (isMarzano) {
        const marzanoLevels = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
        buckets = marzanoLevels.map(level => {
          const count = numericScores.filter(s => s === level).length;
          return { label: `${level}`, count, pct: (count / numericScores.length) * 100 };
        });
      } else {
        const bucketRanges = Array.from({ length: 10 }, (_, i) => ({
          min: i * 10,
          max: (i + 1) * 10,
          label: `${i * 10}-${(i + 1) * 10}%`,
        }));
        buckets = bucketRanges.map(b => {
          const count = numericScores.filter(s => {
            const pct = (s / maxScore) * 100;
            return b.max === 100 ? pct >= b.min && pct <= b.max : pct >= b.min && pct < b.max;
          }).length;
          return { label: b.label, count, pct: (count / numericScores.length) * 100 };
        });
      }

      const maxBucketCount = Math.max(...buckets.map(b => b.count), 1);

      // ── Category / Skill Breakdown ──
      const categoryAverages: { name: string; avgEarned: number; avgPossible: number; avgPct: number }[] = [];
      const skillAverages: { skill: string; level: string; dimension: string; pctDemonstrated: number; total: number }[] = [];

      if (!isMarzano) {
        const catMap: Record<string, { totalEarned: number; totalPossible: number; count: number }> = {};
        for (const sub of latestSubs) {
          if (!sub.category_scores) continue;
          for (const cs of sub.category_scores) {
            if (!catMap[cs.category]) catMap[cs.category] = { totalEarned: 0, totalPossible: 0, count: 0 };
            catMap[cs.category].totalEarned += cs.earned;
            catMap[cs.category].totalPossible += cs.possible;
            catMap[cs.category].count++;
          }
        }
        for (const [name, data] of Object.entries(catMap)) {
          const avgEarned = data.totalEarned / data.count;
          const avgPossible = data.totalPossible / data.count;
          categoryAverages.push({
            name,
            avgEarned,
            avgPossible,
            avgPct: avgPossible > 0 ? (avgEarned / avgPossible) * 100 : 0,
          });
        }
        categoryAverages.sort((a, b) => a.avgPct - b.avgPct);
      } else {
        const skillMap: Record<string, { demonstrated: number; total: number; level: string; dimension: string }> = {};
        for (const sub of latestSubs) {
          if (!sub.skill_assessments) continue;
          for (const sa of sub.skill_assessments) {
            const key = `${sa.level}|${sa.skill}`;
            if (!skillMap[key]) skillMap[key] = { demonstrated: 0, total: 0, level: sa.level, dimension: sa.dimension };
            if (sa.status !== "not_assessed") {
              skillMap[key].total++;
              if (sa.status === "demonstrated") skillMap[key].demonstrated++;
            }
          }
        }
        for (const [, data] of Object.entries(skillMap)) {
          if (data.total > 0) {
            skillAverages.push({
              skill: Object.keys(skillMap).find(k => skillMap[k] === data)!.split("|")[1],
              level: data.level,
              dimension: data.dimension,
              pctDemonstrated: (data.demonstrated / data.total) * 100,
              total: data.total,
            });
          }
        }
        skillAverages.sort((a, b) => a.pctDemonstrated - b.pctDemonstrated);
      }

      const MASTERY_THRESHOLD = 80;
      const allCriteria: TroubleSpot[] = [];

      if (!isMarzano && categoryAverages.length > 0) {
        for (const cat of categoryAverages) {
          let struggling = 0;
          for (const sub of latestSubs) {
            if (!sub.category_scores) continue;
            const cs = sub.category_scores.find((c: any) => c.category === cat.name);
            if (cs && cs.possible > 0 && (cs.earned / cs.possible) < 0.6) struggling++;
          }
          allCriteria.push({
            criterion: cat.name,
            avgScore: `${cat.avgEarned.toFixed(1)}/${cat.avgPossible.toFixed(1)}`,
            avgPct: cat.avgPct,
            pctStruggling: Math.round((struggling / latestSubs.length) * 100),
            totalStudents: latestSubs.length,
          });
        }
      } else if (isMarzano && skillAverages.length > 0) {
        for (const sa of skillAverages) {
          allCriteria.push({
            criterion: `[${sa.level}] ${sa.dimension}: ${sa.skill}`,
            avgScore: `${sa.pctDemonstrated.toFixed(0)}% demonstrated`,
            avgPct: sa.pctDemonstrated,
            pctStruggling: Math.round(100 - sa.pctDemonstrated),
            totalStudents: sa.total,
          });
        }
      }

      const troubleSpots = allCriteria.filter(c => c.avgPct < MASTERY_THRESHOLD);
      const strengths = allCriteria.filter(c => c.avgPct >= MASTERY_THRESHOLD).sort((a, b) => b.avgPct - a.avgPct);

      if (troubleSpots.length > 0 && !hasAutoSelected) {
        queueMicrotask(() => {
          setSelectedTroubleSpots(new Set(troubleSpots.map(ts => ts.criterion)));
          setHasAutoSelected(true);
        });
      }

      const threshold = isMarzano ? 2.0 : maxScore * 0.6;
      const strugglingStudents = latestSubs
        .filter(s => {
          const num = parseFloat(s.score?.split("/")[0] || "0");
          return num < threshold;
        })
        .sort((a, b) => parseFloat(a.score?.split("/")[0] || "0") - parseFloat(b.score?.split("/")[0] || "0"));

      const handleGenerateReteach = async () => {
        const spotsToSend = troubleSpots.filter(ts => selectedTroubleSpots.has(ts.criterion));
        if (spotsToSend.length === 0) return;
        setIsGeneratingPlan(true);
        try {
          const res = await fetch("/api/reteach-suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignmentId: assignment.id,
              assignmentTitle: assignment.title,
              gradingFramework: assignment.grading_framework,
              troubleSpots: spotsToSend,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setReteachPlan(data.plan);
            setReteachCost(data.estCost || 0);
          } else {
            alert(data.error || "Failed to generate reteach plan.");
          }
        } catch (err) {
          console.error(err);
          alert("Error generating reteach plan.");
        } finally {
          setIsGeneratingPlan(false);
        }
      };

      const getBarColor = (pct: number) => {
        if (pct >= 80) return "bg-emerald-500";
        if (pct >= 60) return "bg-amber-500";
        return "bg-red-500";
      };

      const getScoreColor = (score: number) => {
        const pct = isMarzano ? (score / 4) * 100 : (score / maxScore) * 100;
        if (pct >= 80) return "text-emerald-700 bg-emerald-50";
        if (pct >= 60) return "text-amber-700 bg-amber-50";
        return "text-red-700 bg-red-50";
      };

      content = (
        <div className="p-6 md:p-8 space-y-8">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Mean", value: isMarzano ? mean.toFixed(1) : `${mean.toFixed(1)}/${maxScore}`, sub: `${((mean / maxScore) * 100).toFixed(0)}%` },
              { label: "Median", value: isMarzano ? median.toFixed(1) : `${median.toFixed(1)}/${maxScore}`, sub: `${((median / maxScore) * 100).toFixed(0)}%` },
              { label: "Highest", value: isMarzano ? high.toFixed(1) : `${high}/${maxScore}`, sub: `${((high / maxScore) * 100).toFixed(0)}%` },
              { label: "Lowest", value: isMarzano ? low.toFixed(1) : `${low}/${maxScore}`, sub: `${((low / maxScore) * 100).toFixed(0)}%` },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Score Distribution Histogram */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-600" />
              Score Distribution
            </h2>
            <div className="flex items-end gap-1.5 h-32">
              {buckets.map((bucket, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] font-medium text-gray-700">{bucket.count}</span>
                  <div
                    className={`w-full rounded-t-sm transition-all duration-500 ${getBarColor(isMarzano ? (parseFloat(bucket.label) / 4) * 100 : parseInt(bucket.label))}`}
                    style={{ height: `${(bucket.count / maxBucketCount) * 100}%`, minHeight: bucket.count > 0 ? "4px" : "2px" }}
                  />
                  <span className="text-[9px] text-gray-500 mt-0.5 leading-tight text-center hidden sm:block">
                    {bucket.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Category/Skill Breakdown */}
          {(categoryAverages.length > 0 || skillAverages.length > 0) && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingDown size={18} className="text-amber-600" />
                {isMarzano ? "Skill Performance" : "Category Breakdown"}
              </h2>
              <div className="space-y-3">
                {(isMarzano ? skillAverages : categoryAverages).map((item, i) => {
                  const pct = isMarzano ? (item as typeof skillAverages[0]).pctDemonstrated : (item as typeof categoryAverages[0]).avgPct;
                  const label = isMarzano
                    ? `[${(item as typeof skillAverages[0]).level}] ${(item as typeof skillAverages[0]).skill}`
                    : (item as typeof categoryAverages[0]).name;
                  const detail = isMarzano
                    ? `${pct.toFixed(0)}% demod`
                    : `${(item as typeof categoryAverages[0]).avgEarned.toFixed(1)}/${(item as typeof categoryAverages[0]).avgPossible.toFixed(1)}`;

                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-gray-700 truncate" title={label}>{label}</div>
                      <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getBarColor(pct)}`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-800">
                          {detail} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trouble Spots */}
          {troubleSpots.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col mb-3 gap-2">
                <h2 className="text-md font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-500" />
                  Trouble Spots
                </h2>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedTroubleSpots(new Set(troubleSpots.map(ts => ts.criterion)))} className="text-indigo-600 hover:underline">All</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => setSelectedTroubleSpots(new Set())} className="text-gray-500 hover:underline">Clear</button>
                  </div>
                  <button
                    onClick={handleGenerateReteach}
                    disabled={isGeneratingPlan || selectedTroubleSpots.size === 0}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm"
                  >
                    {isGeneratingPlan ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
                    Reteach Plan
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {troubleSpots.map((ts, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedTroubleSpots(prev => {
                        const next = new Set(prev);
                        if (next.has(ts.criterion)) next.delete(ts.criterion);
                        else next.add(ts.criterion);
                        return next;
                      });
                    }}
                    className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedTroubleSpots.has(ts.criterion) ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-100"}`}
                  >
                    <input type="checkbox" checked={selectedTroubleSpots.has(ts.criterion)} onChange={() => {}} className="mt-1 h-3.5 w-3.5 text-indigo-600 rounded cursor-pointer" />
                    <div className="flex-grow min-w-0">
                      <p className="text-xs font-semibold text-gray-900">{ts.criterion}</p>
                      <p className="text-[10px] text-gray-500">{ts.avgScore} ({ts.pctStruggling}% struggled)</p>
                    </div>
                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${ts.avgPct < 60 ? "bg-red-100 text-red-700" : ts.avgPct < 80 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {ts.avgPct.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Reteach Plan */}
          {reteachPlan && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-md font-bold text-indigo-900 flex items-center gap-2">
                  <Lightbulb size={18} className="text-indigo-600" />
                  Reteach Plan
                </h2>
                {reteachCost > 0 && <span className="text-[10px] font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">${reteachCost.toFixed(4)}</span>}
              </div>
              <div className="prose prose-sm max-w-none text-indigo-900 text-xs">
                {reteachPlan.split("\n").map((line, i) => {
                  if (line.startsWith("# ")) return <h2 key={i} className="text-sm font-bold mt-3 mb-1">{line.replace("# ", "")}</h2>;
                  if (line.startsWith("## ")) return <h3 key={i} className="text-xs font-bold mt-2 mb-1">{line.replace("## ", "")}</h3>;
                  if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold mt-1.5">{line.replace(/\*\*/g, "")}</p>;
                  if (line.startsWith("- ")) return <li key={i} className="ml-3 list-disc">{line.replace("- ", "")}</li>;
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="mb-1">{line}</p>;
                })}
              </div>
            </div>
          )}

          {/* What Students Know */}
          {strengths.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                What Students Know
              </h2>
              <div className="space-y-2">
                {strengths.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <TrendingUp size={14} className="text-emerald-600 shrink-0" />
                    <div className="flex-grow min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{s.criterion}</p>
                    </div>
                    <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                      {s.avgPct.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Struggling Students */}
          {strugglingStudents.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Users size={18} className="text-orange-500" />
                Struggling ({strugglingStudents.length})
              </h2>
              <div className="space-y-2">
                {strugglingStudents.map(s => {
                  const scoreNum = parseFloat(s.score?.split("/")[0] || "0");
                  return (
                    <div key={s.id} className="flex items-center justify-between text-xs p-2 hover:bg-gray-50 border border-transparent hover:border-gray-100 rounded-md">
                      <div className="font-medium text-gray-900">{s.student_name}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getScoreColor(scoreNum)}`}>
                        {s.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity" 
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-gray-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200" style={{ transform: 'translateX(0)' }}>
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 text-indigo-900">
            <BarChart3 size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold">Analytics</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {content}
        </div>
      </div>
    </>
  );
};
