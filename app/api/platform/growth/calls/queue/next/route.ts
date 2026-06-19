import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchNextGrowthNativeDialerQueueItem } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_CALL_WORKSPACE_OPS_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-operator-types"
import { GROWTH_NATIVE_DIALER_QA_MARKER, NATIVE_DIALER_QUEUE_MODES } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  requireGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaGate = await requireGrowthNativeDialerSchemaReady(access.admin)
  if (!schemaGate.ok) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      opsMarker: GROWTH_CALL_WORKSPACE_OPS_QA_MARKER,
      meta: growthNativeDialerSchemaResponseMeta(schemaGate.probe),
      nextItem: null,
    })
  }

  const url = new URL(request.url)
  const excludeQueueItemId = url.searchParams.get("excludeQueueItemId")
  const modesParam = url.searchParams.get("modes")
  const modes = modesParam
    ? modesParam.split(",").filter((value): value is (typeof NATIVE_DIALER_QUEUE_MODES)[number] =>
        NATIVE_DIALER_QUEUE_MODES.includes(value as (typeof NATIVE_DIALER_QUEUE_MODES)[number]),
      )
    : undefined

  try {
    const nextItem = await fetchNextGrowthNativeDialerQueueItem(access.admin, {
      excludeQueueItemId:
        excludeQueueItemId && z.string().uuid().safeParse(excludeQueueItemId).success ? excludeQueueItemId : null,
      modes,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      opsMarker: GROWTH_CALL_WORKSPACE_OPS_QA_MARKER,
      nextItem,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load next queue item."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
