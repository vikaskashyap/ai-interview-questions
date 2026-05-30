import { NextRequest, NextResponse } from "next/server";
import { logEvent, EventName } from "@/lib/store";

export const runtime = "nodejs";

const ALLOWED: EventName[] = ["copy_question", "copy_all", "export_pdf", "save_set"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name as EventName;
    if (!ALLOWED.includes(name)) {
      return NextResponse.json({ error: "unknown event" }, { status: 400 });
    }
    await logEvent(name, { generation_id: body.generation_id });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
