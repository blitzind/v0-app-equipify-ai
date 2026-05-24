import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { assignGrowthLead } from "@/lib/growth/assignment/assign-lead"
import { fetchGrowthAssignmentSettings, updateGrowthAssignmentSettings } from "@/lib/growth/assignment/assignment-settings-repository"
import { isManualAssignmentProtected, selectAssignmentRepForLead } from "@/lib/growth/assignment/assignment-engine"
import {
  fetchLatestGrowthAssignmentRun,
  insertGrowthAssignmentRun,
  listUnassignedGrowthLeads,
} from "@/lib/growth/assignment/assignment-repository"
import {
  GROWTH_ASSIGNMENT_DEFAULT_BATCH_SIZE,
  GROWTH_LEAD_ASSIGNMENT_QA_MARKER,
  type GrowthAssignmentRunResult,
} from "@/lib/growth/assignment/assignment-types"
import { listGrowthRepRoster } from "@/lib/growth/assignment/rep-roster-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  emitGrowthLeadAssignmentRuleAppliedTimeline,
  emitGrowthLeadAssignmentSkippedTimeline,
} from "@/lib/growth/timeline-emitter"

export async function runGrowthLeadAssignmentEngine(
  admin: SupabaseClient,
  input: {
    actingUserId: string
    actingUserEmail: string
    limit?: number
    dryRun?: boolean
  },
): Promise<GrowthAssignmentRunResult> {
  const limit = input.limit ?? GROWTH_ASSIGNMENT_DEFAULT_BATCH_SIZE
  const dryRun = input.dryRun === true
  const warnings: string[] = []

  const [settings, reps, candidates] = await Promise.all([
    fetchGrowthAssignmentSettings(admin),
    listGrowthRepRoster(admin),
    listUnassignedGrowthLeads(admin, limit),
  ])

  const activeReps = reps.filter((rep) => rep.status === "active")
  if (activeReps.length === 0) {
    warnings.push("No active reps configured in roster.")
  }

  const counts = {
    scanned: candidates.length,
    assigned: 0,
    skippedManual: 0,
    skippedCapacity: 0,
    skippedNoRep: 0,
    failed: 0,
  }

  for (const candidate of candidates) {
    try {
      const lead = await fetchGrowthLeadById(admin, candidate.id)
      if (!lead || lead.assignedTo) continue

      if (isManualAssignmentProtected(lead.assignmentSource)) {
        counts.skippedManual += 1
        if (!dryRun) {
          await emitGrowthLeadAssignmentSkippedTimeline(admin, {
            leadId: lead.id,
            reason: "manual_owner_protected",
            actor: { userId: input.actingUserId, email: input.actingUserEmail },
          })
        }
        continue
      }

      const selection = selectAssignmentRepForLead({ lead, reps: activeReps, settings })
      if (!selection) {
        const allAtCapacity = activeReps.length > 0 && activeReps.every((rep) => rep.isOverCapacity)
        if (allAtCapacity) {
          counts.skippedCapacity += 1
          if (!dryRun) {
            await emitGrowthLeadAssignmentSkippedTimeline(admin, {
              leadId: lead.id,
              reason: "all_reps_at_capacity",
              actor: { userId: input.actingUserId, email: input.actingUserEmail },
            })
          }
        } else {
          counts.skippedNoRep += 1
          if (!dryRun) {
            await emitGrowthLeadAssignmentSkippedTimeline(admin, {
              leadId: lead.id,
              reason: "no_eligible_rep",
              actor: { userId: input.actingUserId, email: input.actingUserEmail },
            })
          }
        }
        continue
      }

      if (dryRun) {
        counts.assigned += 1
        continue
      }

      const result = await assignGrowthLead(admin, {
        leadId: lead.id,
        assignedToUserId: selection.rep.userId,
        source: "rule",
        actingUserId: input.actingUserId,
        actingUserEmail: input.actingUserEmail,
        repLabel: selection.rep.displayName ?? selection.rep.email,
      })

      if (!result.ok) {
        if (result.code === "rep_over_capacity" || result.code === "rep_daily_limit") {
          counts.skippedCapacity += 1
          await emitGrowthLeadAssignmentSkippedTimeline(admin, {
            leadId: lead.id,
            reason: result.code,
            actor: { userId: input.actingUserId, email: input.actingUserEmail },
          })
        } else {
          counts.failed += 1
        }
        continue
      }

      await emitGrowthLeadAssignmentRuleAppliedTimeline(admin, {
        leadId: lead.id,
        assignedToUserId: selection.rep.userId,
        assignedToLabel: selection.rep.displayName ?? selection.rep.email,
        reasons: selection.reasons,
        actor: { userId: input.actingUserId, email: input.actingUserEmail },
      })

      await updateGrowthAssignmentSettings(admin, {
        roundRobinCursorUserId: selection.rep.userId,
        updatedBy: input.actingUserId,
      })

      counts.assigned += 1
    } catch (error) {
      counts.failed += 1
      logGrowthEngine("assignment_engine_lead_failed", {
        leadId: candidate.id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  let runId: string | null = null
  if (!dryRun) {
    const run = await insertGrowthAssignmentRun(admin, {
      runMode: "live",
      ...counts,
      createdBy: input.actingUserId,
      metadata: { qaMarker: GROWTH_LEAD_ASSIGNMENT_QA_MARKER, warnings },
    })
    runId = run.id
  }

  logGrowthEngine("assignment_engine_run_completed", { dryRun, ...counts, runId, warnings })

  return {
    ...counts,
    dryRun,
    qaMarker: GROWTH_LEAD_ASSIGNMENT_QA_MARKER,
    runId,
    warnings,
  }
}

export async function fetchGrowthAssignmentEngineStatus(admin: SupabaseClient) {
  const [lastRun, reps, settings] = await Promise.all([
    fetchLatestGrowthAssignmentRun(admin),
    listGrowthRepRoster(admin),
    fetchGrowthAssignmentSettings(admin),
  ])

  return {
    qaMarker: GROWTH_LEAD_ASSIGNMENT_QA_MARKER,
    lastRun,
    activeRepCount: reps.filter((rep) => rep.status === "active").length,
    overCapacityRepCount: reps.filter((rep) => rep.isOverCapacity).length,
    settings,
  }
}
