import "server-only"

import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { verifyGrowthCronRequest } from "@/lib/growth/runtime/growth-cron-auth"

export type GrowthProviderRuntimeDiagnosticsAuth =
  | { ok: true; method: "cron_secret" | "platform_admin" }
  | { ok: false; response: NextResponse }

export async function authorizeGrowthProviderRuntimeDiagnostics(
  request: Request,
): Promise<GrowthProviderRuntimeDiagnosticsAuth> {
  const cronFailure = verifyGrowthCronRequest(
    request,
    "platform/growth/providers/runtime-diagnostics",
  )
  if (!cronFailure) {
    return { ok: true, method: "cron_secret" }
  }

  const access = await requireGrowthEnginePlatformAccess()
  if (access.ok) {
    return { ok: true, method: "platform_admin" }
  }

  return { ok: false, response: cronFailure }
}
