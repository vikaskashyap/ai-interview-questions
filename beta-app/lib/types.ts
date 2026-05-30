export type Severity = "high" | "clarification" | "strong";

export type Category =
  | "Skill Validation"
  | "Behavioral"
  | "Leadership"
  | "Problem Solving"
  | "Career Transition"
  | "Ownership Validation"
  | "Follow-up";

export interface Question {
  category: Category | string;
  severity: Severity;
  question: string;
  why_it_matters: string;
  risk: string;
  model_answer: string;
  red_flags: string;
}

export interface GenerationResult {
  risk_areas: string[];
  questions: Question[];
  source: "gemini" | "demo";
  latency_ms: number;
  generation_id: string;
}

export interface GenerateRequest {
  resume_text: string;
  job_description?: string;
}
