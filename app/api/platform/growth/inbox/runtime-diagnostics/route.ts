import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { summarizeGrowthColdStorageRuntime } from "@/lib/growth/runtime/growth-cold-storage-runtime"
import { GROWTH_INBOX_MINIMAL_RUNTIME_DIAGNOSTICS_VERSION } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-diagnostics"
import { resolveGrowthRuntimeProfileId } from "@/lib/growth/runtime/growth-runtime-profile"
import {
  GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES,
  GROWTH_INBOX_MINIMAL_RUNTIME_QA_MARKER,
  GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES,
  GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES,
} from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"

export const runtime = "nodejs"

/** Lightweight cold-storage + inbox contract diagnostics (no dashboard hydration). */
export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_INBOX_MINIMAL_RUNTIME_QA_MARKER,
    version: GROWTH_INBOX_MINIMAL_RUNTIME_DIAGNOSTICS_VERSION,
    profileId: resolveGrowthRuntimeProfileId(),
    server: summarizeGrowthColdStorageRuntime(),
    contract: {
      initialLoadRoutes: [...GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES],
      selectedThreadRoutes: [...GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES],
      tier3OnDemandRoutes: [...GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES],
    },
    clientMetricsNote:
      "Browser session fetch metrics are recorded client-side via summarizeGrowthInboxMinimalRuntimeDiagnostics().",
  })
}
