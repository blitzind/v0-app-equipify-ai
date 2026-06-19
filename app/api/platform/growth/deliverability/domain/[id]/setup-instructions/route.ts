import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildDomainDeliverabilitySetupInstructions } from "@/lib/growth/deliverability/domain-deliverability-setup-service"
import { isGrowthDnsDeliverabilitySchemaReady } from "@/lib/growth/deliverability/deliverability-schema-health"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDnsDeliverabilitySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const instructions = await buildDomainDeliverabilitySetupInstructions(access.admin, id)
    if (!instructions) {
      return NextResponse.json({ error: "domain_not_found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, instructions })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Setup instructions failed."
    return NextResponse.json({ error: "setup_instructions_failed", message }, { status: 500 })
  }
}
