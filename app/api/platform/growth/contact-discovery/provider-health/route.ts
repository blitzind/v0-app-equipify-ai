import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  loadGrowthPdlProviderHealth,
  rerunGrowthPdlProviderHealthDiagnostics,
  runGrowthPdlTestLookup,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-health-repository"

export const runtime = "nodejs"

const ACTIONS = ["test_pdl_lookup", "rerun_diagnostics"] as const
type ContactDiscoveryProviderHealthAction = (typeof ACTIONS)[number]

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const snapshot = await loadGrowthPdlProviderHealth(access.admin)
  return NextResponse.json({ ok: true, snapshot })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = typeof body.action === "string" ? body.action.trim() : ""
  if (!ACTIONS.includes(action as ContactDiscoveryProviderHealthAction)) {
    return NextResponse.json({ ok: false, message: "Unknown contact discovery health action." }, {
      status: 400,
    })
  }

  switch (action as ContactDiscoveryProviderHealthAction) {
    case "test_pdl_lookup": {
      const company_name = typeof body.company_name === "string" ? body.company_name.trim() : ""
      const domain = typeof body.domain === "string" ? body.domain.trim() : null
      const sandbox = body.sandbox !== false
      const limit =
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.min(Math.max(body.limit, 1), 10)
          : 5

      const result = await runGrowthPdlTestLookup({
        company_name,
        domain,
        limit,
        sandbox,
      })
      const snapshot = await loadGrowthPdlProviderHealth(access.admin)
      return NextResponse.json({ ok: result.ok, result, snapshot })
    }
    case "rerun_diagnostics": {
      rerunGrowthPdlProviderHealthDiagnostics()
      const snapshot = await loadGrowthPdlProviderHealth(access.admin)
      return NextResponse.json({
        ok: true,
        message: "PDL provider diagnostics reset.",
        snapshot,
      })
    }
    default:
      return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 })
  }
}
