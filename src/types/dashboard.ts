import type { RubricCriterion } from "./submission";

export interface Class {
  id: string;
  name: string;
  created_at: string;
  gc_course_id?: string | null;
  is_archived?: boolean;
}

export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  class_id: string;
}

export interface Assignment {
  id: string;
  title: string;
  max_score: number;
  description?: string;
  feedback_release_mode?: "immediate" | "manual";
  rubric: string;
  rubrics?: string[];
  exemplar_url?: string;
  exemplar_urls?: string[];
  grading_framework: "standard" | "marzano";
  max_attempts: number;
  is_socratic: boolean;
  auto_send_emails: boolean;
  class_id?: string | null;
  gc_course_id?: string | null;
  gc_coursework_id?: string | null;
  generated_key?: any;
  structured_rubric?: RubricCriterion[];
  ai_cost?: number;
  created_at: string;
}
