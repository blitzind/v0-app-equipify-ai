/**
 * GE-AIOS-OPERATOR-UX-1A — Completed Work lifecycle actions.
 * Orchestrates existing lead archive/restore + Draft Factory/package stop. No send.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { stopAutonomousWorkForLead } from "@/lib/growth/aios/approvals/completed-work-lifecycle-propagation"
import { GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER } from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import { archiveGrowthLeads, fetchGrowthLeadById, restoreGrowthLeads } from "@/lib/growth/lead-repository"
import { mapGrowthLeadArchiveApiError } from "@/lib/growth/lead-archive-api-errors"
import { emitGrowthLeadStatusChangedTimeline } from "@/lib/growth/timeline-emitter"
import { createPostgresDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-core"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BodySchema = z.object({
  action: z.enum(["cancel_work", "archive_account", "restore_account", "delete_permanently", "preview_delete"]),
  leadId: z.string().uuid(),
  packageId: z.string().min(1).max(400).optional().nullable(),
  confirmation: z.string().max(200).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER, error: "organization_required" },
      { status: 400 },
    )
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER, error: "invalid_body" },
      { status: 400 },
    )
  }

  const lead = await fetchGrowthLeadById(access.admin, body.leadId)
  if (!lead) {
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER, error: "lead_not_found" },
      { status: 404 },
    )
  }

  try {
    if (body.action === "preview_delete" || body.action === "delete_permanently") {
      const repo = createPostgresDraftFactoryRepository(access.admin)
      const df = await repo.getLeadState(organizationId, body.leadId).catch(() => null)
      const runs = await listOutreachPreparationRunsForLead(
        access.admin,
        organizationId,
        body.leadId,
      ).catch(() => [])
      const preview = {
        companyName: lead.companyName,
        leadId: lead.id,
        packageCount: runs.filter((run) => run.packageId).length,
        contactPresent: Boolean(lead.contactEmail || lead.contactPhone || lead.contactName),
        draftFactoryState: df?.state ?? null,
        relatedActiveItems: runs.filter(
          (run) =>
            run.approvalPackage?.pendingHumanApproval &&
            !run.approvalPackage.packageApprovalDecision,
        ).length,
        hardDeleteEnabled: false,
        note: "Hard delete is disabled for Growth leads. Permanent remove archives the account and stops autonomous work.",
      }

      if (body.action === "preview_delete") {
        return NextResponse.json({
          ok: true,
          qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
          preview,
          transportBlocked: true,
        })
      }

      const expected = `DELETE ${lead.companyName}`
      if ((body.confirmation ?? "").trim() !== expected) {
        return NextResponse.json(
          {
            ok: false,
            qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
            error: "confirmation_required",
            expectedConfirmation: expected,
            preview,
          },
          { status: 400 },
        )
      }

      const archived = await archiveGrowthLeads(access.admin, {
        leadIds: [body.leadId],
        archivedBy: access.userId,
        reason: body.reason ?? "Operator permanent remove from Completed Work",
      })
      const stop = await stopAutonomousWorkForLead(access.admin, {
        organizationId,
        leadId: body.leadId,
        reason: "operator_permanent_delete",
        packageId: body.packageId,
      })
      return NextResponse.json({
        ok: true,
        qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
        action: body.action,
        lead: archived[0] ?? lead,
        stop,
        preview,
        transportBlocked: true,
        message: "Account archived and autonomous work stopped. Hard delete remains disabled.",
      })
    }

    if (body.action === "cancel_work") {
      const stop = await stopAutonomousWorkForLead(access.admin, {
        organizationId,
        leadId: body.leadId,
        reason: "operator_canceled",
        packageId: body.packageId,
      })
      return NextResponse.json({
        ok: true,
        qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
        action: body.action,
        stop,
        transportBlocked: true,
        message:
          "Work canceled. Nothing will send. Account remains active unless you archive it separately.",
      })
    }

    if (body.action === "archive_account") {
      if (lead.archivedAt) {
        return NextResponse.json({
          ok: true,
          qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
          action: body.action,
          lead,
          alreadyArchived: true,
          transportBlocked: true,
        })
      }
      const archived = await archiveGrowthLeads(access.admin, {
        leadIds: [body.leadId],
        archivedBy: access.userId,
        reason: body.reason ?? "Archived from Completed Work",
      })
      if (lead.status !== "archived") {
        await emitGrowthLeadStatusChangedTimeline(access.admin, {
          leadId: body.leadId,
          from: lead.status,
          to: "archived",
          actor: { userId: access.userId, email: access.userEmail },
        })
      }
      const stop = await stopAutonomousWorkForLead(access.admin, {
        organizationId,
        leadId: body.leadId,
        reason: "lead_archived",
        packageId: body.packageId,
      })
      return NextResponse.json({
        ok: true,
        qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
        action: body.action,
        lead: archived[0] ?? null,
        stop,
        transportBlocked: true,
        message:
          "Account archived. Pending AI work stopped. Historical research and audit data remain.",
      })
    }

    if (body.action === "restore_account") {
      const restored = await restoreGrowthLeads(access.admin, {
        leadIds: [body.leadId],
        restoredBy: access.userId,
      })
      return NextResponse.json({
        ok: true,
        qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
        action: body.action,
        lead: restored[0] ?? null,
        transportBlocked: true,
        message:
          "Account restored to active leads. Canceled outreach packages are not rebuilt automatically.",
      })
    }

    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER, error: "unsupported_action" },
      { status: 400 },
    )
  } catch (error) {
    const mapped = mapGrowthLeadArchiveApiError(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
        error: mapped.error,
        message: mapped.message,
      },
      { status: mapped.status },
    )
  }
}
