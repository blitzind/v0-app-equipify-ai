import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runDueScheduledOutreachExecutions } from "@/lib/growth/outreach/run-outreach-queue"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  const result = await runDueScheduledOutreachExecutions(admin, {
    actingUserId: "system",
    actingUserEmail: "cron@growth.equipify.internal",
    limit: 25,
  })

  return NextResponse.json({ ok: true, ...result })
}
