import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runApprovedDueSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-runner"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const headerSecret = request.headers.get("x-cron-secret")
  if (!secret || (auth !== `Bearer ${secret}` && headerSecret !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  const summary = await runApprovedDueSequenceExecutionJobs(admin, {
    actingUserId: "system",
    actingUserEmail: "cron@growth.equipify.internal",
    limit: 25,
  })

  return NextResponse.json({ ok: true, summary })
}
