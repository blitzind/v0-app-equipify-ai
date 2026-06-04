import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { sendSms } from "@/lib/growth/sms/send-sms"
import { isGrowthSmsSchemaReady } from "@/lib/growth/sms/schema-health"
import { GROWTH_SMS_INFRASTRUCTURE_QA_MARKER } from "@/lib/growth/sms/sms-architecture-audit"

export const runtime = "nodejs"

const SendSmsSchema = z.object({
  leadId: z.string().uuid(),
  toE164: z.string().trim().min(8).max(20),
  body: z.string().trim().min(1).max(1600),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSmsSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = SendSmsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid SMS send payload." }, { status: 400 })
  }

  try {
    const origin = new URL(request.url).origin
    const result = await sendSms(access.admin, {
      leadId: parsed.data.leadId,
      toE164: parsed.data.toE164,
      body: parsed.data.body,
      idempotencyKey: parsed.data.idempotencyKey,
      actingUserId: access.userId,
      requestOrigin: origin,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.code, message: result.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SMS_INFRASTRUCTURE_QA_MARKER,
      deliveryAttemptId: result.deliveryAttemptId,
      conversationId: result.conversationId,
      messageId: result.messageId,
      providerMessageId: result.providerMessageId,
      status: result.status,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "sms_send_failed", message }, { status: 500 })
  }
}
