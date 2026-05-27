import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { recordEmailBounce } from "@/lib/growth/compliance/compliance-repository"
import { isGrowthComplianceSchemaReady } from "@/lib/growth/compliance/compliance-schema-health"
import { GROWTH_COMPLIANCE_PRIVACY_NOTE } from "@/lib/growth/compliance/compliance-types"

export const runtime = "nodejs"

const bodySchema = z.object({
  deliveryAttemptId: z.string().uuid(),
  providerCode: z.string().max(120).optional().nullable(),
  providerReason: z.string().max(500).optional().nullable(),
  bounceTypeHint: z.string().max(64).optional().nullable(),
  recipientEmail: z.string().email().optional().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthComplianceSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270410120000_growth_compliance_suppression.sql, then reload.",
      },
      { status: 503 },
    )
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", message: parsed.error.message }, { status: 400 })
  }

  try {
    const result = await recordEmailBounce(access.admin, {
      deliveryAttemptId: parsed.data.deliveryAttemptId,
      providerCode: parsed.data.providerCode,
      providerReason: parsed.data.providerReason,
      bounceTypeHint: parsed.data.bounceTypeHint,
      recipientEmail: parsed.data.recipientEmail,
    })
    return NextResponse.json({
      ok: true,
      recorded: result.recorded,
      classification: result.classification,
      privacy_note: GROWTH_COMPLIANCE_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "bounce_record_failed", message }, { status: 500 })
  }
}
