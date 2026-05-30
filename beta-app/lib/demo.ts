import type { Question } from "./types";

/** Offline, rule-based generator. Used when no API key is configured or Claude fails. */
export function demoGenerate(
  resume: string,
  jd?: string
): { risk_areas: string[]; questions: Question[] } {
  const t = resume.toLowerCase();
  const Q: Question[] = [];
  const RA: string[] = [];
  const has = (arr: string[]) => arr.some((w) => t.includes(w));
  const add = (
    category: string,
    severity: Question["severity"],
    question: string,
    why_it_matters: string,
    risk: string,
    model_answer: string,
    red_flags: string
  ) =>
    Q.push({ category, severity, question, why_it_matters, risk, model_answer, red_flags });

  const ent = extractEntities(resume);
  const SK = ent.skills;
  const CO = ent.companies;
  const NUM = ent.numbers;
  const ROLE = ent.role;
  const sk1 = SK[0] || "your core stack";
  const sk2 = SK[1] || SK[0] || "a second tool";
  const co1 = CO[0] || "your most recent company";
  const co2 = CO[1] || "a previous company";
  const roleTxt = ROLE ? `as ${ROLE}` : "in your last role";

  if (
    has(["led", "managed", "headed", "spearheaded", "drove", "owned strategy", "head of", "director", "vp ", "chief", "lead "])
  ) {
    RA.push("Leadership ownership vs. execution");
    add(
      "Leadership",
      "high",
      `At ${co1} you describe leading work ${roleTxt}. Take the single initiative you owned end-to-end — how big was the team, what were the two hardest calls you personally made, and what number moved because of it?`,
      "Separates genuine ownership from participation, and strategy from execution support.",
      "Leadership ambiguity / inflated ownership.",
      `Names a concrete initiative at ${co1}, gives team size and reporting line, describes specific trade-off decisions (not "we aligned"), and ties to a measurable outcome. Uses "I decided" more than "we".`,
      `Speaks only in "we", can't name the decision they owned, or gives no metric.`
    );
    add(
      "Ownership Validation",
      "clarification",
      `Describe a moment ${roleTxt} where you disagreed with a senior stakeholder and your view prevailed. What was the disagreement at ${co1} about?`,
      "Tests real decision authority versus title-only leadership.",
      "Surface-level ownership.",
      "Recalls a specific conflict, the data/argument they used to win it, and the result — showing they had and used real authority.",
      "Vague 'I influenced' answers with no concrete instance or outcome."
    );
  }

  if (NUM.length < 2) {
    RA.push("Missing quantified impact");
    add(
      "Skill Validation",
      "high",
      `Your resume lists responsibilities but very few numbers. Pick your strongest achievement at ${co1} and quantify it for me — revenue, cost saved, time reduced, users, or accuracy gained.`,
      "Resume lacks metrics; forces evidence of measurable, attributable impact.",
      "Unverifiable or exaggerated impact.",
      "Gives a hard before/after figure, explains how it was measured, and isolates their own contribution from the team's.",
      "Rounds to vague 'significant improvement' or can't say how it was measured."
    );
  } else {
    add(
      "Skill Validation",
      "high",
      `You cite a figure of "${NUM[0]}" on your resume. Walk me through exactly how that was calculated, the baseline it improved on, and your specific role in achieving it.`,
      "Validates that headline numbers are real and self-attributable, not borrowed team results.",
      "Inflated or borrowed metrics.",
      `Explains the measurement method behind ${NUM[0]}, the baseline, the timeframe, and which parts they personally drove.`,
      "Can't reconstruct the number or attributes it entirely to 'the team'."
    );
  }

  if (has(["ai", "machine learning", "ml ", "llm", "data science", "deep learning", "nlp", "model"])) {
    RA.push("AI/ML depth vs. exposure");
    add(
      "Problem Solving",
      "high",
      `You mention ${SK.find((s) => /ai|ml|model|tensor|pytorch|nlp|llm|data/i.test(s)) || "AI/ML work"}. Tell me about a model you shipped that underperformed in production — how did you detect it, diagnose the cause, and fix it?`,
      "Distinguishes hands-on practitioners from those who only used pre-built tools or dashboards.",
      "Surface-level AI exposure.",
      "Describes monitoring that caught drift or a metric drop, a root-cause investigation (data, features, leakage), and a concrete fix with the recovered metric.",
      "Talks only about training accuracy, never production, or has never debugged a live model."
    );
  }

  if (SK.length) {
    add(
      "Skill Validation",
      "clarification",
      `You list ${sk1} and ${sk2} among your skills. Pick ${sk1} — describe the most complex problem you solved with it, and tell me where your knowledge of it ends.`,
      "Honest calibration test that exposes overclaimed proficiency on a named tool.",
      "Overclaimed skills.",
      `Gives a non-trivial ${sk1} problem with technical specifics, and candidly names the edge of their knowledge — confident calibration beats false completeness.`,
      `Generic textbook description of ${sk1} or claims to know 'everything'.`
    );
  }

  const years = [...new Set(resume.match(/20\d\d/g) || [])];
  if (CO.length >= 3 || years.length >= 6) {
    RA.push("Possible frequent job switches");
    add(
      "Career Transition",
      "clarification",
      `You've moved between ${CO.length >= 2 ? CO.slice(0, 3).join(", ") : "several companies"} over a few years. Walk me through the reason behind your move from ${co2} to ${co1} specifically.`,
      "Surfaces the pattern behind short tenures and stability/retention risk.",
      "Job-hopping / retention risk.",
      "Gives a coherent, growth-oriented reason per move rather than running from problems, and shows what they completed before leaving.",
      "Blames managers/companies each time, or left key projects unfinished."
    );
  }

  if (has(["transition", "pivot", "switched", "moved from", "career change", "formerly"])) {
    RA.push("Career/domain transition");
    add(
      "Career Transition",
      "clarification",
      `You transitioned into ${ROLE || "this field"}. Which skills from your earlier work transferred directly, and what was the single steepest thing you had to learn from scratch?`,
      "Assesses adaptability and whether the transition is substantiated with real ramp-up.",
      "Domain mismatch / ramp-up risk.",
      "Names concrete transferable skills with examples, and honestly describes a hard learning curve plus how they closed it.",
      "Hand-waves the transition or can't point to deliberate upskilling."
    );
  }

  add(
    "Behavioral",
    "strong",
    `Tell me about the hardest piece of feedback you got ${roleTxt}. What specifically did you change afterward, and how did you know it worked?`,
    "Assesses self-awareness, coachability and follow-through — lets a strong candidate shine.",
    "Low self-awareness.",
    "Recalls specific feedback, a concrete behavior change, and an observable result — demonstrating a real growth loop, not a humble-brag.",
    "Picks a fake weakness ('I work too hard') or shows no actual change."
  );
  add(
    "Follow-up",
    "strong",
    `Of everything on your resume — across ${CO.length ? CO.slice(0, 2).join(" and ") : "your roles"} — what work are you proudest of, and why does it matter to you personally?`,
    "Reveals authentic motivation and what energizes the candidate.",
    "Misaligned motivation.",
    "Picks something specific and talks about it with genuine detail and ownership; the 'why' reveals values aligned to the role.",
    "Generic answer that could apply to anyone, or motivated purely by title/pay."
  );

  if (jd && jd.trim()) {
    const jdRole = (jd.match(/(senior|lead|principal|staff|head|manager|engineer|analyst|designer|scientist|director)[^\n.,]{0,30}/i) || [])[0];
    RA.push("Fit against this specific role");
    add(
      "Problem Solving",
      "clarification",
      `This role is for a ${jdRole || "position"} that owns ${jdCore(jd)}. Given your background at ${co1}, walk me through how you'd approach your first 90 days here and what you'd prioritise first.`,
      "Tests role-specific understanding and concrete planning against the JD.",
      "Role-fit uncertainty.",
      "Lays out a phased plan (learn → quick win → bigger bet) that maps their resume strengths onto this role's actual responsibilities.",
      "Recites a generic onboarding plan with no link to this JD or their own experience."
    );
  }

  if (RA.length === 0) RA.push("General validation");
  return { risk_areas: [...new Set(RA)], questions: Q };
}

function extractEntities(resume: string) {
  const lines = resume.split(/\n|•|;/).map((s) => s.trim()).filter(Boolean);
  const impact = (resume.match(/(?:[₹$]\s?\d[\d,.]*\s?(?:k|m|cr|lakh|million|billion)?|\b\d[\d,.]*\s?%|\b\d+\s?x\b)/gi) || []).map((s) => s.trim());
  const scale = (resume.match(/\b\d[\d,.]*\s?(?:users|customers|clients|requests|transactions|downloads)/gi) || []).map((s) => s.trim());
  const numbers = [...new Set([...impact, ...scale])].slice(0, 5);

  const known = ["python", "java", "javascript", "typescript", "react", "node", "sql", "aws", "gcp", "azure", "docker", "kubernetes", "tensorflow", "pytorch", "nlp", "llm", "spark", "hadoop", "tableau", "power bi", "excel", "figma", "salesforce", "sap", "go", "rust", "c++", "scala", "kafka", "airflow", "snowflake", "django", "flask", "spring", "graphql", "mongodb", "postgres", "redis", "terraform", "jenkins", "git", "machine learning", "deep learning", "data science"];
  const lc = resume.toLowerCase();
  let skills = known.filter((k) => lc.includes(k)).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));
  const skLine = lines.find((l) => /^skills?[:\-]/i.test(l));
  if (skLine) {
    skLine
      .replace(/^skills?[:\-]\s*/i, "")
      .split(/[,/|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 24)
      .forEach((s) => {
        if (!skills.includes(s)) skills.push(s);
      });
  }
  skills = [...new Set(skills)].slice(0, 8);

  const companies: string[] = [];
  let m: RegExpExecArray | null;
  const coRe = /\b(?:at|@|,)\s+([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,2})(?:\s+(?:Inc|Ltd|LLC|Pvt|Technologies|Labs|Systems|Solutions|Corp|Group))?/g;
  while ((m = coRe.exec(resume))) {
    const c = m[1].trim();
    if (c.length > 1 && !/^(The|And|For|With|To|In|On|Of)$/i.test(c)) companies.push(c);
  }
  const suffixRe = /\b([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,2})\s+(?:Inc|Ltd|LLC|Pvt|Technologies|Labs|Systems|Solutions|Corp|Group)\b/g;
  while ((m = suffixRe.exec(resume))) companies.push(m[1].trim());
  const uniqCompanies = [...new Set(companies)].slice(0, 5);

  const role = (resume.match(/\b((?:senior|lead|principal|staff|head of|chief)?\s*(?:software|data|product|ml|machine learning|backend|frontend|full stack|devops)?\s*(?:engineer|developer|scientist|manager|analyst|designer|architect|lead|director|consultant))\b/i) || [])[1];

  return {
    skills,
    companies: uniqCompanies,
    numbers,
    role: role ? role.replace(/\s+/g, " ").trim() : null,
  };
}

function jdCore(jd: string): string {
  const s = jd.split(/[.\n]/).map((x) => x.trim()).filter((x) => x.length > 20);
  return (s[0] || "the role's core responsibilities").slice(0, 90);
}
