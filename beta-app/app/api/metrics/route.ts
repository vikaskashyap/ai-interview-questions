import { NextRequest, NextResponse } from "next/server";
import { getMetrics } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_KEY;
  const key = req.nextUrl.searchParams.get("key");
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const m = await getMetrics();
  return NextResponse.json(m);
}
