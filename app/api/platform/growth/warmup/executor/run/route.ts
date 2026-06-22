import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { runWarmupSendExecutor } from "@/lib/growth/warmup/warmup-send-executor"
import { GROWTH_WARMUP_EXECUTOR_QA_MARKER } from "@/lib/growth/warmup/warmup-executor-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  confirmed: z.boolean(),
})

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success || !parsed.data.confirmed) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: "Set confirmed: true to run warmup batch." },
      { status: 400 },
    )
  }

  const result = await runWarmupSendExecutor(access.admin, {
    runKind: "manual",
    confirmed: true,
    actorUserId: access.userId,
    actorEmail: access.userEmail,
    enforceSendingWindow: false,
  })

  return NextResponse.json({ ok: true, result, qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER })
}
