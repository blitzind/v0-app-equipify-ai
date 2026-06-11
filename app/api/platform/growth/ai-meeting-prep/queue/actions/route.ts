import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveAiMeetingPrep,
  rejectAiMeetingPrep,
  regenerateAiMeetingPrep,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-queue"

export const runtime = "nodejs"

type AiMeetingPrepQueueAction =
  | "approve_ai_meeting_prep"
  | "reject_ai_meeting_prep"
  | "regenerate_ai_meeting_prep"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = asString(body?.action) as AiMeetingPrepQueueAction
  const prepId = asString(body?.prepId) || asString(body?.prep_id)
  const note = asString(body?.note) || null

  if (!prepId) {
    return NextResponse.json({ ok: false, message: "prepId is required." }, { status: 400 })
  }

  const actor = {
    approver_user_id: access.userId,
    approver_email: access.userEmail,
    note,
  }

  let result
  switch (action) {
    case "approve_ai_meeting_prep":
      result = await approveAiMeetingPrep(access.admin, {
        prep_id: prepId,
        ...actor,
      })
      break
    case "reject_ai_meeting_prep":
      result = await rejectAiMeetingPrep(access.admin, {
        prep_id: prepId,
        ...actor,
      })
      break
    case "regenerate_ai_meeting_prep":
      result = await regenerateAiMeetingPrep(access.admin, {
        prep_id: prepId,
        actor_user_id: access.userId,
        actor_email: access.userEmail,
      })
      break
    default:
      return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 400 })
  }

  logGrowthEngine("ai_meeting_prep_queue_action", {
    action,
    prep_id: prepId,
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
    opportunity_created: false,
    autonomous_reply_sent: false,
  })

  return NextResponse.json({ ok: result.ok, result }, { status: result.ok ? 200 : 422 })
}
