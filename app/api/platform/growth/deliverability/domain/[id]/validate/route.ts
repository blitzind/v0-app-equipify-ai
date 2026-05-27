import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { validateDeliverabilityDomain } from "@/lib/growth/deliverability/deliverability-repository"
import { isGrowthDnsDeliverabilitySchemaReady } from "@/lib/growth/deliverability/deliverability-schema-health"

export const runtime = "nodejs"

const ValidateDomainSchema = z
  .object({
    spf_valid: z.boolean().optional(),
    dkim_valid: z.boolean().optional(),
    dmarc_valid: z.boolean().optional(),
    mx_valid: z.boolean().optional(),
    mx_provider: z.string().trim().max(120).nullable().optional(),
  })
  .optional()

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDnsDeliverabilitySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  const parsed = ValidateDomainSchema.safeParse(await request.json().catch(() => undefined))

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid validation payload." }, { status: 400 })
  }

  try {
    const result = await validateDeliverabilityDomain(access.admin, id, {
      hints: parsed.data,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, ...result, stub_mode: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed."
    const status = message === "domain_not_found" ? 404 : 500
    return NextResponse.json({ error: "deliverability_validate_failed", message }, { status })
  }
}
