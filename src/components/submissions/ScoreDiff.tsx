import React from "react";

interface ScoreDiffProps {
  oldScore: string;
  newScore: string;
}

export function ScoreDiff({ oldScore, newScore }: ScoreDiffProps) {
  const parseNum = (s: string) => {
    const match = s.match(/^([\d.]+)/);
    return match ? parseFloat(match[1]) : null;
  };
  const oldNum = parseNum(oldScore);
  const newNum = parseNum(newScore);

  let color = 'text-gray-500 bg-gray-50 border-gray-200';
  let arrow = '→';

  if (oldNum !== null && newNum !== null) {
    if (newNum > oldNum) {
      color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      arrow = '↑';
    } else if (newNum < oldNum) {
      color = 'text-red-700 bg-red-50 border-red-200';
      arrow = '↓';
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {oldScore} {arrow} {newScore}
    </span>
  );
}
