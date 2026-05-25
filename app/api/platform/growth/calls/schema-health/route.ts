import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_NATIVE_DIALER_SCHEMA_HEALTH_QA_MARKER,
  fetchGrowthNativeDialerSchemaAdminDiagnostics,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const diagnostics = await fetchGrowthNativeDialerSchemaAdminDiagnostics(access.admin)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      schemaHealthQaMarker: GROWTH_NATIVE_DIALER_SCHEMA_HEALTH_QA_MARKER,
      diagnostics,
    })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
        schemaHealthQaMarker: GROWTH_NATIVE_DIALER_SCHEMA_HEALTH_QA_MARKER,
        message: "Could not probe native dialer schema health.",
      },
      { status: 500 },
    )
  }
}
