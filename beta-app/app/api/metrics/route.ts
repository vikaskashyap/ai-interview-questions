import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const m = await getMetrics();
  return NextResponse.json(m);
}
