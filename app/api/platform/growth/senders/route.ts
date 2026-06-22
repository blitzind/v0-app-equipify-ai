import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { listSenderProviderCapabilities } from "@/lib/growth/sender/provider-sender-capabilities"
import { createSenderAccount, listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import { isGrowthSenderInfrastructureSchemaReady } from "@/lib/growth/sender/sender-schema-health"
import {
  GROWTH_SENDER_INFRASTRUCTURE_PRIVACY_NOTE,
  GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER,
  GROWTH_SENDER_PROVIDER_FAMILIES,
} from "@/lib/growth/sender/sender-types"

export const runtime = "nodejs"

const CreateSenderSchema = z.object({
  providerFamily: z.enum(GROWTH_SENDER_PROVIDER_FAMILIES),
  displayName: z.string().trim().min(1).max(120),
  emailAddress: z.string().trim().email().max(320),
  providerConnectionId: z.string().uuid().nullable().optional(),
  dailySendLimit: z.number().int().min(0).max(10000).optional(),
  warmupEligible: z.boolean().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["pending", "connecting", "connected", "warning", "disabled", "error"]).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderInfrastructureSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270124120000_growth_sender_infrastructure.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const senders = await listSenderAccounts(access.admin)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER,
      privacy_note: GROWTH_SENDER_INFRASTRUCTURE_PRIVACY_NOTE,
      senders,
      providerCapabilities: listSenderProviderCapabilities(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "sender_list_failed", message: error instanceof Error ? error.message : "Could not load senders." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderInfrastructureSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270124120000_growth_sender_infrastructure.sql, then reload.",
      },
      { status: 503 },
    )
  }

  const parsed = CreateSenderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sender payload." }, { status: 400 })
  }

  try {
    const sender = await createSenderAccount(access.admin, {
      provider_family: parsed.data.providerFamily,
      display_name: parsed.data.displayName,
      email_address: parsed.data.emailAddress,
      provider_connection_id: parsed.data.providerConnectionId ?? null,
      daily_send_limit: parsed.data.dailySendLimit,
      warmup_eligible: parsed.data.warmupEligible,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, sender }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create sender."
    return NextResponse.json({ error: "sender_create_failed", message }, { status: 500 })
  }
}
