import React, { useEffect, useState } from "react";
import { X, Save, Star, Loader2, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { CategoryBreakdown } from "@/components/submissions/CategoryBreakdown";
import { createClient } from "@/utils/supabase/client";
import type { SubmissionScore } from "@/types/standards";

const supabase = createClient();

interface GradebookCellModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  submission: any | null;
  assignment: any | null;
  studentName: string;
  onSave: (score: string, feedback: string) => Promise<void>;
  onToggleExemplar: () => Promise<void>;
}

export const GradebookCellModal: React.FC<GradebookCellModalProps> = ({
  isOpen,
  onClose,
  anchorRect,
  submission,
  assignment,
  studentName,
  onSave,
  onToggleExemplar
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const [editScore, setEditScore] = useState("");
  const [editFeedback, setEditFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Normalized scores state
  const [normalizedScores, setNormalizedScores] = useState<SubmissionScore[]>([]);
  const [editNormalizedScores, setEditNormalizedScores] = useState<SubmissionScore[]>([]);
  const [isLoadingScores, setIsLoadingScores] = useState(false);

  useEffect(() => {
    if (isOpen && anchorRect) {
      setShouldRender(true);
      setEditScore(submission?.score || "");
      setEditFeedback(submission?.feedback || "");
      const timer = setTimeout(() => setIsExpanded(true), 10);

      // Fetch normalized scores
      if (submission?.id) {
        setIsLoadingScores(true);
        supabase
          .from("submission_scores")
          .select("*, learning_target:learning_targets(*)")
          .eq("submission_id", submission.id)
          .then(({ data }) => {
            const scores = (data || []) as SubmissionScore[];
            setNormalizedScores(scores);
            setEditNormalizedScores(scores.map(s => ({ ...s })));
            setIsLoadingScores(false);
          });
      }

      return () => clearTimeout(timer);
    } else {
      setIsExpanded(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, anchorRect, submission]);

  const handleSave = async () => {
    setIsSaving(true);

    // Save teacher overrides to submission_scores
    if (editNormalizedScores.length > 0) {
      for (const sc of editNormalizedScores) {
        const original = normalizedScores.find(o => o.id === sc.id);
        if (original && sc.teacher_override_score !== original.teacher_override_score) {
          await supabase
            .from("submission_scores")
            .update({ teacher_override_score: sc.teacher_override_score })
            .eq("id", sc.id);
        }
      }
    }

    await onSave(editScore, editFeedback);
    setIsSaving(false);
    onClose();
  };

  if (!shouldRender || !anchorRect) return null;

  const expandedWidth = 450;
  const expandedHeight = 500;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  
  const expandedLeft = Math.max(20, (viewportWidth - expandedWidth) / 2);
  const expandedTop = Math.max(20, (viewportHeight - expandedHeight) / 2);

  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 1000,
    top: isExpanded ? `${expandedTop}px` : `${anchorRect.top}px`,
    left: isExpanded ? `${expandedLeft}px` : `${anchorRect.left}px`,
    width: isExpanded ? `${expandedWidth}px` : `${anchorRect.width}px`,
    height: isExpanded ? `${expandedHeight}px` : `${anchorRect.height}px`,
    opacity: isExpanded ? 1 : 0,
    transform: isExpanded ? 'scale(1)' : 'scale(0.95)',
    transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
    overflow: isExpanded ? "auto" : "hidden",
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-gray-900/20 z-[990] backdrop-blur-sm transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div 
        style={style} 
        className="bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {isExpanded && submission && assignment && (
          <div className="flex flex-col h-full animate-in fade-in duration-300 delay-100">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 leading-tight">{studentName}</h3>
                <p className="text-xs text-gray-500 font-medium truncate max-w-[300px]">{assignment.title}</p>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex-grow overflow-y-auto space-y-4">
              
              {/* Top Row: Score & Status */}
              <div className="flex items-center justify-between bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                <div className="flex flex-col">
                  <label className="text-xs uppercase font-bold tracking-wider text-indigo-900/70 mb-1">Score</label>
                  <input 
                    type="text" 
                    value={editScore} 
                    onChange={(e) => setEditScore(e.target.value)}
                    className="w-24 border border-indigo-200 rounded-lg px-3 py-1.5 text-lg font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none placeholder:text-gray-300"
                    placeholder="e.g. 85/100"
                  />
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {submission.status === 'graded' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800">
                      <CheckCircle2 size={12} className="mr-1" /> Graded
                    </span>
                  ) : submission.status === 'pending' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                      <Clock size={12} className="mr-1" /> Pending
                    </span>
                  ) : submission.status === 'error' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
                      <AlertCircle size={12} className="mr-1" /> Error
                    </span>
                  ) : null}

                  <button 
                    onClick={onToggleExemplar}
                    className={`flex items-center justify-center gap-1.5 transition-colors border px-2.5 py-1 rounded-md font-semibold text-[10px] uppercase tracking-wider ${submission.is_exemplar ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-amber-600"}`}
                  >
                    <Star size={12} className={submission.is_exemplar ? "fill-amber-500 text-amber-500" : ""} />
                    {submission.is_exemplar ? "Unmark Exemplar" : "Mark Exemplar"}
                  </button>
                </div>
              </div>

              {/* View Document */}
              {submission.file_url && !submission.file_url.startsWith('drive:') && (
                <a href={submission.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full text-indigo-600 hover:text-indigo-800 transition-colors bg-white border border-indigo-200 hover:bg-indigo-50 py-2.5 rounded-xl font-semibold text-sm shadow-sm">
                  <FileText size={16} /> Open Document
                </a>
              )}

              {/* Feedback Editor */}
              <div className="flex flex-col pt-2">
                <label className="text-xs uppercase font-bold tracking-wider text-gray-500 mb-2">Feedback Details</label>
                <textarea 
                  value={editFeedback} 
                  onChange={(e) => setEditFeedback(e.target.value)} 
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none resize-none shadow-inner"
                  placeholder="Leave personalized feedback for the student..."
                />
              </div>
              
              {/* Category Breakdown — normalized + legacy fallback */}
              {isLoadingScores ? (
                <div className="flex items-center justify-center py-4 text-gray-400 text-xs">
                  <Loader2 size={12} className="animate-spin mr-1" /> Loading scores...
                </div>
              ) : (
                <CategoryBreakdown
                  sub={submission}
                  normalizedScores={normalizedScores}
                  isEditing={true}
                  editNormalizedScores={editNormalizedScores}
                  setEditNormalizedScores={setEditNormalizedScores}
                />
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl flex justify-end gap-3 shrink-0">
              <button 
                onClick={onClose} 
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Changes
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
};
