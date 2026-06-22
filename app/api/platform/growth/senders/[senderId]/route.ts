import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import {
  getSenderAccount,
  softDeleteSenderAccount,
  updateSenderAccount,
} from "@/lib/growth/sender/sender-repository"
import { isGrowthSenderInfrastructureSchemaReady } from "@/lib/growth/sender/sender-schema-health"
import { GROWTH_SENDER_ACCOUNT_STATUSES } from "@/lib/growth/sender/sender-types"

export const runtime = "nodejs"

const UpdateSenderSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  status: z.enum(GROWTH_SENDER_ACCOUNT_STATUSES).optional(),
  dailySendLimit: z.number().int().min(0).max(10000).optional(),
  dailySendUsed: z.number().int().min(0).max(100000).optional(),
  warmupEligible: z.boolean().optional(),
  warmupEnabled: z.boolean().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  providerConnectionId: z.string().uuid().nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ senderId: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderInfrastructureSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { senderId } = await context.params
  const parsed = UpdateSenderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sender update payload." }, { status: 400 })
  }

  try {
    const sender = await updateSenderAccount(access.admin, senderId, {
      display_name: parsed.data.displayName,
      status: parsed.data.status,
      daily_send_limit: parsed.data.dailySendLimit,
      daily_send_used: parsed.data.dailySendUsed,
      warmup_eligible: parsed.data.warmupEligible,
      warmup_enabled: parsed.data.warmupEnabled,
      notes: parsed.data.notes,
      provider_connection_id: parsed.data.providerConnectionId,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, sender })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed."
    const status = message === "sender_not_found" ? 404 : 500
    return NextResponse.json({ error: "sender_update_failed", message }, { status })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ senderId: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderInfrastructureSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { senderId } = await context.params

  try {
    const deleted = await softDeleteSenderAccount(access.admin, {
      senderId,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed."
    const status = message === "sender_not_found" ? 404 : 500
    return NextResponse.json({ error: "sender_delete_failed", message }, { status })
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ senderId: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  const { senderId } = await context.params
  const sender = await getSenderAccount(access.admin, senderId)
  if (!sender) {
    return NextResponse.json({ error: "sender_not_found", message: "Sender not found." }, { status: 404 })
  }
  return NextResponse.json({ ok: true, sender })
}
