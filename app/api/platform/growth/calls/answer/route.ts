import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { answerGrowthNativeCall } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE,
  isGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

const bodySchema = z.object({
  sessionId: z.string().uuid(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthNativeDialerSchemaReady(access.admin))) {
    return NextResponse.json({ ok: false, message: GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE }, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid answer payload." }, { status: 400 })
  }

  try {
    const session = await answerGrowthNativeCall(access.admin, parsed.data.sessionId)
    return NextResponse.json({ ok: true, qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER, session })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not answer call."
    return NextResponse.json({ error: "answer_failed", message }, { status: 500 })
  }
}
