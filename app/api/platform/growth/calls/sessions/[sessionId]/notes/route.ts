import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { updateGrowthNativeCallSessionNotes } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_CALL_WORKSPACE_OPS_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-operator-types"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  requireGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

const BodySchema = z.object({
  notesDraft: z.string().max(8000),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
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

  const { sessionId } = await context.params
  if (!z.string().uuid().safeParse(sessionId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid session id." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid notes payload." }, { status: 400 })
  }

  try {
    const session = await updateGrowthNativeCallSessionNotes(access.admin, sessionId, parsed.data.notesDraft)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      opsMarker: GROWTH_CALL_WORKSPACE_OPS_QA_MARKER,
      session,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save call notes."
    return NextResponse.json({ error: "notes_save_failed", message }, { status: 500 })
  }
}
