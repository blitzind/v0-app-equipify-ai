import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import type { GrowthDiscoveryProviderControlName } from "@/lib/growth/prospect-search/prospect-search-discovery-provider-controls"
import {
  applyGrowthDiscoveryProviderToggle,
  clearGrowthProviderQueryCache,
  loadGrowthProspectSearchProviderHealth,
  rerunGrowthProviderHealthDiagnostics,
  testGrowthDiscoveryProvider,
} from "@/lib/growth/prospect-search/prospect-search-provider-health-repository"

export const runtime = "nodejs"

const ACTIONS = [
  "test_provider",
  "clear_cache",
  "toggle_provider",
  "rerun_diagnostics",
] as const

type ProviderHealthAction = (typeof ACTIONS)[number]

function parseProviderName(raw: unknown): GrowthDiscoveryProviderControlName | null {
  if (raw === "google_places" || raw === "serp") return raw
  return null
}

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const snapshot = await loadGrowthProspectSearchProviderHealth(access.admin)
  return NextResponse.json({ ok: true, snapshot })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = typeof body.action === "string" ? body.action.trim() : ""
  if (!ACTIONS.includes(action as ProviderHealthAction)) {
    return NextResponse.json({ ok: false, message: "Unknown provider health action." }, { status: 400 })
  }

  switch (action as ProviderHealthAction) {
    case "test_provider": {
      const provider = parseProviderName(body.provider_name)
      if (!provider) {
        return NextResponse.json({ ok: false, message: "provider_name required." }, { status: 400 })
      }
      const result = await testGrowthDiscoveryProvider(access.admin, provider)
      return NextResponse.json({ ok: result.ok, ...result })
    }
    case "clear_cache": {
      const cleared = await clearGrowthProviderQueryCache(access.admin)
      return NextResponse.json({
        ok: true,
        message: `Cleared ${cleared} provider cache row(s).`,
        cleared,
      })
    }
    case "toggle_provider": {
      const provider = parseProviderName(body.provider_name)
      if (!provider || typeof body.enabled !== "boolean") {
        return NextResponse.json(
          { ok: false, message: "provider_name and enabled required." },
          { status: 400 },
        )
      }
      applyGrowthDiscoveryProviderToggle(provider, body.enabled)
      return NextResponse.json({
        ok: true,
        message: `${provider} ${body.enabled ? "enabled" : "disabled"}.`,
      })
    }
    case "rerun_diagnostics": {
      rerunGrowthProviderHealthDiagnostics()
      const snapshot = await loadGrowthProspectSearchProviderHealth(access.admin)
      return NextResponse.json({
        ok: true,
        message: "Diagnostics refreshed.",
        snapshot,
      })
    }
    default:
      return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 })
  }
}
