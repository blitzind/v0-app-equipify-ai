import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthProviderDeliverySchemaReady } from "@/lib/growth/providers/provider-schema-health"
import { isGrowthLiveProviderTransportSchemaReady } from "@/lib/growth/providers/transport/transport-schema-health"
import {
  TransportHumanApprovalRequiredError,
  executeTransportSend,
} from "@/lib/growth/providers/transport/transport-orchestrator"
import { GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE } from "@/lib/growth/providers/adapters/provider-adapter-types"

export const runtime = "nodejs"

const SendSchema = z.object({
  senderAccountId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  html: z.string().optional(),
  text: z.string().optional(),
  leadId: z.string().uuid().optional(),
  sequenceEnrollmentId: z.string().uuid().optional(),
  humanApproved: z.literal(true),
  humanApprovalConfirmed: z.literal(true),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Provider delivery schema missing." }, { status: 503 })
  }

  if (!(await isGrowthLiveProviderTransportSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270408120000_growth_live_provider_transport.sql, then reload.",
      },
      { status: 503 },
    )
  }

  const parsed = SendSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid send payload. Human approval is required." }, { status: 400 })
  }

  try {
    const result = await executeTransportSend(access.admin, {
      sender_account_id: parsed.data.senderAccountId,
      to: parsed.data.to,
      subject: parsed.data.subject,
      html: parsed.data.html,
      text: parsed.data.text,
      lead_id: parsed.data.leadId ?? null,
      sequence_enrollment_id: parsed.data.sequenceEnrollmentId ?? null,
      human_approved: true,
      human_approval_confirmed: true,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: result.ok,
      attempt: result.attempt,
      provider_message_id: result.provider_message_id,
      used_fallback: result.used_fallback ?? false,
      requires_human_review: result.requires_human_review ?? false,
      error: result.error,
      privacy_note: GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE,
    })
  } catch (error) {
    if (error instanceof TransportHumanApprovalRequiredError) {
      return NextResponse.json(
        { error: "human_approval_required", message: "Human approval confirmation is required before sending." },
        { status: 403 },
      )
    }
    return NextResponse.json(
      {
        error: "transport_send_failed",
        message: error instanceof Error ? error.message : "Could not execute transport send.",
      },
      { status: 500 },
    )
  }
}
