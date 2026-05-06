import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { processQueuedCatalogExtractionJobs } from "@/lib/ai/jobs/process-ai-job-queue"

export const runtime = "nodejs"
export const maxDuration = 300

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

/**
 * Drains queued `catalog_extraction` AI jobs. Secured with CRON_SECRET (same as other crons).
 * Safe with concurrent Vercel instances: each job row is claimed with queued→processing inside the runner.
 */
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

  const maxJobs = Math.min(Math.max(Number.parseInt(process.env.AI_JOB_CRON_BATCH ?? "5", 10) || 5, 1), 10)
  const result = await processQueuedCatalogExtractionJobs(svc, maxJobs)

  return NextResponse.json({
    ok: true,
    catalog_extraction: result,
    maxJobs,
  })
}

export async function GET(request: Request) {
  return runCron(request)
}

export async function POST(request: Request) {
  return runCron(request)
}
