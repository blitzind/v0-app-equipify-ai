import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthSequenceScheduler } from "@/lib/growth/sequence-enrollment/run-sequence-scheduler"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const headerSecret = request.headers.get("x-cron-secret")
  if (!secret || (auth !== `Bearer ${secret}` && headerSecret !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  const result = await runGrowthSequenceScheduler(admin, {
    actingUserId: "system",
    actingUserEmail: "cron@growth.equipify.internal",
    limit: 25,
    dryRun: false,
  })

  return NextResponse.json({ ok: true, ...result })
}
