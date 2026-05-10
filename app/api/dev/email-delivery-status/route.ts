import { NextResponse } from "next/server"
import { getOutboundEmailHealth } from "@/lib/email/config"

export const runtime = "nodejs"

/**
 * Dev-only: boolean email configuration snapshot (no secrets).
 * Production returns 404 to avoid surfacing infra details publicly.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(getOutboundEmailHealth())
}
