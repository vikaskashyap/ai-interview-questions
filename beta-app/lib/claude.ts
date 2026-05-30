import Anthropic from "@anthropic-ai/sdk";
import type { Question } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

function buildPrompt(resume: string, jd?: string): string {
  return `You are a senior interviewer with 15+ years of hiring experience. Analyze this candidate resume carefully and prepare a realistic, ready-to-use interview.

Identify weak evidence areas, missing metrics, leadership ambiguity, career risks, overclaimed skills, frequent job switches, and skill claims needing validation.

CRITICAL — questions must NOT be generic. Every question must quote or reference a SPECIFIC item from the resume (an exact company name, project, tool, title, date range, or number). A question that could be asked of any candidate is a failure. Phrase them the way a real interviewer speaks out loud.

For EVERY question also provide "model_answer": a 2-4 sentence description of what a strong, credible answer would actually contain — the specific evidence, structure (e.g. STAR), metrics, or reasoning a good candidate would give. This is the interviewer's cheat-sheet for judging the response, not a script for the candidate. Also provide "red_flags": one short line on what a weak/evasive answer sounds like.

Categorize each question as one of: "Skill Validation", "Behavioral", "Leadership", "Problem Solving", "Career Transition", "Ownership Validation", "Follow-up".
Classify severity as one of: "high" (red flag to probe), "clarification" (needs detail), "strong" (validate a real strength).

${jd ? "JOB DESCRIPTION:\n" + jd + "\n\n" : ""}RESUME:\n${resume}

Respond ONLY with valid JSON in exactly this shape, no markdown, no prose before or after:
{
 "risk_areas": ["short phrase", ...],
 "questions": [
   {"category":"Skill Validation","severity":"high","question":"...","why_it_matters":"...","risk":"...","model_answer":"...","red_flags":"..."}
 ]
}`;
}

function extractJson(text: string): any {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function coerce(raw: any): { risk_areas: string[]; questions: Question[] } {
  const valid: Question["severity"][] = ["high", "clarification", "strong"];
  const questions: Question[] = (Array.isArray(raw?.questions) ? raw.questions : [])
    .filter((q: any) => q && typeof q.question === "string")
    .map((q: any) => ({
      category: String(q.category || "Question"),
      severity: valid.includes(q.severity) ? q.severity : "clarification",
      question: String(q.question),
      why_it_matters: String(q.why_it_matters || "—"),
      risk: String(q.risk || "—"),
      model_answer: String(q.model_answer || "—"),
      red_flags: String(q.red_flags || "—"),
    }));
  if (!questions.length) throw new Error("Claude returned no usable questions");
  return {
    risk_areas: Array.isArray(raw?.risk_areas) ? raw.risk_areas.map(String) : [],
    questions,
  };
}

/** Calls Claude with one retry on transient failure. Throws on hard failure. */
export async function generateWithClaude(
  resume: string,
  jd: string | undefined,
  apiKey: string
): Promise<{ risk_areas: string[]; questions: Question[] }> {
  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(resume, jd);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 3500,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content
        .map((b: any) => (b.type === "text" ? b.text : ""))
        .join("");
      return coerce(extractJson(text));
    } catch (e) {
      lastErr = e;
      // brief backoff before retry
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Claude generation failed");
}
