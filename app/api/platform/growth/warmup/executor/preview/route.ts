import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { buildWarmupExecutorSuccessBody } from "@/lib/growth/warmup/warmup-executor-api-response"
import {
  logWarmupExecutorFailure,
  warmupExecutorJsonError,
} from "@/lib/growth/warmup/warmup-executor-route-utils"
import { previewWarmupSendExecutor } from "@/lib/growth/warmup/warmup-send-executor"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const access = await requireGrowthCommunicationsSettingsAccess(request)
    if (!access.ok) return access.response

    const preview = await previewWarmupSendExecutor(access.admin)
    return NextResponse.json({
      ...buildWarmupExecutorSuccessBody(preview),
      preview,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Warmup preview failed unexpectedly."
    logWarmupExecutorFailure("warmup_executor_preview_failed", {
      code: "warmup_executor_preview_failed",
      error: message,
    })
    return warmupExecutorJsonError({
      error: message,
      code: "warmup_executor_preview_failed",
      status: 500,
    })
  }
}
