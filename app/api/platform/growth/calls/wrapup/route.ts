import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { submitGrowthNativeCallWrapup } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER, NATIVE_CALL_WRAPUP_OUTCOMES } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE,
  isGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  companyName: z.string().optional().nullable(),
  outcome: z.enum(NATIVE_CALL_WRAPUP_OUTCOMES),
  leftVoicemail: z.boolean().optional(),
  noAnswer: z.boolean().optional(),
  connected: z.boolean().optional(),
  meetingBooked: z.boolean().optional(),
  followUpNeeded: z.boolean().optional(),
  objectionCategory: z.string().optional().nullable(),
  buyingSignals: z.array(z.string()).optional(),
  competitorMentioned: z.boolean().optional(),
  timelineDetected: z.boolean().optional(),
  budgetDetected: z.boolean().optional(),
  championIdentified: z.boolean().optional(),
  decisionMakerPresent: z.boolean().optional(),
  notes: z.string().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthNativeDialerSchemaReady(access.admin))) {
    return NextResponse.json({ ok: false, message: GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE }, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid wrap-up payload." }, { status: 400 })
  }

  try {
    const wrapup = await submitGrowthNativeCallWrapup(access.admin, {
      sessionId: parsed.data.sessionId,
      ownerUserId: access.userId,
      companyName: parsed.data.companyName ?? undefined,
      wrapup: parsed.data,
    })
    return NextResponse.json({ ok: true, qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER, wrapup })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save wrap-up."
    return NextResponse.json({ error: "wrapup_failed", message }, { status: 500 })
  }
}
