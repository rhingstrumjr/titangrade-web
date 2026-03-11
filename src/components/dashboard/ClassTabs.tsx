import React, { useState } from "react";
import { Users, PlusCircle, Archive, Loader2, Table } from "lucide-react";
import type { Class, Assignment } from "@/types/dashboard";

interface ClassTabsProps {
  classes: Class[];
  activeClasses: Class[];
  selectedClassId: string | null;
  assignments: Assignment[]; // Used to calculate counts
  showArchivedClasses: boolean;
  googleConnected: boolean;
  isSyncingClasses: boolean;
  onSelectClass: (id: string | null) => void;
  onToggleArchived: (val: boolean) => void;
  onManageRoster: (classId: string) => void;
  onCreateClass: (name: string) => Promise<void>;
  onSyncGoogleClasses: () => void;
}

export const ClassTabs: React.FC<ClassTabsProps> = ({
  classes,
  activeClasses,
  selectedClassId,
  assignments,
  showArchivedClasses,
  googleConnected,
  isSyncingClasses,
  onSelectClass,
  onToggleArchived,
  onManageRoster,
  onCreateClass,
  onSyncGoogleClasses,
}) => {
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    await onCreateClass(newClassName);
    setNewClassName("");
    setIsCreatingClass(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center border-b border-gray-200 overflow-x-auto gap-0">
          <button
            onClick={() => onSelectClass(null)}
            className={`px-5 py-3 text-base font-semibold whitespace-nowrap transition-all border-b-2 ${selectedClassId === null ? "border-indigo-600 text-indigo-700 bg-indigo-50/50" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"}`}
          >
            All Classes
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">{assignments.length}</span>
          </button>
          
          {activeClasses.map(cls => {
            const count = assignments.filter(a => a.class_id === cls.id).length;
            return (
              <div key={cls.id} className="flex items-center">
                <button
                  onClick={() => onSelectClass(cls.id)}
                  className={`px-5 py-3 text-base font-semibold whitespace-nowrap transition-all border-b-2 ${selectedClassId === cls.id ? "border-indigo-600 text-indigo-700 bg-indigo-50/50" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"}`}
                >
                  {cls.name}
                  {cls.is_archived && <span title="Archived Class"><Archive size={14} className="inline ml-1.5 text-gray-400" /></span>}
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">{count}</span>
                </button>
                {selectedClassId === cls.id && (
                  <>
                    <button
                      onClick={() => onManageRoster(cls.id)}
                      className="ml-1 p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded-md transition-colors"
                      title="Manage Roster"
                    >
                      <Users size={16} />
                    </button>
                    <a
                      href={`/teacher/gradebook/${cls.id}`}
                      className="ml-1 p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors block"
                      title="Open Gradebook"
                    >
                      <Table size={16} />
                    </a>
                  </>
                )}
              </div>
            );
          })}
          
          <button
            onClick={() => setIsCreatingClass(!isCreatingClass)}
            className="px-4 py-3 text-base font-semibold whitespace-nowrap text-indigo-500 hover:text-indigo-700 border-b-2 border-transparent hover:border-indigo-300 transition-all flex items-center gap-1"
          >
            <PlusCircle size={16} /> Add Class
          </button>
          
          {googleConnected && (
            <button
              onClick={onSyncGoogleClasses}
              disabled={isSyncingClasses}
              className="px-4 py-3 text-base font-semibold whitespace-nowrap text-emerald-500 hover:text-emerald-700 border-b-2 border-transparent hover:border-emerald-300 transition-all flex items-center gap-1 disabled:opacity-50"
              title="Create TitanGrade classes matching your Google Classroom courses"
            >
              {isSyncingClasses ? <Loader2 size={16} className="animate-spin" /> : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Sync Google Classes
            </button>
          )}
        </div>
        
        {classes.some(c => c.is_archived) && (
          <label className="flex items-center cursor-pointer ml-auto mr-2 shrink-0">
            <input
              type="checkbox"
              checked={showArchivedClasses}
              onChange={(e) => onToggleArchived(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            <span className="ms-2 text-sm font-medium text-gray-600">Show Archived</span>
          </label>
        )}
      </div>

      {isCreatingClass && (
        <div className="bg-white p-4 border border-gray-200 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
          <input
            type="text"
            autoFocus
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="e.g. Period 1 Biology"
            className="flex-grow border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate(e as unknown as React.FormEvent)}
          />
          <button onClick={handleCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors">Save</button>
          <button onClick={() => setIsCreatingClass(false)} className="text-gray-500 hover:text-gray-700 text-sm font-medium">Cancel</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {selectedClassId ? classes.find(c => c.id === selectedClassId)?.name : "All Assignments"}
        </h2>
      </div>
    </div>
  );
};
