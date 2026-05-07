import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { processNextRunnableImportRun, recoverStaleLeases } from "@/lib/migration-imports/async-runner"

export const runtime = "nodejs"
export const maxDuration = 300

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

async function runCron(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const cronHeader = request.headers.get("x-cron-secret")
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const token = bearer ?? cronHeader

  if (!secret || token !== secret) {
    return unauthorized()
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 })
  }

  const maxRuns = Math.min(Math.max(Number.parseInt(process.env.IMPORT_RUN_CRON_BATCH ?? "6", 10) || 6, 1), 20)
  const workerId = `cron-${Date.now().toString(36)}`
  const processedRuns: Array<{ runRef: string; status: string }> = []
  const counters = { processed: 0, skipped: 0, retried: 0, failed: 0, leaseSkipped: 0 }
  const staleLeaseRecovered = await recoverStaleLeases({ userId: "system-cron", supabase: svc, svc })

  for (let i = 0; i < maxRuns; i++) {
    const { processed, run, counters: step } = await processNextRunnableImportRun(
      { userId: "system-cron", supabase: svc, svc },
      { workerId },
    )
    counters.processed += step.processed
    counters.skipped += step.skipped
    counters.retried += step.retried
    counters.failed += step.failed
    counters.leaseSkipped += step.leaseSkipped
    if (!processed) break
    if (run) processedRuns.push({ runRef: run.runRef, status: run.status })
  }

  return NextResponse.json({
    ok: true,
    processedCount: processedRuns.length,
    counters: {
      processed: counters.processed,
      skipped: counters.skipped,
      retried: counters.retried,
      failed: counters.failed,
      leaseSkipped: counters.leaseSkipped,
      "lease-skipped": counters.leaseSkipped,
    },
    staleLeaseRecovered,
    maxRuns,
    runs: processedRuns,
  })
}

export async function GET(request: Request) {
  return runCron(request)
}

export async function POST(request: Request) {
  return runCron(request)
}
