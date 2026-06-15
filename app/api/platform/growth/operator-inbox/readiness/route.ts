import { NextResponse } from "next/server"
import { buildOperatorInboxReadinessPayload } from "@/lib/growth/operator-inbox/operator-inbox-route-gates"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    ok: true,
    ...buildOperatorInboxReadinessPayload(),
  })
}
