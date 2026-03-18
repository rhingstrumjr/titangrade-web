export interface Standard {
  id: string;
  teacher_id: string;
  code: string;
  description: string;
  dimension?: string | null;
  created_at?: string;
  learning_targets?: LearningTarget[];
}

export interface LearningTarget {
  id: string;
  standard_id: string;
  level: '2.0' | '3.0' | '4.0';
  description: string;
  created_at?: string;
  standard?: Standard;
}

export interface AssignmentTarget {
  id: string;
  assignment_id: string;
  learning_target_id: string;
  ai_prompting_notes?: string | null;
  learning_target?: LearningTarget;
}

export interface SubmissionScore {
  id: string;
  submission_id: string;
  learning_target_id?: string | null;
  category_name?: string | null;
  ai_score: number;
  ai_possible?: number | null;
  teacher_override_score?: number | null;
  created_at?: string;
  learning_target?: LearningTarget;
}

export interface InterventionEntry {
  id: string;
  learning_target_id: string;
  teacher_id?: string;
  resource_url?: string | null;
  description: string;
  created_at?: string;
  learning_target?: LearningTarget;
}

export interface TeacherProfile {
  id: string;
  default_framework: 'standard' | 'marzano';
  default_tone: string;
  created_at?: string;
}
