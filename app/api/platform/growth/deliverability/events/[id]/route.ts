import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { resolveDeliverabilityEvent } from "@/lib/growth/deliverability/deliverability-events"
import { isGrowthDnsDeliverabilitySchemaReady } from "@/lib/growth/deliverability/deliverability-schema-health"

export const runtime = "nodejs"

export async function PATCH(
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
    const event = await resolveDeliverabilityEvent(access.admin, id)
    return NextResponse.json({ ok: true, event })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resolve event."
    const status = message === "deliverability_event_not_found" ? 404 : 500
    return NextResponse.json({ error: "deliverability_event_resolve_failed", message }, { status })
  }
}
