import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  processMarketHealthRefreshQueue,
  queueMarketHealthRefresh,
  rebuildDiscoveryOutcomePatterns,
} from "@/lib/growth/market-intelligence/market-repository"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const headerSecret = request.headers.get("x-cron-secret")
  if (!secret || (auth !== `Bearer ${secret}` && headerSecret !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  const queued = await queueMarketHealthRefresh(admin)
  const patterns = await rebuildDiscoveryOutcomePatterns(admin)
  const result = await processMarketHealthRefreshQueue(admin, 10)

  return NextResponse.json({ ok: true, queued, patterns_rebuilt: patterns, ...result })
}
