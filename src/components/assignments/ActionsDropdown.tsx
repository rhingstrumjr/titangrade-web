"use client";
import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal, RefreshCw, Download, BarChart3, Send as SendIcon } from "lucide-react";
import Link from "next/link";

interface ActionsDropdownProps {
  assignmentId: string;
  onRegrade: () => void;
  regrading: boolean;
  selectedRegradeCount: number;
  onSyncFromClassroom?: () => void;
  syncingFromGc?: boolean;
  onPushGradesToGc?: () => void;
  syncingToGc?: boolean;
  onDownloadCSV: () => void;
  hasStudents: boolean;
  isGcLinked: boolean;
  isGradingGc?: boolean;
}

export function ActionsDropdown({
  assignmentId, onRegrade, regrading, selectedRegradeCount,
  onSyncFromClassroom, syncingFromGc, onPushGradesToGc, syncingToGc,
  onDownloadCSV, hasStudents, isGcLinked, isGradingGc
}: ActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
      >
        <MoreHorizontal size={16} /> Actions
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => { onRegrade(); setOpen(false); }}
            disabled={regrading || selectedRegradeCount === 0}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 text-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw size={14} />
            {regrading ? "Regrading..." : `Regrade (${selectedRegradeCount} selected)`}
          </button>
          {isGcLinked && onSyncFromClassroom && (
            <button
              onClick={() => { onSyncFromClassroom(); setOpen(false); }}
              disabled={syncingFromGc || isGradingGc}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 text-blue-700 disabled:opacity-40 flex items-center gap-2"
            >
              <RefreshCw size={14} />
              {syncingFromGc ? "Syncing..." : "Sync from Classroom"}
            </button>
          )}
          {isGcLinked && hasStudents && onPushGradesToGc && (
            <button
              onClick={() => { onPushGradesToGc(); setOpen(false); }}
              disabled={syncingToGc || isGradingGc}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 text-indigo-700 disabled:opacity-40 flex items-center gap-2"
            >
              <SendIcon size={14} />
              {syncingToGc ? "Pushing..." : "Push Grades to Classroom"}
            </button>
          )}
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => { onDownloadCSV(); setOpen(false); }}
            disabled={!hasStudents}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 disabled:opacity-40 flex items-center gap-2"
          >
            <Download size={14} /> Export CSV
          </button>
          <Link
            href={`/teacher/analytics/${assignmentId}`}
            className="block px-4 py-2.5 text-sm hover:bg-emerald-50 text-emerald-700 flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <BarChart3 size={14} /> Analytics
          </Link>
        </div>
      )}
    </div>
  );
}
