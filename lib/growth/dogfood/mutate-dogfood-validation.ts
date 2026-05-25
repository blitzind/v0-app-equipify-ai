import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import {
  confidenceForScorecard,
  GROWTH_DOGFOOD_SUBSYSTEM_LABELS,
  type GrowthDogfoodIssue,
  type GrowthDogfoodIssueSeverity,
  type GrowthDogfoodSubsystem,
  type GrowthDogfoodValidationRun,
  type GrowthDogfoodValidationStatus,
} from "@/lib/growth/dogfood/dogfood-types"
import {
  countOpenGrowthDogfoodIssues,
  insertGrowthDogfoodIssue,
  insertGrowthDogfoodValidationRun,
  listGrowthDogfoodIssues,
  updateGrowthDogfoodIssue,
} from "@/lib/growth/dogfood/dogfood-repository"

type Actor = { userId?: string | null; email?: string | null }

async function emitDogfoodRunNotifications(
  admin: SupabaseClient,
  run: GrowthDogfoodValidationRun,
) {
  if (run.status === "failed") {
    await emitGrowthNotification(admin, {
      ownerUserId: run.ownerUserId,
      notificationType: "dogfood_failure",
      title: "Dogfood validation failed",
      body: `${GROWTH_DOGFOOD_SUBSYSTEM_LABELS[run.subsystem]} validation failed — review notes and open issues.`,
      sourceSystem: "rep_ops",
      sourceId: run.id,
      actionUrl: "/admin/growth/dogfood",
      metadata: { subsystem: run.subsystem, runId: run.id },
    })
  }
  if (run.status === "validated") {
    await emitGrowthNotification(admin, {
      ownerUserId: run.ownerUserId,
      notificationType: "validation_complete",
      title: "Dogfood validation complete",
      body: `${GROWTH_DOGFOOD_SUBSYSTEM_LABELS[run.subsystem]} marked validated for Blitz dogfood.`,
      sourceSystem: "rep_ops",
      sourceId: run.id,
      actionUrl: "/admin/growth/dogfood",
      metadata: { subsystem: run.subsystem, runId: run.id },
    })
  }
}

async function emitDogfoodBlockerNotification(admin: SupabaseClient, issue: GrowthDogfoodIssue) {
  if (issue.severity !== "critical") return
  if (issue.status !== "open") return
  await emitGrowthNotification(admin, {
    ownerUserId: issue.ownerUserId,
    notificationType: "dogfood_blocker",
    title: "Dogfood critical blocker",
    body: `${issue.title} (${GROWTH_DOGFOOD_SUBSYSTEM_LABELS[issue.subsystem]}) blocks Blitz readiness.`,
    sourceSystem: "rep_ops",
    sourceId: issue.id,
    actionUrl: "/admin/growth/dogfood",
    metadata: { issueId: issue.id, subsystem: issue.subsystem },
  })
}

export async function recordGrowthDogfoodValidationRun(
  admin: SupabaseClient,
  input: {
    subsystem: GrowthDogfoodSubsystem
    status: GrowthDogfoodValidationStatus
    notes?: string | null
    ownerUserId?: string | null
    actor?: Actor
  },
): Promise<GrowthDogfoodValidationRun> {
  const issueCounts = await countOpenGrowthDogfoodIssues(admin)
  const subsystemIssues = issueCounts.bySubsystem.get(input.subsystem) ?? { open: 0, critical: 0 }
  const confidence = confidenceForScorecard({
    status: input.status,
    openIssueCount: subsystemIssues.open,
    criticalIssueCount: subsystemIssues.critical,
  })

  const run = await insertGrowthDogfoodValidationRun(admin, {
    subsystem: input.subsystem,
    status: input.status,
    notes: input.notes ?? "",
    owner_user_id: input.ownerUserId ?? input.actor?.userId ?? null,
    issue_count: subsystemIssues.open,
    confidence,
    run_at: new Date().toISOString(),
  })

  await emitDogfoodRunNotifications(admin, run)
  logGrowthEngine("dogfood_validation_run_recorded", { runId: run.id, subsystem: run.subsystem, status: run.status })
  return run
}

export async function createGrowthDogfoodIssue(
  admin: SupabaseClient,
  input: {
    title: string
    severity: GrowthDogfoodIssueSeverity
    subsystem: GrowthDogfoodSubsystem
    ownerUserId?: string | null
    reproductionNotes?: string | null
    actor?: Actor
  },
): Promise<GrowthDogfoodIssue> {
  const issue = await insertGrowthDogfoodIssue(admin, {
    title: input.title,
    severity: input.severity,
    subsystem: input.subsystem,
    owner_user_id: input.ownerUserId ?? input.actor?.userId ?? null,
    status: "open",
    reproduction_notes: input.reproductionNotes ?? "",
  })

  await emitDogfoodBlockerNotification(admin, issue)
  logGrowthEngine("dogfood_issue_created", { issueId: issue.id, subsystem: issue.subsystem, severity: issue.severity })
  return issue
}

export async function updateGrowthDogfoodIssueStatus(
  admin: SupabaseClient,
  input: {
    issueId: string
    status: GrowthDogfoodIssue["status"]
    fixedVersion?: string | null
    actor?: Actor
  },
): Promise<GrowthDogfoodIssue> {
  const patch: Record<string, unknown> = { status: input.status }
  if (input.fixedVersion !== undefined) patch.fixed_version = input.fixedVersion
  if (input.status === "fixed" || input.status === "wont_fix") {
    patch.resolved_at = new Date().toISOString()
  }
  const issue = await updateGrowthDogfoodIssue(admin, input.issueId, patch)
  logGrowthEngine("dogfood_issue_updated", { issueId: issue.id, status: issue.status })
  return issue
}

export async function listGrowthDogfoodOpenBlockers(admin: SupabaseClient): Promise<GrowthDogfoodIssue[]> {
  return listGrowthDogfoodIssues(admin, { status: ["open", "in_progress"], limit: 100 })
}
