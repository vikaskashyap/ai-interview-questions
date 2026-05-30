import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { extractResumeText } from "@/lib/parse";
import { generateWithClaude } from "@/lib/claude";
import { demoGenerate } from "@/lib/demo";
import { logEvent, rateLimit } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(req: NextRequest) {
  const perHour = Number(process.env.RATE_LIMIT_PER_HOUR ?? 30);
  if (!rateLimit(clientIp(req), perHour)) {
    return NextResponse.json(
      { error: "Rate limit reached. Please try again later." },
      { status: 429 }
    );
  }

  let resumeText = "";
  let jd = "";

  try {
    const ctype = req.headers.get("content-type") || "";
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      jd = String(form.get("job_description") || "");
      const pasted = String(form.get("resume_text") || "");
      const file = form.get("resume") as File | null;
      if (file && file.size > 0) {
        if (file.size > 8 * 1024 * 1024) {
          return NextResponse.json({ error: "File too large (max 8MB)." }, { status: 413 });
        }
        const buf = Buffer.from(await file.arrayBuffer());
        resumeText = await extractResumeText(buf, file.name, file.type);
      } else {
        resumeText = pasted;
      }
    } else {
      const body = await req.json();
      resumeText = String(body.resume_text || "");
      jd = String(body.job_description || "");
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: "Could not read the resume: " + (e?.message || "parse error") },
      { status: 400 }
    );
  }

  resumeText = resumeText.trim();
  if (resumeText.length < 40) {
    return NextResponse.json(
      { error: "Resume text is too short. Upload a file or paste more content." },
      { status: 400 }
    );
  }

  const started = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let result;
  let source: "claude" | "demo" = "demo";

  if (apiKey) {
    try {
      result = await generateWithClaude(resumeText, jd || undefined, apiKey);
      source = "claude";
    } catch (e) {
      console.error("Claude failed, falling back to demo:", e);
      result = demoGenerate(resumeText, jd);
      source = "demo";
    }
  } else {
    result = demoGenerate(resumeText, jd);
  }

  const latency_ms = Date.now() - started;
  const generation_id = randomUUID();

  await logEvent("generate", {
    source,
    latency_ms,
    question_count: result.questions.length,
    has_jd: Boolean(jd),
    generation_id,
  });

  return NextResponse.json({ ...result, source, latency_ms, generation_id });
}
