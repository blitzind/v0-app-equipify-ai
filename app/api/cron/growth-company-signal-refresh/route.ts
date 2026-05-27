import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  processCompanyGrowthSignalRefreshQueue,
  queueStaleCompanyGrowthSignalRefresh,
} from "@/lib/growth/company-growth-signals/growth-signal-repository"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const headerSecret = request.headers.get("x-cron-secret")
  if (!secret || (auth !== `Bearer ${secret}` && headerSecret !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  const queued = await queueStaleCompanyGrowthSignalRefresh(admin, 50)
  const result = await processCompanyGrowthSignalRefreshQueue(admin, 25)

  return NextResponse.json({ ok: true, queued, ...result })
}
