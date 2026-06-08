import { NextResponse } from "next/server"
import { runGrowthPdlTestLookup } from "@/lib/growth/contact-discovery/contact-discovery-provider-health-repository"
import { authorizeGrowthProviderRuntimeDiagnostics } from "@/lib/growth/qa/growth-provider-runtime-diagnostics-auth"
import { buildGrowthProviderRuntimeDiagnosticsSnapshot } from "@/lib/growth/qa/growth-provider-runtime-diagnostics"
import { GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER } from "@/lib/growth/qa/pdl-runtime-validation-types"
import {
  isPdlApiConfigured,
  isPdlDiscoveryDisabled,
  isPdlSandboxEnabled,
} from "@/lib/growth/providers/pdl/pdl-config"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await authorizeGrowthProviderRuntimeDiagnostics(request)
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const company_name = typeof body.company_name === "string" ? body.company_name.trim() : ""
  const domain = typeof body.domain === "string" ? body.domain.trim() : null
  const sandbox = body.sandbox === true
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.min(Math.max(body.limit, 1), 5)
      : 3

  const diagnostics = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)
  const lookup = await runGrowthPdlTestLookup({
    company_name,
    domain,
    limit,
    sandbox,
  })

  return NextResponse.json({
    ok: lookup.ok,
    qa_marker: GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER,
    auth_method: auth.method,
    provider_config: {
      pdl_configured: isPdlApiConfigured(),
      pdl_discovery_disabled: isPdlDiscoveryDisabled(),
      sandbox_mode: isPdlSandboxEnabled(),
      production_ready: isPdlApiConfigured() && !isPdlDiscoveryDisabled() && !isPdlSandboxEnabled(),
      winning_key: diagnostics.loaders.pdl_winning_key,
    },
    lookup,
    diagnostics,
  })
}

export async function GET(request: Request) {
  const auth = await authorizeGrowthProviderRuntimeDiagnostics(request)
  if (!auth.ok) return auth.response

  const diagnostics = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)
  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER,
    auth_method: auth.method,
    provider_config: {
      pdl_configured: isPdlApiConfigured(),
      pdl_discovery_disabled: isPdlDiscoveryDisabled(),
      sandbox_mode: isPdlSandboxEnabled(),
      production_ready: isPdlApiConfigured() && !isPdlDiscoveryDisabled() && !isPdlSandboxEnabled(),
      winning_key: diagnostics.loaders.pdl_winning_key,
    },
    diagnostics,
  })
}
