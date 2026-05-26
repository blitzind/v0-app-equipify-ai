import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runLeadEnginePipeline } from "@/lib/growth/lead-engine/orchestrator/lead-engine-orchestrator"
import {
  archiveLead,
  assignLeadOwner,
  claimLead,
  fetchLeadInboxById,
  markDuplicate,
  promoteToPipeline,
  saveLeadInboxMetadataPatch,
} from "@/lib/growth/lead-inbox/lead-inbox-repository"
import {
  buildDeterministicOperatorHandoffFromPipeline,
  buildLeadOperatorWorkspacePayload,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-builder"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  GROWTH_LEAD_INBOX_ACTIONS,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
  type GrowthLeadInboxAction,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  buildOperatorHandoffPackage,
  saveOperatorHandoffToLeadInbox,
} from "@/lib/growth/operator-handoff/operator-handoff-repository"
import { buildOperatorHandoffInputFromRow } from "@/lib/growth/lead-operator-workspace/lead-inbox-card-view"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

function parseAction(body: Record<string, unknown>): GrowthLeadInboxAction | null {
  const action = typeof body.action === "string" ? body.action.trim() : ""
  return GROWTH_LEAD_INBOX_ACTIONS.includes(action as GrowthLeadInboxAction)
    ? (action as GrowthLeadInboxAction)
    : null
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = parseAction(body)

  if (!action) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Invalid or missing action." },
      { status: 400 },
    )
  }

  const existing = await fetchLeadInboxById(access.admin, leadId)
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Lead inbox candidate not found." },
      { status: 404 },
    )
  }

  const ownerId =
    typeof body.ownerId === "string" && body.ownerId.trim()
      ? body.ownerId.trim()
      : access.userId

  let row = existing

  try {
    if (action === "claim") {
      const updated = await claimLead(access.admin, leadId, ownerId)
      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "transition_failed", message: "Could not claim lead." },
          { status: 409 },
        )
      }
      row = updated
    } else if (action === "assign_owner") {
      if (!ownerId) {
        return NextResponse.json(
          { ok: false, error: "validation_error", message: "ownerId is required." },
          { status: 400 },
        )
      }
      const updated = await assignLeadOwner(access.admin, leadId, ownerId)
      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "update_failed", message: "Could not assign owner." },
          { status: 500 },
        )
      }
      row = updated
    } else if (action === "approve") {
      const updated = await promoteToPipeline(access.admin, leadId, { status: "approved" })
      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "transition_failed", message: "Could not approve lead." },
          { status: 409 },
        )
      }
      row = updated
    } else if (action === "archive") {
      const updated = await archiveLead(access.admin, leadId)
      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "transition_failed", message: "Could not archive lead." },
          { status: 409 },
        )
      }
      row = updated
    } else if (action === "mark_duplicate") {
      const reason = typeof body.reason === "string" ? body.reason : undefined
      const updated = await markDuplicate(access.admin, leadId, reason)
      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "transition_failed", message: "Could not mark duplicate." },
          { status: 409 },
        )
      }
      row = updated
    } else if (action === "run_lead_engine") {
      await promoteToPipeline(access.admin, leadId, { status: "running_pipeline" })

      const run = runLeadEnginePipeline({
        companyName: existing.company_name || "Unknown Company",
        domain: existing.domain ?? "",
        industry: "",
        location: "",
        notes: existing.candidate_reasoning.join(" ") || "Lead inbox candidate context.",
      })

      const handoffOutput = buildDeterministicOperatorHandoffFromPipeline(existing, run)
      const handoffPkg = buildOperatorHandoffPackage(
        buildOperatorHandoffInputFromRow(existing),
        handoffOutput,
      )

      await saveOperatorHandoffToLeadInbox(access.admin, leadId, handoffPkg)

      const updated = await saveLeadInboxMetadataPatch(access.admin, leadId, {
        [GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]: run,
        lead_engine_last_run_at: new Date().toISOString(),
        lead_engine_note: "Fixture pipeline — human review required before outreach.",
      })

      row =
        (await promoteToPipeline(access.admin, leadId, {
          status: "pipeline_complete",
          lead_engine_run_id: null,
        })) ??
        updated ??
        existing
    }

    const workspace = await buildLeadOperatorWorkspacePayload(access.admin, row)

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
      action,
      workspace,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "action_failed", message }, { status: 500 })
  }
}
