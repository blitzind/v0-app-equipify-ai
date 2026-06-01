import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchNativeCallWrapupBySessionId } from "@/lib/growth/native-dialer/native-dialer-repository"
import { submitGrowthNativeCallWrapup } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER, NATIVE_CALL_WRAPUP_OUTCOMES } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  requireGrowthNativeDialerSchemaReadyWithBudget,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

const SCHEMA_PROBE_BUDGET_MS = 500

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

  const schemaGate = await requireGrowthNativeDialerSchemaReadyWithBudget(access.admin, SCHEMA_PROBE_BUDGET_MS)
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

  const rawBody = await request.json().catch(() => null)
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "invalid_body", message: "Invalid wrap-up payload." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    const sessionId = typeof (rawBody as Record<string, unknown>).sessionId === "string"
      ? ((rawBody as Record<string, unknown>).sessionId as string)
      : null
    if (sessionId && !sessionId.startsWith("pending-inbound-")) {
      const existing = await fetchNativeCallWrapupBySessionId(access.admin, sessionId).catch(() => null)
      if (existing) {
        return NextResponse.json({ ok: true, qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER, wrapup: existing })
      }
    }
    return NextResponse.json(
      {
        error: "invalid_body",
        message:
          sessionId?.startsWith("pending-inbound-")
            ? "Call session is still syncing. Wait a moment and try again."
            : "Invalid wrap-up payload.",
      },
      { status: 400 },
    )
  }

  try {
    const existing = await fetchNativeCallWrapupBySessionId(access.admin, parsed.data.sessionId)
    if (existing) {
      return NextResponse.json({ ok: true, qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER, wrapup: existing })
    }

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
