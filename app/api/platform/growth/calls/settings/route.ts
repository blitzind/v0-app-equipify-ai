import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthNativeDialerSettings,
  updateGrowthNativeDialerSettings,
} from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER, NATIVE_DIALER_PROVIDER_IDS } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  requireGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

const PatchSchema = z.object({
  primaryProvider: z.enum(NATIVE_DIALER_PROVIDER_IDS).optional(),
  fallbackProvider: z.enum(NATIVE_DIALER_PROVIDER_IDS).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaGate = await requireGrowthNativeDialerSchemaReady(access.admin)
  if (!schemaGate.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: schemaGate.probe.setupMessage,
        meta: growthNativeDialerSchemaResponseMeta(schemaGate.probe),
      },
      { status: schemaGate.status },
    )
  }

  try {
    const settings = await fetchGrowthNativeDialerSettings(access.admin)
    return NextResponse.json({ ok: true, qaMarker: GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load native dialer settings."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaGate = await requireGrowthNativeDialerSchemaReady(access.admin)
  if (!schemaGate.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: schemaGate.probe.setupMessage,
        meta: growthNativeDialerSchemaResponseMeta(schemaGate.probe),
      },
      { status: schemaGate.status },
    )
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid native dialer settings." }, { status: 400 })
  }

  try {
    const settings = await updateGrowthNativeDialerSettings(access.admin, parsed.data)
    return NextResponse.json({ ok: true, qaMarker: GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update native dialer settings."
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
