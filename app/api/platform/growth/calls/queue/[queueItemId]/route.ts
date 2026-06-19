import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyGrowthNativeDialerQueueAction } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_CALL_WORKSPACE_OPS_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-operator-types"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  requireGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

const ActionSchema = z.object({
  action: z.enum(["preview", "skip", "snooze", "complete"]),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ queueItemId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaGate = await requireGrowthNativeDialerSchemaReady(access.admin)
  if (!schemaGate.ok) {
    return NextResponse.json(
      { ok: false, message: schemaGate.probe.setupMessage, meta: growthNativeDialerSchemaResponseMeta(schemaGate.probe) },
      { status: schemaGate.status },
    )
  }

  const { queueItemId } = await context.params
  if (!z.string().uuid().safeParse(queueItemId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid queue item id." }, { status: 400 })
  }

  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid queue action." }, { status: 400 })
  }

  try {
    const item = await applyGrowthNativeDialerQueueAction(access.admin, {
      queueItemId,
      action: parsed.data.action,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      opsMarker: GROWTH_CALL_WORKSPACE_OPS_QA_MARKER,
      item,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Queue action failed."
    return NextResponse.json({ error: "queue_action_failed", message }, { status: 500 })
  }
}
