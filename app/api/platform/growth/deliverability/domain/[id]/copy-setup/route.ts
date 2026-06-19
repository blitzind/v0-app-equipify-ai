import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { copyDomainDeliverabilitySetupFromSource } from "@/lib/growth/deliverability/domain-deliverability-setup-service"
import { isGrowthDnsDeliverabilitySchemaReady } from "@/lib/growth/deliverability/deliverability-schema-health"

export const runtime = "nodejs"

const CopySetupSchema = z.object({
  source_domain_id: z.string().uuid(),
})

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
  const parsed = CopySetupSchema.safeParse(await request.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "source_domain_id is required." }, { status: 400 })
  }

  try {
    const instructions = await copyDomainDeliverabilitySetupFromSource(
      access.admin,
      id,
      parsed.data.source_domain_id,
    )

    if (!instructions) {
      return NextResponse.json({ error: "domain_not_found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, instructions })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Copy setup failed."
    const status =
      message === "source_domain_not_found" || message === "copy_setup_same_domain" ? 400 : 500
    return NextResponse.json({ error: "copy_setup_failed", message }, { status })
  }
}
