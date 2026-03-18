import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Class } from "@/types/dashboard";

interface CreateAssignmentModalProps {
  classes: Class[];
  initialClassId: string | null;
  onClose: () => void;
  onCreate: (title: string, classIds: string[], assessmentType: 'formative' | 'summative') => Promise<void>;
}

export const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({
  classes,
  initialClassId,
  onClose,
  onCreate,
}) => {
  const [newTitle, setNewTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState<'formative' | 'summative'>('summative');
  const [selectedClassesForNewAssignment, setSelectedClassesForNewAssignment] = useState<string[]>(
    initialClassId ? [initialClassId] : []
  );
  const [createLoading, setCreateLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    setCreateLoading(true);
    await onCreate(newTitle, selectedClassesForNewAssignment, assessmentType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Assignment</h3>
        
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Assignment Title *</label>
            <input
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. History Essay Draft 1"
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Assessment Type Toggle */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Assessment Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssessmentType('summative')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border font-medium transition-all ${
                  assessmentType === 'summative'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-200'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="font-semibold">Summative</div>
                <div className="text-xs mt-0.5 opacity-75">Counts toward mastery</div>
              </button>
              <button
                type="button"
                onClick={() => setAssessmentType('formative')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border font-medium transition-all ${
                  assessmentType === 'formative'
                    ? 'bg-amber-50 border-amber-300 text-amber-700 ring-1 ring-amber-200'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="font-semibold">Formative</div>
                <div className="text-xs mt-0.5 opacity-75">Practice / check-in</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Assign to Classes</label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
              {classes.filter(c => !c.is_archived).map(cls => (
                <label key={cls.id} className="flex items-center space-x-2 text-sm bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClassesForNewAssignment.includes(cls.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedClassesForNewAssignment([...selectedClassesForNewAssignment, cls.id]);
                      } else {
                        setSelectedClassesForNewAssignment(selectedClassesForNewAssignment.filter(id => id !== cls.id));
                      }
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                  />
                  <span className="font-medium text-gray-700 select-none">{cls.name}</span>
                </label>
              ))}
              {classes.filter(c => !c.is_archived).length === 0 && (
                <span className="text-sm text-gray-500 italic">No active classes found. You can still assign it later!</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Note: You can add rubrics, set max attempts, and upload exemplars on the next screen.
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={createLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading || !newTitle.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-indigo-400 text-white px-6 py-2 rounded font-medium transition-all flex items-center shadow-sm"
            >
              {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {createLoading ? "Creating..." : "Create & Edit Setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
