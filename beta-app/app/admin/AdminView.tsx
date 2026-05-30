"use client";

import { useEffect, useState } from "react";

interface Metrics {
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

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-panel border border-edge rounded-xl p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[13px] text-muted mt-1">{label}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminView({ adminKey }: { adminKey: string }) {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState("");

  const load = () => {
    fetch(`/api/metrics?key=${encodeURIComponent(adminKey)}`)
      .then((r) => r.json())
      .then(setM)
      .catch(() => setErr("Could not load metrics."));
  };
  useEffect(load, []);

  const max = Math.max(1, ...(m?.generations_last_7d.map((d) => d.count) || [1]));

  return (
    <main className="max-w-[1000px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Beta Metrics</h1>
          <p className="text-xs text-muted mt-0.5">Built-in usage analytics · PRD success metrics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="text-xs text-muted border border-edge rounded-full px-3 py-1.5 hover:text-ink hover:border-accent transition">Reload</button>
          <a href="/" className="text-xs text-muted border border-edge rounded-full px-3 py-1.5 hover:text-ink hover:border-accent transition">← App</a>
        </div>
      </div>

      {err && <p className="text-risk-red text-sm">{err}</p>}
      {!m ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Total generations" value={m.total_generations} sub={Object.entries(m.by_source).map(([k, v]) => `${k}: ${v}`).join(" · ")} />
            <Stat label="Avg latency" value={`${(m.avg_latency_ms / 1000).toFixed(1)}s`} sub="PRD target ≤ 10s" />
            <Stat label="Satisfaction" value={m.satisfaction_pct === null ? "—" : `${m.satisfaction_pct}%`} sub={`👍 ${m.feedback_up} · 👎 ${m.feedback_down}`} />
            <Stat label="Questions copied" value={m.questions_copied} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Copy-all clicks" value={m.copy_all} />
            <Stat label="PDF exports" value={m.pdf_exports} />
            <Stat label="Sets saved" value={m.sets_saved} />
            <Stat label="Exports total" value={m.pdf_exports + m.sets_saved} />
          </div>

          <div className="bg-panel border border-edge rounded-xl p-5 mb-6">
            <h2 className="text-sm font-bold mb-4">Generations — last 7 days</h2>
            <div className="flex items-end gap-2 h-32">
              {m.generations_last_7d.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-gradient-to-t from-accent to-accent2 rounded-t" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 0 }} title={`${d.count}`} />
                  <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
                  <span className="text-[10px] text-ink font-semibold -mt-1">{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-panel border border-edge rounded-xl p-5">
            <h2 className="text-sm font-bold mb-3">Recent feedback comments</h2>
            {m.recent_comments.length === 0 ? (
              <p className="text-muted text-[13px] italic">No comments yet.</p>
            ) : (
              <ul className="space-y-2">
                {m.recent_comments.map((c, i) => (
                  <li key={i} className="text-[13px] border-b border-edge pb-2 last:border-0">
                    <span className={c.rating === "up" ? "text-risk-green" : "text-risk-red"}>{c.rating === "up" ? "👍" : "👎"}</span>{" "}
                    {c.comment}
                    <span className="text-muted text-[11px] ml-2">{new Date(c.ts).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
