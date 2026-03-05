export interface RubricLevel {
  label: string;       // e.g. "Excellent", "Proficient", "Developing", "Beginning"
  points: number;      // e.g. 10, 7, 4, 1
  description: string; // what this level looks like
}

export interface RubricCriterion {
  name: string;
  maxPoints: number;
  description: string;          // full-credit description (backward compat)
  levels?: RubricLevel[];       // optional multi-level breakdown
}

export interface CategoryScore {
  category: string;
  earned: number;
  possible: number;
}

export interface SkillAssessment {
  level: string;
  dimension: string;
  skill: string;
  status: string;
}

export interface Submission {
  id: string;
  student_name: string;
  student_email: string;
  file_url: string;
  score: string | null;
  feedback: string | null;
  status: string;
  is_exemplar: boolean;
  manually_edited: boolean;
  email_sent: boolean;
  pre_regrade_score: string | null;
  pre_regrade_feedback: string | null;
  category_scores: CategoryScore[] | null;
  skill_assessments: SkillAssessment[] | null;
  ai_cost?: number;
  gc_submission_id?: string;
  created_at: string;
}

export interface StudentGroup {
  email: string;
  name: string;
  submissions: Submission[];
  latestStatus: string;
  latestScore: string | null;
}
