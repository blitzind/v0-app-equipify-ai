import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { recordEmailComplaint } from "@/lib/growth/compliance/complaint-engine"
import { isGrowthComplianceSchemaReady } from "@/lib/growth/compliance/compliance-schema-health"
import { GROWTH_COMPLAINT_TYPES, GROWTH_COMPLIANCE_PRIVACY_NOTE } from "@/lib/growth/compliance/compliance-types"

export const runtime = "nodejs"

const bodySchema = z.object({
  deliveryAttemptId: z.string().uuid(),
  complaintType: z.enum(GROWTH_COMPLAINT_TYPES),
  providerReason: z.string().max(500).optional().nullable(),
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
    const result = await recordEmailComplaint(access.admin, parsed.data)
    return NextResponse.json({
      ok: true,
      recorded: result.recorded,
      privacy_note: GROWTH_COMPLIANCE_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "complaint_record_failed", message }, { status: 500 })
  }
}
