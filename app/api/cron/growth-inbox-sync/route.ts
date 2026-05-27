import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runInboxSyncForEnabledMailboxes } from "@/lib/growth/inbox-sync/inbox-sync-runner"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const headerSecret = request.headers.get("x-cron-secret")
  if (!secret || (auth !== `Bearer ${secret}` && headerSecret !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  const summary = await runInboxSyncForEnabledMailboxes(admin, {
    actingUserId: "system",
    actorEmail: "cron@growth.equipify.internal",
    limit: 10,
  })

  return NextResponse.json({ ok: true, summary })
}
