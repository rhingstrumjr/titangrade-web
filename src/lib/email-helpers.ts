import { CategoryScore, SkillAssessment } from './grading';

/**
 * Generates an HTML table for per-category score breakdown (Standard mode).
 * Shows each rubric criterion with earned/possible points and a colored progress bar.
 */
export function buildCategoryScoresHtml(categoryScores: CategoryScore[]): string {
  if (!categoryScores || categoryScores.length === 0) return '';

  const rows = categoryScores.map(cs => {
    const pct = cs.possible > 0 ? Math.round((cs.earned / cs.possible) * 100) : 0;
    const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
    const bgColor = pct >= 80 ? '#ecfdf5' : pct >= 60 ? '#fffbeb' : '#fef2f2';

    return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">${cs.category}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; font-size: 14px; color: #111827;">${cs.earned} / ${cs.possible}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; width: 120px;">
          <div style="background-color: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
            <div style="background-color: ${color}; height: 100%; width: ${pct}%; border-radius: 9999px;"></div>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="margin-top: 16px;">
      <h4 style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Score Breakdown</h4>
      <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Criterion</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Score</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;"></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

/**
 * Generates an HTML table for per-skill assessment (Marzano mode).
 * Groups skills by proficiency level with status icons.
 */
export function buildSkillAssessmentsHtml(skillAssessments: SkillAssessment[]): string {
  if (!skillAssessments || skillAssessments.length === 0) return '';

  const statusIcon: Record<string, string> = {
    'demonstrated': '✅',
    'partial': '⚠️',
    'not_demonstrated': '❌',
    'not_assessed': '⬜',
  };

  const statusLabel: Record<string, string> = {
    'demonstrated': 'Demonstrated',
    'partial': 'Partial',
    'not_demonstrated': 'Not Demonstrated',
    'not_assessed': 'Not Assessed',
  };

  const statusColor: Record<string, string> = {
    'demonstrated': '#059669',
    'partial': '#d97706',
    'not_demonstrated': '#dc2626',
    'not_assessed': '#9ca3af',
  };

  // Group by level
  const levels = ['2.0', '3.0', '4.0'];
  const levelLabels: Record<string, string> = {
    '2.0': '2.0 — Foundational',
    '3.0': '3.0 — Target',
    '4.0': '4.0 — Transfer',
  };

  const rows = levels.map(level => {
    const skills = skillAssessments.filter(sa => sa.level === level);
    if (skills.length === 0) return '';

    const header = `
      <tr>
        <td colspan="3" style="padding: 10px 12px 6px; background-color: #eef2ff; font-weight: 700; font-size: 13px; color: #4338ca; border-bottom: 1px solid #c7d2fe;">
          ${levelLabels[level] || `Level ${level}`}
        </td>
      </tr>`;

    const skillRows = skills.map(sa => `
      <tr>
        <td style="padding: 6px 12px 6px 24px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; white-space: nowrap;">${sa.dimension}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151;">${sa.skill}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #f3f4f6; text-align: center; font-size: 13px; color: ${statusColor[sa.status] || '#6b7280'}; white-space: nowrap;">
          ${statusIcon[sa.status] || ''} ${statusLabel[sa.status] || sa.status}
        </td>
      </tr>`).join('');

    return header + skillRows;
  }).join('');

  return `
    <div style="margin-top: 16px;">
      <h4 style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Skill Assessment</h4>
      <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Dimension</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Skill</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

/**
 * Generates the appropriate breakdown HTML based on available data.
 */
export function buildBreakdownHtml(categoryScores?: CategoryScore[], skillAssessments?: SkillAssessment[]): string {
  if (skillAssessments && skillAssessments.length > 0) {
    return buildSkillAssessmentsHtml(skillAssessments);
  }
  if (categoryScores && categoryScores.length > 0) {
    return buildCategoryScoresHtml(categoryScores);
  }
  return '';
}
