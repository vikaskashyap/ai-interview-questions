# AI Interview Question Generator (Beta)

Resume-driven interview question generator for **iimjobs.com** / **hirist.tech**. Upload a resume (PDF/DOCX/text), optionally paste a job description, and get categorized, resume-specific interview questions — each with a model answer guide and weak-answer red flags. Built to the PRD *"Interview Question Generator From Resume Gaps."*

Full-stack Next.js app: React UI + server-side API routes that parse the resume and call Claude. The API key never reaches the browser. If no key is configured, the app automatically falls back to an offline rule-based engine, so it works out of the box.

## Features

- Drag-and-drop upload, server-side parsing (PDF via `pdf-parse`, DOCX via `mammoth`).
- Claude-powered generation with one automatic retry and strict JSON validation; graceful fallback to the offline engine on any failure.
- Results grouped into 🔴 High Risk / 🟡 Clarification / 🟢 Strong, each question carrying *why it matters*, *risk evaluated*, *what a strong answer covers*, and *weak-answer signal*.
- Actions: copy question, copy all, export PDF, save set (JSON).
- Per-result thumbs up/down feedback widget with optional comment.
- Built-in analytics at **/admin**: generations, avg latency, satisfaction, copy/export counts, a 7-day trend, and recent comments.
- Per-IP rate limiting (configurable). Resumes are processed in-memory and never stored.

## Run locally

```bash
cd beta-app
npm install
cp .env.example .env          # then add your ANTHROPIC_API_KEY (optional)
npm run dev                    # http://localhost:3000
```

Open `http://localhost:3000` for the app and `http://localhost:3000/admin` for metrics.

Without an API key the app runs in offline demo mode. Add `ANTHROPIC_API_KEY` to `.env` for live Claude generation.

## Production build

```bash
npm run build
npm start
```

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables live Claude generation. Omit to use the offline engine. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Model used for generation. |
| `RATE_LIMIT_PER_HOUR` | `30` | Max generations per IP per hour. `0` disables. |

## Deploy notes

- **Vercel:** push to GitHub, import the repo, set the env vars. Note: the JSONL analytics store (`lib/store.ts`) writes to disk, which is read-only on serverless. For Vercel, swap `lib/store.ts` for a Postgres/KV-backed implementation (the function signatures can stay identical). The core generator works on Vercel as-is.
- **Docker / self-host / long-running Node host:** the disk-backed store works as-is. `npm run build && npm start` behind a reverse proxy.

## Architecture

```
app/
  page.tsx                     UI (upload, results, feedback, actions)
  admin/page.tsx               metrics dashboard
  api/generate-questions       parse + Claude orchestration + fallback
  api/feedback                 thumbs up/down + comment
  api/event                    copy/export usage events
  api/metrics                  aggregated analytics
lib/
  parse.ts                     PDF/DOCX/text extraction
  claude.ts                    prompt, Anthropic call, retry, JSON validation
  demo.ts                      offline rule-based engine (resume-specific)
  store.ts                     JSONL analytics + in-memory rate limiter
  types.ts                     shared types
```

## API

`POST /api/generate-questions` — accepts `multipart/form-data` (`resume` file or `resume_text`, plus optional `job_description`) or JSON `{ resume_text, job_description }`.

Response:
```json
{
  "risk_areas": ["..."],
  "questions": [
    { "category": "Skill Validation", "severity": "high",
      "question": "...", "why_it_matters": "...", "risk": "...",
      "model_answer": "...", "red_flags": "..." }
  ],
  "source": "claude",
  "latency_ms": 4200,
  "generation_id": "uuid"
}
```
