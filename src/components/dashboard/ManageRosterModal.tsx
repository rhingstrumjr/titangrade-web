import React, { useState, useEffect } from "react";
import { Trash2, Archive, ArchiveRestore } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Class, RosterStudent } from "@/types/dashboard";

interface ManageRosterModalProps {
  cls: Class;
  onClose: () => void;
  onArchiveClass: (archive: boolean) => Promise<void>;
  onDeleteClass: () => Promise<void>;
}

export const ManageRosterModal: React.FC<ManageRosterModalProps> = ({
  cls,
  onClose,
  onArchiveClass,
  onDeleteClass,
}) => {
  const supabase = createClient();
  const [classRoster, setClassRoster] = useState<RosterStudent[]>([]);
  const [rosterText, setRosterText] = useState("");
  const [singleStudentName, setSingleStudentName] = useState("");
  const [singleStudentEmail, setSingleStudentEmail] = useState("");
  const [savingRoster, setSavingRoster] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRoster();
  }, [cls.id]);

  const fetchRoster = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('roster_students')
      .select('*')
      .eq('class_id', cls.id)
      .order('name');
    if (!error && data) {
      setClassRoster(data);
    }
    setIsLoading(false);
  };

  const handleSaveRoster = async () => {
    setSavingRoster(true);

    // Parse bulk text (Name, Email separated by tab or comma)
    const lines = rosterText.split('\n');
    const newStudents = lines.map(line => {
      const parts = line.split(/[\t,]/).map(p => p.trim());
      if (parts.length >= 2 && parts[1].includes('@')) {
        return {
          class_id: cls.id,
          name: parts[0],
          email: parts[1]
        };
      }
      return null;
    }).filter(s => s !== null);

    if (newStudents.length > 0) {
      const { error } = await supabase
        .from('roster_students')
        .insert(newStudents);

      if (!error) {
        setRosterText("");
        fetchRoster();
      } else {
        alert("Failed to import roster. Check format.");
      }
    }
    setSavingRoster(false);
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to remove this student from the roster?")) return;
    const { error } = await supabase.from('roster_students').delete().eq('id', studentId);
    if (!error) {
      setClassRoster(classRoster.filter(s => s.id !== studentId));
    }
  };

  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStudentName.trim() || !singleStudentEmail.trim() || !singleStudentEmail.includes("@")) return;

    setSavingRoster(true);
    const { error } = await supabase
      .from('roster_students')
      .insert([{
        class_id: cls.id,
        name: singleStudentName.trim(),
        email: singleStudentEmail.trim()
      }]);

    if (!error) {
      setSingleStudentName("");
      setSingleStudentEmail("");
      fetchRoster();
    } else {
      console.error(error);
      alert("Failed to add student. Error: " + error.message);
    }
    setSavingRoster(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
            Class Roster: {cls.name}
            <div className="flex items-center gap-2">
              {cls.is_archived ? (
                <button
                  onClick={() => onArchiveClass(false)}
                  className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 px-2 py-1 rounded flex items-center transition-colors"
                  title="Restore Class to active list"
                >
                  <ArchiveRestore size={12} className="mr-1" /> Restore Class
                </button>
              ) : (
                <button
                  onClick={() => onArchiveClass(true)}
                  className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 px-2 py-1 rounded flex items-center transition-colors"
                  title="Archive Class (hide from active list)"
                >
                  <Archive size={12} className="mr-1" /> Archive Class
                </button>
              )}
              <button
                onClick={onDeleteClass}
                className="text-xs bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-2 py-1 rounded flex items-center transition-colors border border-red-100"
                title="Delete Class completely"
              >
                <Trash2 size={12} className="mr-1" /> Delete
              </button>
            </div>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-6">

          {/* Add Single Student Area */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="font-semibold text-gray-900 mb-3">Add Single Student</h4>
            <form onSubmit={handleAddSingleStudent} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={singleStudentName}
                onChange={(e) => setSingleStudentName(e.target.value)}
                placeholder="Full Name"
                className="flex-grow border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="email"
                required
                value={singleStudentEmail}
                onChange={(e) => setSingleStudentEmail(e.target.value)}
                placeholder="Student Email"
                className="flex-grow border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={savingRoster}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
              >
                Add User
              </button>
            </form>
          </div>

          {/* Add Students Area */}
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <h4 className="font-semibold text-indigo-900 mb-2">Bulk Import Students</h4>
            <p className="text-sm text-indigo-700 mb-3">
              Paste a list of names and emails from your gradebook (spreadsheets/CSV). Ensure the format is <strong>Name, Email</strong> or separated by tabs.
            </p>
            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              placeholder="John Doe, jdoe@school.org&#nJane Smith    jane.smith@school.org"
              className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSaveRoster}
                disabled={savingRoster || !rosterText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {savingRoster ? "Importing..." : "Import Roster"}
              </button>
            </div>
          </div>

          {/* Roster List */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Enrolled Students ({classRoster.length})</h4>
            {isLoading ? (
              <p className="text-sm text-gray-500 animate-pulse">Loading roster...</p>
            ) : classRoster.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No students added to this roster yet.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Email</th>
                      <th className="px-4 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {classRoster.map(s => (
                      <tr key={s.id} className="text-sm">
                        <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-2 text-gray-500">{s.email}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700" title="Remove student">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
