import { NextRequest, NextResponse } from "next/server";
import { logFeedback } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rating = body.rating === "up" ? "up" : body.rating === "down" ? "down" : null;
    if (!rating) {
      return NextResponse.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
    }
    await logFeedback({
      generation_id: String(body.generation_id || "unknown"),
      rating,
      comment: body.comment ? String(body.comment).slice(0, 1000) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
