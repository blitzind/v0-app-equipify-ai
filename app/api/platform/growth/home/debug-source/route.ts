import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthHomeDebugSourceReport } from "@/lib/growth/home/growth-home-debug-source"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"
import { isGrowthHomeProductionRuntime } from "@/lib/growth/home/growth-home-supabase-runtime-env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Production-only runtime source proof for /growth Home (GE-AVA-FRESH-SLATE-1C). */
export async function GET(request: Request) {
  if (!isGrowthHomeProductionRuntime()) {
    return NextResponse.json(
      { error: "not_available", message: "Home debug source is only available in production." },
      { status: 404 },
    )
  }

  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const report = await buildGrowthHomeDebugSourceReport({
      admin: access.admin,
      operatorEmail: access.userEmail,
      actorUserId: access.userId,
    })
    return growthHomeNoStoreJson(report)
  } catch (error) {
    return growthHomeNoStoreJson(
      {
        ok: false,
        error: "growth_home_debug_source_failed",
        message: error instanceof Error ? error.message : "Could not build Home debug source report.",
      },
      { status: 500 },
    )
  }
}
