import { NextResponse } from "next/server"
import { authorizeGrowthProviderRuntimeDiagnostics } from "@/lib/growth/qa/growth-provider-runtime-diagnostics-auth"
import { buildGrowthProviderRuntimeDiagnosticsSnapshot } from "@/lib/growth/qa/growth-provider-runtime-diagnostics"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await authorizeGrowthProviderRuntimeDiagnostics(request)
  if (!auth.ok) return auth.response

  const snapshot = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)

  return NextResponse.json({
    ok: true,
    auth_method: auth.method,
    diagnostics: snapshot,
  })
}
