import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { registerUnsubscribe } from "@/lib/growth/compliance/suppression-engine"
import { isGrowthComplianceSchemaReady } from "@/lib/growth/compliance/compliance-schema-health"
import { GROWTH_COMPLIANCE_PRIVACY_NOTE, GROWTH_UNSUBSCRIBE_SCOPES } from "@/lib/growth/compliance/compliance-types"

export const runtime = "nodejs"

const bodySchema = z.object({
  email: z.string().email(),
  scope: z.enum(GROWTH_UNSUBSCRIBE_SCOPES).optional(),
  organizationId: z.string().uuid().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  source: z.string().max(120).optional(),
  leadId: z.string().uuid().optional().nullable(),
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
    const result = await registerUnsubscribe(access.admin, parsed.data)
    return NextResponse.json({
      ok: result.ok,
      emailHash: result.emailHash,
      privacy_note: GROWTH_COMPLIANCE_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "unsubscribe_failed", message }, { status: 500 })
  }
}
