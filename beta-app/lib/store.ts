import { promises as fs } from "fs";
import path from "path";

/**
 * Zero-dependency append-only JSONL store. Good enough for a local beta.
 * For production deploy (Vercel/serverless read-only FS), swap this module
 * for Postgres or KV — the function signatures can stay the same.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const EVENTS = path.join(DATA_DIR, "events.jsonl");
const FEEDBACK = path.join(DATA_DIR, "feedback.jsonl");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function append(file: string, record: Record<string, unknown>) {
  try {
    await ensureDir();
    await fs.appendFile(file, JSON.stringify(record) + "\n", "utf8");
  } catch (e) {
    // Never let analytics break the core product.
    console.error("store.append failed", e);
  }
}

async function readAll(file: string): Promise<Record<string, any>[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Record<string, any>[];
  } catch {
    return [];
  }
}

export type EventName =
  | "generate"
  | "copy_question"
  | "copy_all"
  | "export_pdf"
  | "save_set";

export async function logEvent(
  name: EventName,
  meta: Record<string, unknown> = {}
) {
  await append(EVENTS, { name, ts: Date.now(), ...meta });
}

export async function logFeedback(rec: {
  generation_id: string;
  rating: "up" | "down";
  comment?: string;
}) {
  await append(FEEDBACK, { ...rec, ts: Date.now() });
}

export interface MetricsSummary {
  total_generations: number;
  by_source: Record<string, number>;
  avg_latency_ms: number;
  questions_copied: number;
  copy_all: number;
  pdf_exports: number;
  sets_saved: number;
  feedback_up: number;
  feedback_down: number;
  satisfaction_pct: number | null;
  recent_comments: { rating: string; comment: string; ts: number }[];
  generations_last_7d: { date: string; count: number }[];
}

export async function getMetrics(): Promise<MetricsSummary> {
  const events = await readAll(EVENTS);
  const feedback = await readAll(FEEDBACK);

  const gens = events.filter((e) => e.name === "generate");
  const bySource: Record<string, number> = {};
  let latencySum = 0;
  let latencyCount = 0;
  for (const g of gens) {
    const s = (g.source as string) || "unknown";
    bySource[s] = (bySource[s] || 0) + 1;
    if (typeof g.latency_ms === "number") {
      latencySum += g.latency_ms;
      latencyCount++;
    }
  }

  const up = feedback.filter((f) => f.rating === "up").length;
  const down = feedback.filter((f) => f.rating === "down").length;
  const totalFb = up + down;

  // last 7 days bucketed by date
  const days: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  for (const g of gens) {
    const key = new Date(g.ts).toISOString().slice(0, 10);
    if (key in days) days[key]++;
  }

  return {
    total_generations: gens.length,
    by_source: bySource,
    avg_latency_ms: latencyCount ? Math.round(latencySum / latencyCount) : 0,
    questions_copied: events.filter((e) => e.name === "copy_question").length,
    copy_all: events.filter((e) => e.name === "copy_all").length,
    pdf_exports: events.filter((e) => e.name === "export_pdf").length,
    sets_saved: events.filter((e) => e.name === "save_set").length,
    feedback_up: up,
    feedback_down: down,
    satisfaction_pct: totalFb ? Math.round((up / totalFb) * 100) : null,
    recent_comments: feedback
      .filter((f) => f.comment)
      .slice(-15)
      .reverse()
      .map((f) => ({ rating: f.rating, comment: f.comment, ts: f.ts })),
    generations_last_7d: Object.entries(days).map(([date, count]) => ({
      date,
      count,
    })),
  };
}

/* ---- simple in-memory IP rate limiter (per process) ---- */
const hits = new Map<string, number[]>();
export function rateLimit(ip: string, perHour: number): boolean {
  if (!perHour || perHour <= 0) return true;
  const now = Date.now();
  const windowStart = now - 3600_000;
  const arr = (hits.get(ip) || []).filter((t) => t > windowStart);
  if (arr.length >= perHour) {
    hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  hits.set(ip, arr);
  return true;
}
