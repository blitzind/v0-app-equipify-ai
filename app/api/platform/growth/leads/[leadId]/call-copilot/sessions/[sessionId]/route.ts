import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_CALL_COPILOT_BUYING_SIGNAL_KEYS,
  GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_KEYS,
} from "@/lib/growth/call-copilot-types"
import { fetchGrowthCallCopilotSession } from "@/lib/growth/call-copilot-repository"
import {
  captureGrowthCallCopilotBuyingSignal,
  captureGrowthCallCopilotCommitmentSignal,
  discardGrowthCallCopilotSession,
  startGrowthCallCopilotSession,
  updateGrowthCallCopilotLiveNotes,
} from "@/lib/growth/run-call-copilot-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_call") }),
  z.object({ action: z.literal("discard") }),
  z.object({ action: z.literal("update_notes"), liveNotes: z.string().max(8000) }),
  z.object({
    action: z.literal("capture_buying_signal"),
    signalKey: z.enum(GROWTH_CALL_COPILOT_BUYING_SIGNAL_KEYS),
    note: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({
    action: z.literal("capture_commitment_signal"),
    signalKey: z.enum(GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_KEYS),
    note: z.string().trim().max(500).nullable().optional(),
  }),
])

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  try {
    const session = await fetchGrowthCallCopilotSession(access.admin, { leadId, sessionId })
    if (!session) {
      return NextResponse.json({ error: "not_found", message: "Session not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, session })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid session patch." }, { status: 400 })
  }

  try {
    let session
    switch (parsed.data.action) {
      case "start_call":
        session = await startGrowthCallCopilotSession(access.admin, {
          leadId,
          sessionId,
          createdBy: access.userId,
          actorEmail: access.userEmail,
        })
        break
      case "discard":
        session = await discardGrowthCallCopilotSession(access.admin, {
          leadId,
          sessionId,
          discardedBy: access.userId,
        })
        break
      case "update_notes":
        session = await updateGrowthCallCopilotLiveNotes(access.admin, {
          leadId,
          sessionId,
          liveNotes: parsed.data.liveNotes,
        })
        break
      case "capture_buying_signal":
        session = await captureGrowthCallCopilotBuyingSignal(access.admin, {
          leadId,
          sessionId,
          signalKey: parsed.data.signalKey,
          note: parsed.data.note,
          capturedBy: access.userId,
        })
        break
      case "capture_commitment_signal":
        session = await captureGrowthCallCopilotCommitmentSignal(access.admin, {
          leadId,
          sessionId,
          signalKey: parsed.data.signalKey,
          note: parsed.data.note,
          capturedBy: access.userId,
        })
        break
    }
    return NextResponse.json({ ok: true, session })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status =
      message === "not_found" ? 404 : message === "invalid_status" || message === "session_closed" ? 409 : 500
    return NextResponse.json({ error: message, message }, { status })
  }
}
