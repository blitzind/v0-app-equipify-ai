import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  assertProspectDiscoveryExecuteAllowed,
  executeProspectDiscoveryFoundationCertification,
  validateProspectDiscoveryCertificationConfirmation,
} from "@/lib/growth/prospect-discovery/prospect-search-certification"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertProspectDiscoveryExecuteAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json(
      { ok: false, blockers: gateCheck.blockers },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = validateProspectDiscoveryCertificationConfirmation(body)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }

  const report = executeProspectDiscoveryFoundationCertification({ dry_run: parsed.dry_run })
  return NextResponse.json(report, { status: report.ok ? 200 : 422 })
}
