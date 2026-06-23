import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import {
  logWarmupExecutorFailure,
  warmupExecutorJsonError,
  warmupExecutorJsonSuccess,
} from "@/lib/growth/warmup/warmup-executor-route-utils"
import { runWarmupSendExecutor } from "@/lib/growth/warmup/warmup-send-executor"

export const runtime = "nodejs"

const BodySchema = z.object({
  confirmed: z.boolean(),
})

export async function POST(request: Request) {
  try {
    const access = await requireGrowthCommunicationsSettingsAccess(request)
    if (!access.ok) return access.response

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return warmupExecutorJsonError({
        error: "Request body must be JSON.",
        code: "invalid_json",
        status: 400,
      })
    }

    const parsed = BodySchema.safeParse(body)
    if (!parsed.success || !parsed.data.confirmed) {
      return warmupExecutorJsonError({
        error: "Set confirmed: true to run warmup batch.",
        code: "confirmation_required",
        status: 400,
      })
    }

    const result = await runWarmupSendExecutor(access.admin, {
      runKind: "manual",
      confirmed: true,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      enforceSendingWindow: false,
    })

    return warmupExecutorJsonSuccess(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Warmup batch failed unexpectedly."
    logWarmupExecutorFailure("warmup_executor_run_failed", {
      code: "warmup_executor_failed",
      error: message,
    })
    return warmupExecutorJsonError({
      error: message,
      code: "warmup_executor_failed",
      status: 500,
    })
  }
}
