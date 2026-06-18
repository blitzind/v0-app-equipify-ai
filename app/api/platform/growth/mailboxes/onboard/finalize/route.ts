import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { finalizeMailboxOnboarding } from "@/lib/growth/mailboxes/mailbox-onboarding-service"
import { GROWTH_MAILBOX_ONBOARDING_QA_MARKER } from "@/lib/growth/mailboxes/mailbox-onboarding-types"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"

export const runtime = "nodejs"

const FinalizeSchema = z.object({
  senderId: z.string().uuid(),
  warmupEnabled: z.boolean().optional(),
  warmupDays: z.number().int().min(1).max(120).optional(),
  poolId: z.string().uuid().nullable().optional(),
  newPoolName: z.string().trim().min(1).max(120).nullable().optional(),
  activatePool: z.boolean().optional(),
  activateSender: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = FinalizeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid finalize payload." }, { status: 400 })
  }

  try {
    const result = await finalizeMailboxOnboarding(access.admin, {
      senderId: parsed.data.senderId,
      warmupEnabled: parsed.data.warmupEnabled,
      warmupDays: parsed.data.warmupDays,
      poolId: parsed.data.poolId ?? null,
      newPoolName: parsed.data.newPoolName ?? null,
      activatePool: parsed.data.activatePool,
      activateSender: parsed.data.activateSender,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_MAILBOX_ONBOARDING_QA_MARKER,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not finalize onboarding."
    const status = message === "sender_not_found" ? 404 : 500
    return NextResponse.json({ error: "onboard_finalize_failed", message }, { status })
  }
}
