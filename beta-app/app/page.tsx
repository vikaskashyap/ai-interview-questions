"use client";

import { useCallback, useRef, useState } from "react";

type Severity = "high" | "clarification" | "strong";
interface Question {
  category: string;
  severity: Severity;
  question: string;
  why_it_matters: string;
  risk: string;
  model_answer: string;
  red_flags: string;
}
interface Result {
  risk_areas: string[];
  questions: Question[];
  source: "gemini" | "demo";
  latency_ms: number;
  generation_id: string;
}

const SECTIONS: { key: Severity; title: string; ring: string; text: string; bg: string }[] = [
  { key: "high", title: "🔴 High Risk Areas", ring: "border-[#f6c9c9]", text: "text-risk-red", bg: "bg-[#fdf2f2]" },
  { key: "clarification", title: "🟡 Clarification Areas", ring: "border-[#f3ddae]", text: "text-risk-yellow", bg: "bg-[#fdf6e9]" },
  { key: "strong", title: "🟢 Strong Areas", ring: "border-[#bfe6cc]", text: "text-risk-green", bg: "bg-[#f0faf3]" },
];

function loadJsPDF(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).jspdf) return resolve((window as any).jspdf);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve((window as any).jspdf);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jd, setJd] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [toast, setToast] = useState("");
  const [drag, setDrag] = useState(false);
  const [fb, setFb] = useState<"up" | "down" | null>(null);
  const [fbComment, setFbComment] = useState("");
  const [fbSent, setFbSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  };

  const onFile = (f: File) => {
    selectedFile.current = f;
    setFileName(f.name);
    setResumeText("");
  };

  const generate = useCallback(async () => {
    setError("");
    if (!selectedFile.current && resumeText.trim().length < 40) {
      setError("Upload a resume file or paste at least a few lines.");
      return;
    }
    setLoading(true);
    setResult(null);
    setFb(null);
    setFbSent(false);
    setFbComment("");
    try {
      const form = new FormData();
      if (selectedFile.current) form.append("resume", selectedFile.current);
      else form.append("resume_text", resumeText);
      form.append("job_description", jd);
      const res = await fetch("/api/generate-questions", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult(data);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [resumeText, jd]);

  const track = (name: string) => {
    fetch("/api/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, generation_id: result?.generation_id }),
    }).catch(() => {});
  };

  const copy = (text: string, ev: string) => {
    navigator.clipboard.writeText(text).then(() => {
      flash("Copied");
      track(ev);
    });
  };

  const asText = (d: Result) => {
    let out = "INTERVIEW QUESTION SET\n\nRisk areas: " + d.risk_areas.join(", ") + "\n\n";
    d.questions.forEach((q, i) => {
      out += `${i + 1}. [${q.category}] (${q.severity}) ${q.question}\n   Why it matters: ${q.why_it_matters}\n   Risk: ${q.risk}\n   What a strong answer covers: ${q.model_answer}\n   Weak-answer signal: ${q.red_flags}\n\n`;
    });
    return out;
  };

  const exportPdf = async () => {
    if (!result) return;
    const { jsPDF } = await loadJsPDF();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 46;
    let y = margin;
    const w = 515;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Interview Question Set", margin, y);
    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text("AI Interview Question Generator — sharper, evidence-based interviews from any resume", margin, y);
    y += 20;
    doc.setTextColor(40);
    doc.setFont("helvetica", "italic");
    const ra = doc.splitTextToSize("Risk areas: " + result.risk_areas.join(", "), w);
    doc.text(ra, margin, y);
    y += ra.length * 13 + 8;
    doc.setFont("helvetica", "normal");
    result.questions.forEach((q, i) => {
      if (y > 770) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(80, 110, 255);
      doc.text(`[${q.category}] · ${q.severity}`, margin, y); y += 14;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
      const ql = doc.splitTextToSize(`${i + 1}. ${q.question}`, w); doc.text(ql, margin, y); y += ql.length * 14 + 2;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90);
      const wl = doc.splitTextToSize("Why it matters: " + q.why_it_matters, w); doc.text(wl, margin, y); y += wl.length * 12;
      const rl = doc.splitTextToSize("Risk evaluated: " + q.risk, w); doc.text(rl, margin, y); y += rl.length * 12;
      if (y > 760) { doc.addPage(); y = margin; }
      doc.setTextColor(30, 130, 90);
      const ml = doc.splitTextToSize("What a strong answer covers: " + q.model_answer, w); doc.text(ml, margin, y); y += ml.length * 12;
      doc.setTextColor(170, 120, 20);
      const fl = doc.splitTextToSize("Weak-answer signal: " + q.red_flags, w); doc.text(fl, margin, y); y += fl.length * 12 + 12;
    });
    doc.save("interview-questions.pdf");
    flash("PDF exported");
    track("export_pdf");
  };

  const saveSet = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "interview-set.json"; a.click();
    URL.revokeObjectURL(url);
    flash("Saved");
    track("save_set");
  };

  const sendFeedback = (rating: "up" | "down", withComment = false) => {
    setFb(rating);
    fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generation_id: result?.generation_id,
        rating,
        comment: withComment ? fbComment : undefined,
      }),
    }).catch(() => {});
    if (withComment) { setFbSent(true); flash("Thanks for the feedback"); }
  };

  const grouped: Record<Severity, Question[]> = { high: [], clarification: [], strong: [] };
  result?.questions.forEach((q) => grouped[q.severity]?.push(q));

  return (
    <main className="max-w-[1080px] mx-auto px-6 pb-24">
      <header className="flex items-center justify-between py-5 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent2 grid place-items-center font-extrabold text-lg">IQ</div>
          <div>
            <h1 className="text-base font-bold leading-tight">AI Interview Question Generator</h1>
            <p className="text-xs text-muted">Read between the lines of any resume <span className="ml-1 px-2 py-0.5 rounded-full border border-edge text-[10px] text-accent">BETA</span></p>
          </div>
        </div>
        <a href="/admin" className="text-xs text-muted border border-edge rounded-full px-3 py-1.5 hover:text-ink hover:border-accent transition">Admin</a>
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Upload */}
        <div className="bg-panel border border-edge rounded-2xl p-5 shadow-card">
          <h2 className="text-sm font-bold">1 · Upload Resume</h2>
          <p className="text-muted text-[13px] mt-0.5 mb-4">PDF, DOCX or text. Parsed securely on the server, never stored.</p>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
            className={`border-2 border-dashed rounded-xl py-8 px-4 text-center cursor-pointer transition ${drag ? "border-accent bg-[#eef0ff]" : "border-edge bg-panel2 hover:border-accent/60"}`}
          >
            <div className="text-3xl opacity-80">⬆️</div>
            <p className="mt-2 text-sm">Drag &amp; drop or click to browse</p>
            <small className="text-muted">PDF · DOCX · TXT (max 8MB)</small>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
          </div>
          {fileName && <div className="mt-3 text-[13px] text-risk-green">✓ {fileName}</div>}
          <label className="block text-[11px] text-muted uppercase tracking-wide mt-4 mb-1.5">Or paste resume text</label>
          <textarea
            value={resumeText}
            onChange={(e) => { setResumeText(e.target.value); selectedFile.current = null; setFileName(""); }}
            placeholder="Paste resume content here..."
            className="w-full min-h-[150px] bg-panel2 border border-edge rounded-xl text-[13px] p-3 outline-none focus:border-accent resize-y"
          />
        </div>

        {/* JD + generate */}
        <div className="bg-panel border border-edge rounded-2xl p-5 shadow-card">
          <h2 className="text-sm font-bold">2 · Job Description <span className="text-muted font-normal text-xs">(optional)</span></h2>
          <p className="text-muted text-[13px] mt-0.5 mb-4">Anchors questions to the role you&apos;re hiring for.</p>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the job description to sharpen relevance..."
            className="w-full min-h-[180px] bg-panel2 border border-edge rounded-xl text-[13px] p-3 outline-none focus:border-accent resize-y"
          />
          <button
            onClick={generate}
            disabled={loading}
            className="mt-4 w-full bg-gradient-to-br from-accent to-accent2 text-white font-semibold text-sm py-3 rounded-xl hover:brightness-110 disabled:opacity-50 transition"
          >
            {loading ? "Analyzing resume…" : "Generate Interview Questions"}
          </button>
          {loading && (
            <div className="flex items-center gap-2.5 mt-4 text-muted text-sm">
              <span className="spinner" /> Reading the resume and preparing questions…
            </div>
          )}
          {error && <div className="mt-3 bg-[#fdf2f2] border border-[#f6c9c9] text-risk-red text-[13px] p-3 rounded-xl">{error}</div>}
        </div>
      </div>

      {/* Results */}
      {result && (
        <section id="results" className="mt-7">
          <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
            <div>
              <h2 className="text-xl font-bold">Interview Question Set</h2>
              <p className="text-xs text-muted mt-0.5">
                {result.questions.length} questions · {result.source === "gemini" ? "Generated by Gemini" : "Offline demo engine"} · {(result.latency_ms / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => copy(asText(result), "copy_all")} className="text-[13px] bg-panel2 border border-edge rounded-lg px-3.5 py-2 hover:border-accent">Copy all</button>
              <button onClick={exportPdf} className="text-[13px] bg-panel2 border border-edge rounded-lg px-3.5 py-2 hover:border-accent">Export PDF</button>
              <button onClick={saveSet} className="text-[13px] bg-panel2 border border-edge rounded-lg px-3.5 py-2 hover:border-accent">Save set</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {result.risk_areas.map((r, i) => (
              <span key={i} className="text-xs px-3 py-1.5 rounded-full border border-edge bg-panel2">⚑ {r}</span>
            ))}
          </div>

          {SECTIONS.map((sec) => {
            const list = grouped[sec.key];
            return (
              <div key={sec.key} className="mb-6">
                <div className={`flex items-center gap-2 text-[15px] font-bold mb-3 px-3.5 py-2.5 rounded-xl border ${sec.ring} ${sec.text} ${sec.bg}`}>
                  {sec.title} <span className="opacity-70 font-medium">({list.length})</span>
                </div>
                {list.length === 0 ? (
                  <p className="text-muted text-[13px] italic px-0.5">No questions in this category.</p>
                ) : (
                  list.map((q, i) => {
                    const full = `Q: ${q.question}\n[${q.category}]\nWhy it matters: ${q.why_it_matters}\nRisk: ${q.risk}\nWhat a strong answer covers: ${q.model_answer}\nWeak-answer signal: ${q.red_flags}`;
                    return (
                      <div key={i} className="bg-panel border border-edge rounded-xl p-4 mb-3">
                        <span className="inline-block text-[11px] font-semibold text-accent bg-[#eef0ff] px-2.5 py-0.5 rounded-full mb-2">{q.category}</span>
                        <div className="text-[15px] font-semibold leading-snug mb-2.5 text-ink">{q.question}</div>
                        <div className="text-[13px] text-muted leading-relaxed"><b className="text-ink font-semibold">Why it matters:</b> {q.why_it_matters}</div>
                        <div className="text-[13px] text-muted leading-relaxed"><b className="text-ink font-semibold">Risk evaluated:</b> {q.risk}</div>
                        <div className="text-[13px] leading-relaxed mt-2.5 p-2.5 rounded-lg bg-[#f0faf3] border border-[#bfe6cc] text-[#256b43]"><b className="text-risk-green font-semibold">✓ What a strong answer covers:</b> {q.model_answer}</div>
                        <div className="text-[13px] text-muted leading-relaxed mt-1.5"><b className="text-risk-yellow font-semibold">⚠ Weak-answer signal:</b> {q.red_flags}</div>
                        <div className="mt-2.5">
                          <button onClick={() => copy(full, "copy_question")} className="text-xs border border-edge text-muted rounded-md px-2.5 py-1 hover:text-accent hover:border-accent transition">Copy question + answer guide</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}

          {/* Feedback widget */}
          <div className="bg-panel border border-edge rounded-xl p-4 mt-2">
            {!fbSent ? (
              <div>
                <p className="text-sm font-semibold mb-2">Were these questions useful?</p>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => sendFeedback("up")} className={`px-3 py-1.5 rounded-lg border text-sm transition ${fb === "up" ? "border-risk-green text-risk-green bg-[#f0faf3]" : "border-edge text-muted hover:text-ink hover:border-accent"}`}>👍 Yes</button>
                  <button onClick={() => sendFeedback("down")} className={`px-3 py-1.5 rounded-lg border text-sm transition ${fb === "down" ? "border-risk-red text-risk-red bg-[#fdf2f2]" : "border-edge text-muted hover:text-ink hover:border-accent"}`}>👎 No</button>
                </div>
                {fb && (
                  <div className="flex gap-2">
                    <input value={fbComment} onChange={(e) => setFbComment(e.target.value)} placeholder="What could be better? (optional)" className="flex-1 bg-panel2 border border-edge rounded-lg text-[13px] px-3 py-2 outline-none focus:border-accent" />
                    <button onClick={() => sendFeedback(fb, true)} className="text-[13px] bg-gradient-to-br from-accent to-accent2 text-white font-semibold px-4 rounded-lg">Send</button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-risk-green">✓ Thanks — your feedback helps improve the beta.</p>
            )}
          </div>
        </section>
      )}

      <p className="text-center text-muted text-xs mt-10">Resumes are processed in-memory and never stored. Built to PRD: Interview Question Generator From Resume Gaps.</p>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-cardHover z-50">{toast}</div>
      )}
    </main>
  );
}
