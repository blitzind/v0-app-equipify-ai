import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { isGrowthSenderInfrastructureSchemaReady } from "@/lib/growth/sender/sender-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderInfrastructureSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const domains = await listSenderDomains(access.admin)
    return NextResponse.json({ ok: true, domains })
  } catch (error) {
    return NextResponse.json(
      { error: "sender_domains_failed", message: error instanceof Error ? error.message : "Could not load domains." },
      { status: 500 },
    )
  }
}
