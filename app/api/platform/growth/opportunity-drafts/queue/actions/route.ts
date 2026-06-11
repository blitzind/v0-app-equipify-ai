import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveOpportunityDraft,
  createOpportunityFromApprovedDraft,
  rejectOpportunityDraft,
  regenerateOpportunityDraft,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-queue"
import type { GrowthOpportunityStageKey } from "@/lib/growth/opportunity-pipeline/pipeline-types"

export const runtime = "nodejs"

type OpportunityDraftQueueAction =
  | "approve_opportunity_draft"
  | "reject_opportunity_draft"
  | "regenerate_opportunity_draft"
  | "create_opportunity"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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
    case "create_opportunity":
      result = await createOpportunityFromApprovedDraft(access.admin, {
        draft_id: draftId,
        operator_id: access.userId,
        operator_email: access.userEmail,
        edits: {
          name: asString(body?.name) || null,
          estimated_value: asNumber(body?.estimated_value ?? body?.estimatedValue),
          stage: (asString(body?.stage) || null) as GrowthOpportunityStageKey | null,
          close_date: asString(body?.close_date ?? body?.closeDate) || null,
          owner_id: asString(body?.owner_id ?? body?.ownerId) || null,
          next_steps: Array.isArray(body?.next_steps)
            ? body.next_steps.filter((entry): entry is string => typeof entry === "string")
            : Array.isArray(body?.nextSteps)
              ? body.nextSteps.filter((entry): entry is string => typeof entry === "string")
              : undefined,
        },
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
    opportunity_id: result.opportunity_id ?? null,
    opportunity_created: action === "create_opportunity" && result.ok ? true : false,
    error: result.error ?? null,
    auto_created: false,
    human_confirmed: action === "create_opportunity",
    operator_required: action === "create_opportunity",
  })

  return NextResponse.json(
    {
      ok: result.ok,
      result,
      opportunity_created: action === "create_opportunity" && result.ok ? true : false,
      opportunity_id: result.opportunity_id ?? null,
      draft_status: result.status,
      attribution_chain: result.attribution_chain ?? null,
    },
    { status: result.ok ? 200 : 422 },
  )
}
