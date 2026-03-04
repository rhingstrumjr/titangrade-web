import React from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';

interface Question {
  questionNumber: string;
  questionText: string;
  questionType: "multiple_choice" | "short_answer" | "essay" | "fill_in_blank";
  suggestedAnswer: string;
  keyConcepts?: string[];
}

interface AnswerKey {
  questions: Question[];
}

interface AnswerKeyEditorProps {
  answerKey: AnswerKey;
  onChange: (key: AnswerKey) => void;
}

export function AnswerKeyEditor({ answerKey, onChange }: AnswerKeyEditorProps) {
  const handleQuestionChange = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...answerKey.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    onChange({ questions: newQuestions });
  };

  const handleConceptsChange = (index: number, text: string) => {
    const concepts = text.split(',').map(s => s.trim()).filter(Boolean);
    handleQuestionChange(index, 'keyConcepts', concepts);
  };

  const addQuestion = () => {
    onChange({
      questions: [
        ...answerKey.questions,
        { questionNumber: '', questionText: '', questionType: 'short_answer', suggestedAnswer: '' }
      ]
    });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = [...answerKey.questions];
    newQuestions.splice(index, 1);
    onChange({ questions: newQuestions });
  };

  if (!answerKey || !answerKey.questions) return null;

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-indigo-200 bg-white p-4">
      <h3 className="font-semibold text-indigo-900 border-b pb-2">Review Generated Answer Key</h3>
      <p className="text-sm text-gray-500 mb-4">You can edit the AI-generated answers below before saving.</p>

      {answerKey.questions.map((q, idx) => (
        <div key={idx} className="p-4 bg-gray-50 rounded-md border border-gray-200 relative group">
          <button
            type="button"
            onClick={() => removeQuestion(idx)}
            className="absolute top-2 right-2 text-gray-400 hover:text-red-600 hidden group-hover:block"
          >
            <Trash2 size={16} />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Q. Number</label>
              <input
                value={q.questionNumber || ''}
                onChange={(e) => handleQuestionChange(idx, 'questionNumber', e.target.value)}
                className="w-full text-sm border-gray-300 rounded p-1 mt-1 text-black bg-white focus:ring-1"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700">Question Text</label>
              <input
                value={q.questionText || ''}
                onChange={(e) => handleQuestionChange(idx, 'questionText', e.target.value)}
                className="w-full text-sm border-gray-300 rounded p-1 mt-1 text-black bg-white focus:ring-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Type</label>
              <select
                value={q.questionType || 'short_answer'}
                onChange={(e) => handleQuestionChange(idx, 'questionType', e.target.value)}
                className="w-full text-sm border-gray-300 rounded p-1 mt-1 text-black bg-white focus:ring-1"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="short_answer">Short Answer</option>
                <option value="essay">Essay</option>
                <option value="fill_in_blank">Fill in Blank</option>
              </select>
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-xs font-semibold text-emerald-800">Correct Answer / Exemplar</label>
            <textarea
              value={q.suggestedAnswer || ''}
              onChange={(e) => handleQuestionChange(idx, 'suggestedAnswer', e.target.value)}
              rows={2}
              className="w-full text-sm border-emerald-300 rounded p-1 mt-1 text-black bg-emerald-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {(q.questionType === 'short_answer' || q.questionType === 'essay') && (
            <div>
              <label className="block text-xs font-semibold text-indigo-800">Key Concepts (comma separated)</label>
              <input
                value={(q.keyConcepts || []).join(', ')}
                onChange={(e) => handleConceptsChange(idx, e.target.value)}
                placeholder="e.g. mitochondria, energy, ATP"
                className="w-full text-sm border-indigo-200 rounded p-1 mt-1 text-black bg-indigo-50 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addQuestion}
        className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-2"
      >
        <PlusCircle size={16} className="mr-1" /> Add Question manually
      </button>
    </div>
  );
}
