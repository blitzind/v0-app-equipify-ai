import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { processNextRunnableImportRun } from "@/lib/migration-imports/async-runner"

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

  for (let i = 0; i < maxRuns; i++) {
    const { processed, run } = await processNextRunnableImportRun({ userId: "system-cron", supabase: svc, svc }, { workerId })
    if (!processed) break
    if (run) processedRuns.push({ runRef: run.runRef, status: run.status })
  }

  return NextResponse.json({
    ok: true,
    processedCount: processedRuns.length,
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
