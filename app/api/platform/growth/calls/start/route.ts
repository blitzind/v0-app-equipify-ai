import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { startGrowthNativeCall } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER, NATIVE_DIALER_QUEUE_MODES } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE,
  isGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

const bodySchema = z.object({
  leadId: z.string().uuid().optional().nullable(),
  phoneNumber: z.string().min(3),
  dialMode: z.enum([...NATIVE_DIALER_QUEUE_MODES, "inbound"]).optional(),
  queueItemId: z.string().uuid().optional().nullable(),
  contactName: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  direction: z.enum(["outbound", "inbound"]).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthNativeDialerSchemaReady(access.admin))) {
    return NextResponse.json(
      { ok: false, message: GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid call start payload." }, { status: 400 })
  }

  try {
    const session = await startGrowthNativeCall(access.admin, {
      leadId: parsed.data.leadId ?? null,
      ownerUserId: access.userId,
      phoneNumber: parsed.data.phoneNumber,
      dialMode: parsed.data.dialMode,
      queueItemId: parsed.data.queueItemId ?? null,
      contactName: parsed.data.contactName ?? null,
      companyName: parsed.data.companyName ?? null,
      direction: parsed.data.direction,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      session,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start call."
    return NextResponse.json({ error: "start_failed", message }, { status: 500 })
  }
}
