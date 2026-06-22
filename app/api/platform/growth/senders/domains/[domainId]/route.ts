import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { updateSenderDomain } from "@/lib/growth/sender/sender-repository"
import { isGrowthSenderInfrastructureSchemaReady } from "@/lib/growth/sender/sender-schema-health"

export const runtime = "nodejs"

const UpdateDomainSchema = z.object({
  spfValid: z.boolean().optional(),
  dkimValid: z.boolean().optional(),
  dmarcValid: z.boolean().optional(),
  mxValid: z.boolean().optional(),
  bounceRate: z.number().min(0).max(1).nullable().optional(),
  replyRate: z.number().min(0).max(1).nullable().optional(),
  spamRisk: z.number().min(0).max(100).nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ domainId: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderInfrastructureSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { domainId } = await context.params
  const parsed = UpdateDomainSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid domain update payload." }, { status: 400 })
  }

  try {
    const domain = await updateSenderDomain(access.admin, domainId, {
      spf_valid: parsed.data.spfValid,
      dkim_valid: parsed.data.dkimValid,
      dmarc_valid: parsed.data.dmarcValid,
      mx_valid: parsed.data.mxValid,
      bounce_rate: parsed.data.bounceRate,
      reply_rate: parsed.data.replyRate,
      spam_risk: parsed.data.spamRisk,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, domain })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed."
    const status = message === "domain_not_found" ? 404 : 500
    return NextResponse.json({ error: "domain_update_failed", message }, { status })
  }
}
