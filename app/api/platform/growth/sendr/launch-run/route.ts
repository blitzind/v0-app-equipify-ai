import { NextResponse } from "next/server"
import { z } from "zod"
import { GROWTH_SENDR_LAUNCH_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import {
  cancelSendrLaunchRun,
  continueSendrLaunchRun,
  startSendrLaunchRun,
} from "@/lib/growth/sendr/growth-sendr-launch-run-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    audienceId: z.string().uuid(),
    sequencePatternId: z.string().uuid(),
    landingPageId: z.string().uuid(),
    senderAccountId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("continue"),
    launchRunId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("cancel"),
    launchRunId: z.string().uuid(),
  }),
])

export async function POST(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  try {
    let progress
    if (parsed.data.action === "start") {
      progress = await startSendrLaunchRun(access.admin, {
        organizationId: access.organizationId,
        userId: access.userId,
        userEmail: access.userEmail,
        audienceId: parsed.data.audienceId,
        sequencePatternId: parsed.data.sequencePatternId,
        landingPageId: parsed.data.landingPageId,
        senderAccountId: parsed.data.senderAccountId ?? null,
      })
    } else if (parsed.data.action === "continue") {
      progress = await continueSendrLaunchRun(access.admin, {
        organizationId: access.organizationId,
        userId: access.userId,
        userEmail: access.userEmail,
        launchRunId: parsed.data.launchRunId,
      })
    } else {
      progress = await cancelSendrLaunchRun(access.admin, {
        organizationId: access.organizationId,
        launchRunId: parsed.data.launchRunId,
      })
    }

    return NextResponse.json({ ok: true, progress, qa_marker: GROWTH_SENDR_LAUNCH_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "launch_run_failed"
    const status =
      message.includes("cap") || message.includes("budget") || message.includes("disabled") ? 429 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}
