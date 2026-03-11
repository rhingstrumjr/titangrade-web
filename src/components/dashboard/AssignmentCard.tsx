import React from "react";
import Link from "next/link";
import { Users, Trash2, Link as LinkIcon, Loader2, Copy } from "lucide-react";
import type { Assignment } from "@/types/dashboard";

interface AssignmentCardProps {
  assignment: Assignment;
  isDuplicating: boolean;
  isDeleting: boolean;
  googleConnected: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({
  assignment,
  isDuplicating,
  isDeleting,
  googleConnected,
  onDuplicate,
  onDelete,
  onPublish
}) => {
  const copyToClipboard = async (id: string) => {
    try {
      const url = `${window.location.origin}/assignment/${id}`;
      await navigator.clipboard.writeText(url);
      alert("Student submission link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy text: ", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = `${window.location.origin}/assignment/${id}`;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert("Student submission link copied to clipboard!");
      } catch (err) {
        console.error("Fallback copy failed", err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <Link href={`/teacher/assignments/${assignment.id}`} className="text-lg font-bold text-gray-900 truncate pr-2 hover:text-indigo-700 hover:underline transition-colors cursor-pointer" title={assignment.title}>
            {assignment.title}
          </Link>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.preventDefault();
                onDuplicate(assignment.id);
              }}
              disabled={isDuplicating}
              className="text-gray-400 hover:text-emerald-600 transition-colors p-1.5 rounded-md hover:bg-emerald-50 focus:outline-none flex-shrink-0"
              title="Duplicate Assignment"
            >
              {isDuplicating ? (
                <Loader2 className="animate-spin h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete(assignment.id);
              }}
              disabled={isDeleting}
              className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50 focus:outline-none flex-shrink-0"
              title="Delete Assignment"
            >
              {isDeleting ? (
                <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center text-sm text-gray-500 mb-4 mt-2">
          <span className="font-medium text-indigo-100 bg-indigo-600 px-2 py-0.5 rounded mr-2">
            {assignment.grading_framework === 'marzano' ? 'Marzano (4.0)' : `${assignment.max_score} pts`}
          </span>
          <span>Created {new Date(assignment.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-gray-600 line-clamp-3 mb-4">
          {assignment.rubric}
        </p>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-between items-center">
        <Link href={`/teacher/assignments/${assignment.id}`} className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
          <Users size={16} className="mr-1.5" />
          View Submissions
        </Link>
        <div className="flex items-center gap-2">
          {!assignment.gc_coursework_id && googleConnected && (
            <button
              onClick={() => onPublish(assignment.id)}
              className="flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-800 border border-emerald-300 rounded hover:bg-emerald-50 px-2 py-1 transition-colors bg-white shadow-sm"
              title="Publish to Google Classroom"
            >
              <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Publish
            </button>
          )}
          <button
            onClick={() => copyToClipboard(assignment.id)}
            className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-100 px-2 py-1 transition-colors bg-white shadow-sm"
            title="Copy Student Submission Link"
          >
            <LinkIcon size={14} className="mr-1.5" />
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
};
