import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { runWarmupSendExecutor } from "@/lib/growth/warmup/warmup-send-executor"
import {
  deriveWarmupCronExecutionOk,
  deriveWarmupCronFailureReason,
} from "@/lib/growth/warmup/warmup-cron-telemetry"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-warmup-send-executor")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 })
  }

  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () =>
      runWarmupSendExecutor(admin, {
        runKind: "cron",
        enforceSendingWindow: true,
      }),
    (result) => ({
      processedCount: result.sendsSucceeded,
      failedCount: result.sendsFailed,
      skippedCount: result.sendsSkipped,
      executionOk: deriveWarmupCronExecutionOk(result),
      metadata: {
        qa_marker: result.qa_marker,
        status: result.status,
        sends_succeeded: result.sendsSucceeded,
        sends_failed: result.sendsFailed,
        profiles_scanned: result.profilesScanned,
        failure_reason: deriveWarmupCronFailureReason(result),
      },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
