import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { normalizeLeadIntakeSource } from "@/lib/growth/revenue-workflow/normalize-lead-intake-source"
import { LEAD_INTAKE_SOURCES } from "@/lib/growth/revenue-workflow/unified-lead-intake-types"
import { isUnifiedRevenueWorkflowEnabled } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-feature"
import { runUnifiedRevenueWorkflow } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-orchestrator"

export const runtime = "nodejs"

const optionalText = z.string().trim().max(500).optional().nullable()
const optionalEmail = z.string().trim().email().max(320).optional().nullable().or(z.literal(""))

const BodySchema = z.object({
  source: z.enum(LEAD_INTAKE_SOURCES),
  company: z
    .object({
      name: optionalText,
      website: optionalText,
      domain: optionalText,
      industry: optionalText,
      companyId: z.string().uuid().optional().nullable(),
    })
    .optional(),
  contact: z
    .object({
      name: optionalText,
      firstName: optionalText,
      lastName: optionalText,
      title: optionalText,
      email: optionalEmail,
      phone: optionalText,
      linkedinUrl: optionalText,
      personId: z.string().optional().nullable(),
      contactId: z.string().optional().nullable(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!isUnifiedRevenueWorkflowEnabled()) {
    return NextResponse.json(
      { ok: false, enabled: false, message: "unified_revenue_workflow_disabled" },
      { status: 503 },
    )
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "invalid_request" }, { status: 400 })
  }

  const intake = normalizeLeadIntakeSource(parsed.data)

  try {
    const result = await runUnifiedRevenueWorkflow({
      admin: access.admin,
      organizationId: getGrowthEngineAiOrgId(),
      actor: { userId: access.userId, email: access.userEmail },
      intake,
    })

    logGrowthEngine("unified_revenue_workflow_api", {
      source: intake.source,
      leadId: result.leadId ?? null,
      approvalRequired: result.approvalRequired,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: result.blockers.filter((blocker) => blocker.endsWith("_required") || blocker.endsWith("_disabled")).length === 0,
      enabled: true,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "workflow_failed"
    return NextResponse.json({ ok: false, enabled: true, message }, { status: 500 })
  }
}
