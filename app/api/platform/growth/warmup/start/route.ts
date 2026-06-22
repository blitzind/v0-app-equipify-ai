import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { startWarmupForSenderAccount } from "@/lib/growth/warmup/warmup-startup-service"
import { isGrowthWarmupFoundationSchemaReady } from "@/lib/growth/warmup/warmup-schema-health"

export const runtime = "nodejs"

const StartWarmupSchema = z.object({
  senderAccountId: z.string().uuid(),
  warmupDays: z.number().int().min(1).max(120).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupFoundationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = StartWarmupSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid warmup startup payload. Sender account id is required." },
      { status: 400 },
    )
  }

  const result = await startWarmupForSenderAccount(access.admin, {
    senderAccountId: parsed.data.senderAccountId,
    warmupDays: parsed.data.warmupDays,
    notes: parsed.data.notes ?? null,
    actorUserId: access.userId,
    actorEmail: access.userEmail,
  })

  if (!result.ok) {
    const status =
      result.action === "missing_sender" ? 400
      : result.action === "schedule_generation_failed" ? 500
      : 400
    return NextResponse.json(
      { ok: false, error: result.action, action: result.action, message: result.message },
      { status },
    )
  }

  return NextResponse.json({
    ok: true,
    action: result.action,
    message: result.message,
    profile: result.profile,
  })
}
