import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { previewWarmupSendExecutor } from "@/lib/growth/warmup/warmup-send-executor"
import { GROWTH_WARMUP_EXECUTOR_QA_MARKER } from "@/lib/growth/warmup/warmup-executor-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  const preview = await previewWarmupSendExecutor(access.admin)
  return NextResponse.json({ ok: true, preview, qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER })
}
