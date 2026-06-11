import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveOpportunityDraft,
  rejectOpportunityDraft,
  regenerateOpportunityDraft,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-queue"

export const runtime = "nodejs"

type OpportunityDraftQueueAction =
  | "approve_opportunity_draft"
  | "reject_opportunity_draft"
  | "regenerate_opportunity_draft"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = asString(body?.action) as OpportunityDraftQueueAction
  const draftId = asString(body?.draftId) || asString(body?.draft_id)
  const note = asString(body?.note) || null

  if (!draftId) {
    return NextResponse.json({ ok: false, message: "draftId is required." }, { status: 400 })
  }

  const actor = {
    approver_user_id: access.userId,
    approver_email: access.userEmail,
    note,
  }

  let result
  switch (action) {
    case "approve_opportunity_draft":
      result = await approveOpportunityDraft(access.admin, {
        draft_id: draftId,
        ...actor,
      })
      break
    case "reject_opportunity_draft":
      result = await rejectOpportunityDraft(access.admin, {
        draft_id: draftId,
        ...actor,
      })
      break
    case "regenerate_opportunity_draft":
      result = await regenerateOpportunityDraft(access.admin, {
        draft_id: draftId,
        actor_user_id: access.userId,
        actor_email: access.userEmail,
      })
      break
    default:
      return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 400 })
  }

  logGrowthEngine("opportunity_draft_queue_action", {
    action,
    draft_id: draftId,
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    opportunity_created: false,
    crm_written: false,
    deal_created: false,
    calendar_written: false,
  })

  return NextResponse.json({ ok: result.ok, result }, { status: result.ok ? 200 : 422 })
}
