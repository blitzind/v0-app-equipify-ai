import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthNativeDialerQueue } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER, NATIVE_DIALER_QUEUE_MODES } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  probeGrowthNativeDialerSchemaHealth,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaProbe = await probeGrowthNativeDialerSchemaHealth(access.admin)
  const meta = growthNativeDialerSchemaResponseMeta(schemaProbe)
  if (!schemaProbe.schemaReady) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      meta,
      queue: [],
    })
  }

  const url = new URL(request.url)
  const modeParam = url.searchParams.get("mode")
  const modes = modeParam
    ? modeParam.split(",").filter((value): value is (typeof NATIVE_DIALER_QUEUE_MODES)[number] =>
        NATIVE_DIALER_QUEUE_MODES.includes(value as (typeof NATIVE_DIALER_QUEUE_MODES)[number]),
      )
    : undefined

  try {
    const queue = await fetchGrowthNativeDialerQueue(access.admin, { limit: 50, modes })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      meta,
      queue,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load dialer queue."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
