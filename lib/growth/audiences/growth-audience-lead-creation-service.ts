import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createHash } from "node:crypto"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  checkAudienceLeadCreationEnabled,
  consumeAudienceLeadCreationBudget,
  recordAudienceGuardrailFailure,
} from "@/lib/growth/audiences/growth-audience-guardrails"
import { GROWTH_AUDIENCE_LIMITS, GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"
import {
  createGrowthAudienceLeadCreationRun,
  getGrowthAudience,
  listGrowthAudienceMembers,
  listGrowthAudienceMembersByIds,
  updateGrowthAudienceLeadCreationRun,
} from "@/lib/growth/audiences/growth-audience-repository"
import type {
  GrowthAudienceLeadCreationProgress,
  GrowthAudienceMember,
} from "@/lib/growth/audiences/growth-audience-types"
import { createLeadCandidate } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import { recordRuntimeHealthRead, recordRuntimeHealthWrite } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

type LeadCreationCursor = { offset: number }

function encodeLeadCursor(cursor: LeadCreationCursor): string {
  return JSON.stringify(cursor)
}

function decodeLeadCursor(raw: string | null): LeadCreationCursor {
  if (!raw) return { offset: 0 }
  try {
    const parsed = JSON.parse(raw) as Partial<LeadCreationCursor>
    return { offset: Math.max(0, Number(parsed.offset ?? 0)) }
  } catch {
    return { offset: 0 }
  }
}

function buildAudienceMemberDedupeHash(member: GrowthAudienceMember): string {
  const parts = [
    "audience_member",
    member.memberKind,
    member.memberKey ?? member.companyId ?? member.growthPersonId ?? member.id,
  ]
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)
}

async function createLeadFromAudienceMember(
  admin: SupabaseClient,
  member: GrowthAudienceMember,
  input: { audienceId: string; audienceName: string; dryRun: boolean },
): Promise<"created" | "skipped" | "failed"> {
  if (member.leadId) return "skipped"

  if (input.dryRun) return "created"

  const sourceType =
    typeof member.companyRelationshipJson.source_type === "string"
      ? member.companyRelationshipJson.source_type
      : "audience_snapshot"

  const companyName = member.companyName ?? member.companyId ?? "Unknown company"
  const dedupe_hash = buildAudienceMemberDedupeHash(member)

  const result = await createLeadCandidate(admin, {
    site_key: "growth_audience",
    candidate_type: "identified",
    candidate_priority: "normal",
    intent_score: member.intentScore ?? member.fitScore ?? 0,
    intent_grade: "C",
    candidate_confidence: member.fitScore ?? 0.5,
    pipeline_entry: "icp_targeting",
    company_name: companyName,
    contact_name: member.personName,
    dedupe_hash,
    candidate_reasoning: [
      "Operator-approved lead creation from Dynamic Audience — not autonomous.",
      `Audience: ${input.audienceName}`,
      member.memberKind === "person"
        ? `Person snapshot: ${member.personName ?? member.growthPersonId ?? "unknown"}`
        : `Company snapshot: ${companyName}`,
    ],
    candidate_evidence: [
      {
        claim: "Audience member selection",
        evidence: `Approved from audience ${input.audienceId} snapshot ${member.snapshotId}.`,
        source: "growth.audiences",
      },
    ],
    candidate_attribution: [
      {
        source: "growth.audiences",
        section: "inbox_bridge",
        signal: "create_lead",
        evidence: `Member ${member.id} (${sourceType}).`,
        confidence: member.fitScore ?? 0.5,
      },
    ],
    session_count: 0,
    visit_count: 0,
    intent_session_id: `audience-${input.audienceId}-${member.id}`,
    visitor_key: `audience-${dedupe_hash}`,
    metadata: {
      audience_id: input.audienceId,
      snapshot_id: member.snapshotId,
      member_id: member.id,
      member_kind: member.memberKind,
      growth_person_id: member.growthPersonId,
      canonical_person_id: member.canonicalPersonId,
      company_id: member.companyId,
      company_relationship: member.companyRelationshipJson,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    },
  })

  if (result.duplicate) return "skipped"
  if (!result.ok) return "failed"
  return "created"
}

function buildLeadCreationProgress(
  run: Record<string, unknown>,
  hasMore: boolean,
): GrowthAudienceLeadCreationProgress {
  return {
    runId: String(run.id ?? ""),
    status: String(run.status ?? "in_progress") as GrowthAudienceLeadCreationProgress["status"],
    requestedCount: Number(run.requested_count ?? 0),
    createdCount: Number(run.created_count ?? 0),
    skippedCount: Number(run.skipped_count ?? 0),
    failedCount: Number(run.failed_count ?? 0),
    processedCount: Number(run.processed_count ?? 0),
    hasMore,
    rowsRead: Number(run.rows_read ?? 0),
    rowsWritten: Number(run.rows_written ?? 0),
    durationMs: run.duration_ms != null ? Number(run.duration_ms) : null,
    error: typeof run.error === "string" ? run.error : null,
  }
}

export async function startAudienceLeadCreation(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    userId: string
    snapshotId: string
    memberIds?: string[]
    allWithoutLead?: boolean
    dryRun?: boolean
  },
): Promise<GrowthAudienceLeadCreationProgress> {
  const enabled = await checkAudienceLeadCreationEnabled(admin)
  if (!enabled.allowed) {
    const run = await createGrowthAudienceLeadCreationRun(admin, {
      audienceId: input.audienceId,
      organizationId: input.organizationId,
      snapshotId: input.snapshotId,
      requestedCount: 0,
      initiatedBy: input.userId,
      dryRun: input.dryRun,
    })
    await updateGrowthAudienceLeadCreationRun(admin, String(run.id), {
      status: "throttled",
      error: enabled.reason,
    })
    return buildLeadCreationProgress(run, false)
  }

  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience || audience.organizationId !== input.organizationId) {
    throw new Error("audience_not_found")
  }

  let members: GrowthAudienceMember[] = []
  if (input.memberIds && input.memberIds.length > 0) {
    members = await listGrowthAudienceMembersByIds(admin, {
      memberIds: input.memberIds.slice(0, GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_LEAD_CREATIONS_PER_RUN),
      snapshotId: input.snapshotId,
    })
  } else if (input.allWithoutLead) {
    const page = await listGrowthAudienceMembers(admin, {
      snapshotId: input.snapshotId,
      limit: GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_LEAD_CREATIONS_PER_RUN,
      withoutLeadId: true,
    })
    members = page.items
  }

  const eligible = members.filter((m) => !m.leadId)
  const requestedCount = Math.min(
    eligible.length,
    GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_LEAD_CREATIONS_PER_RUN,
  )

  const budget = await consumeAudienceLeadCreationBudget(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    volume: requestedCount,
  })

  const run = await createGrowthAudienceLeadCreationRun(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    snapshotId: input.snapshotId,
    requestedCount,
    initiatedBy: input.userId,
    dryRun: input.dryRun,
  })

  if (!budget.allowed) {
    await updateGrowthAudienceLeadCreationRun(admin, String(run.id), {
      status: "throttled",
      error: budget.reason,
    })
    return buildLeadCreationProgress(run, false)
  }

  return processAudienceLeadCreationBatch(admin, {
    runId: String(run.id),
    audienceId: input.audienceId,
    audienceName: audience.name,
    organizationId: input.organizationId,
    members: eligible.slice(0, requestedCount),
    dryRun: input.dryRun ?? false,
    startedAt: Date.now(),
    cursor: { offset: 0 },
    accum: { created: 0, skipped: 0, failed: 0, rowsRead: 0, rowsWritten: 0 },
  })
}

export async function continueAudienceLeadCreation(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    runId: string
    dryRun?: boolean
  },
): Promise<GrowthAudienceLeadCreationProgress> {
  const { data: runRow } = await admin
    .schema("growth")
    .from("growth_audience_lead_creation_runs")
    .select("*")
    .eq("id", input.runId)
    .maybeSingle()

  if (!runRow || String(runRow.audience_id) !== input.audienceId) {
    throw new Error("lead_creation_run_not_found")
  }

  if (String(runRow.status) !== "in_progress") {
    return buildLeadCreationProgress(runRow as Record<string, unknown>, false)
  }

  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience) throw new Error("audience_not_found")

  const cursor = decodeLeadCursor(typeof runRow.run_cursor === "string" ? runRow.run_cursor : null)
  const snapshotId = String(runRow.snapshot_id)

  const page = await listGrowthAudienceMembers(admin, {
    snapshotId,
    limit: GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_REFRESH_BATCH,
    offset: cursor.offset,
    withoutLeadId: true,
  })

  return processAudienceLeadCreationBatch(admin, {
    runId: input.runId,
    audienceId: input.audienceId,
    audienceName: audience.name,
    organizationId: input.organizationId,
    members: page.items,
    dryRun: input.dryRun ?? Boolean(runRow.dry_run),
    startedAt: Date.now() - Number(runRow.duration_ms ?? 0),
    cursor,
    accum: {
      created: Number(runRow.created_count ?? 0),
      skipped: Number(runRow.skipped_count ?? 0),
      failed: Number(runRow.failed_count ?? 0),
      rowsRead: Number(runRow.rows_read ?? 0),
      rowsWritten: Number(runRow.rows_written ?? 0),
    },
    totalEligible: Number(runRow.requested_count ?? 0),
  })
}

async function processAudienceLeadCreationBatch(
  admin: SupabaseClient,
  input: {
    runId: string
    audienceId: string
    audienceName: string
    organizationId: string
    members: GrowthAudienceMember[]
    dryRun: boolean
    startedAt: number
    cursor: LeadCreationCursor
    accum: { created: number; skipped: number; failed: number; rowsRead: number; rowsWritten: number }
    totalEligible?: number
  },
): Promise<GrowthAudienceLeadCreationProgress> {
  const batchSize = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_REFRESH_BATCH
  const perRunCap = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_LEAD_CREATIONS_PER_RUN
  const slice = input.members.slice(0, batchSize)

  let created = input.accum.created
  let skipped = input.accum.skipped
  let failed = input.accum.failed
  let rowsRead = input.accum.rowsRead
  let rowsWritten = input.accum.rowsWritten

  for (const member of slice) {
    if (created + skipped + failed >= perRunCap) break
    rowsRead += 2
    try {
      const outcome = await createLeadFromAudienceMember(admin, member, {
        audienceId: input.audienceId,
        audienceName: input.audienceName,
        dryRun: input.dryRun,
      })
      if (outcome === "created") {
        created += 1
        rowsWritten += 1
      } else if (outcome === "skipped") skipped += 1
      else failed += 1
    } catch {
      failed += 1
    }
  }

  const processedCount = created + skipped + failed
  const nextOffset = input.cursor.offset + slice.length
  const total = input.totalEligible ?? processedCount
  const hasMore = slice.length === batchSize && processedCount < perRunCap && nextOffset < total

  const durationMs = Date.now() - input.startedAt
  await updateGrowthAudienceLeadCreationRun(admin, input.runId, {
    status: hasMore ? "in_progress" : "completed",
    createdCount: created,
    skippedCount: skipped,
    failedCount: failed,
    processedCount,
    rowsRead,
    rowsWritten,
    durationMs,
    runCursor: encodeLeadCursor({ offset: nextOffset }),
  })

  await recordRuntimeHealthRead(admin, rowsRead)
  await recordRuntimeHealthWrite(admin, rowsWritten)

  logGrowthEngine("audience_lead_creation_batch", {
    qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    audience_id: input.audienceId,
    run_id: input.runId,
    created,
    skipped,
    failed,
    has_more: hasMore,
  })

  const { data: runRow } = await admin
    .schema("growth")
    .from("growth_audience_lead_creation_runs")
    .select("*")
    .eq("id", input.runId)
    .maybeSingle()

  return buildLeadCreationProgress((runRow ?? {}) as Record<string, unknown>, hasMore)
}
