import React from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface RegradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegrade: () => void;
  regrading: boolean;
  selectedCount: number;
  exemplarCount: number;
  regradeEligibleCount: number;
  onSelectLatest: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function RegradeModal({
  isOpen,
  onClose,
  onRegrade,
  regrading,
  selectedCount,
  exemplarCount,
  regradeEligibleCount,
  onSelectLatest,
  onSelectAll,
  onClearSelection
}: RegradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
            <RefreshCw size={20} className="text-purple-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Regrade with Exemplars</h3>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-600">
            The AI will re-grade <strong>{selectedCount} submission{selectedCount !== 1 ? 's' : ''}</strong> using
            {' '}<strong>{exemplarCount} exemplar{exemplarCount !== 1 ? 's' : ''}</strong> as calibration data.
          </p>

          {/* Selection controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Select:</span>
            <button
              onClick={onSelectLatest}
              className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200 transition-colors"
            >
              Latest Only
            </button>
            <button
              onClick={onSelectAll}
              className="text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 transition-colors"
            >
              All Eligible ({regradeEligibleCount})
            </button>
            <button
              onClick={onClearSelection}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2.5 py-1 transition-colors"
            >
              Clear
            </button>
          </div>

          {exemplarCount === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>⚠️ No exemplars marked.</strong> The AI will use the rubric only (same as initial grading). Star some graded submissions first for better calibration.
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 space-y-1">
            <p>✅ Exemplar submissions will <strong>not</strong> be regraded</p>
            <p>✅ Manually edited grades will <strong>not</strong> be changed</p>
            <p>✅ Already-emailed students will receive an <strong>updated grade</strong> email</p>
            <p>✅ Submission limits are <strong>not</strong> affected</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onRegrade}
            disabled={selectedCount === 0 || regrading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {regrading ? <Loader2 size={16} className="animate-spin" /> : null}
            {regrading ? 'Regrading...' : `Regrade ${selectedCount} Submission${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
