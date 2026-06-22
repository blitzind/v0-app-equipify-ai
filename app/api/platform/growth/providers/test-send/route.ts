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
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"

export const runtime = "nodejs"

const TestSendSchema = z.object({
  senderAccountId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(500).optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  humanApproved: z.literal(true),
  humanApprovalConfirmed: z.literal(true),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
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

  const parsed = TestSendSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid test send payload. Confirm human approval in the modal." },
      { status: 400 },
    )
  }

  try {
    const defaultSubject = parsed.data.subject ?? "[Equipify] Live Send Test"
    const defaultText =
      parsed.data.text ??
      "This is a human-approved live send test from Growth Engine transport. Signature and sender merge fields render at send time."
    const prepared = await prepareOutboundEmailContent(access.admin, {
      senderAccountId: parsed.data.senderAccountId,
      subject: defaultSubject,
      bodyText: defaultText,
      htmlBody: parsed.data.html,
    })

    const result = await executeTransportSend(access.admin, {
      sender_account_id: parsed.data.senderAccountId,
      to: parsed.data.to,
      subject: prepared.subject,
      html: prepared.htmlBody,
      text: prepared.textBody,
      human_approved: true,
      human_approval_confirmed: true,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      is_test: true,
    })

    return NextResponse.json({
      ok: result.ok,
      attempt: result.attempt,
      provider_message_id: result.provider_message_id,
      used_fallback: result.used_fallback ?? false,
      error: result.error,
      privacy_note: GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE,
    })
  } catch (error) {
    if (error instanceof TransportHumanApprovalRequiredError) {
      return NextResponse.json(
        { error: "human_approval_required", message: "Human approval confirmation is required before test send." },
        { status: 403 },
      )
    }
    return NextResponse.json(
      {
        error: "transport_test_send_failed",
        message: error instanceof Error ? error.message : "Could not execute test send.",
      },
      { status: 500 },
    )
  }
}
