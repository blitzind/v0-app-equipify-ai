import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { enforceGovernanceIfReady } from "@/lib/growth/governance/governance-enforcement"
import { buildPersonalizationContext } from "@/lib/growth/personalization/personalization-context-builder"
import {
  buildPersonalizationEvidenceFromContext,
  computeEvidenceCoverageScore,
} from "@/lib/growth/personalization/personalization-evidence-engine"
import { recordPersonalizationFeedback } from "@/lib/growth/personalization/personalization-feedback"
import {
  computeAttributionScore,
  listPersonalizationPerformanceSnapshots,
  recordPersonalizationPerformanceSnapshot,
} from "@/lib/growth/personalization/personalization-attribution"
import { appendPersonalizationTimelineEvent } from "@/lib/growth/personalization/personalization-events"
import {
  buildDeterministicPersonalizationDraft,
  buildPersonalizationSystemPrompt,
  buildPersonalizationUserPrompt,
  parsePersonalizationModelOutput,
} from "@/lib/growth/personalization/personalization-prompt"
import { aggregatePersonalizationRiskLevel } from "@/lib/growth/personalization/personalization-risk-engine"
import {
  assertPersonalizationCanBeApproved,
  validatePersonalizationGeneration,
} from "@/lib/growth/personalization/personalization-validator"
import {
  GROWTH_AI_PERSONALIZATION_QA_MARKER,
  maskPersonalizationLeadLabel,
  type GrowthAiPersonalizationDashboard,
  type GrowthPersonalizationGeneration,
  type GrowthPersonalizationGenerationStatus,
  type GrowthPersonalizationGenerationView,
  type GrowthPersonalizationSource,
} from "@/lib/growth/personalization/personalization-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function generationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("personalization_generations")
}

function profilesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("personalization_profiles")
}

function mapGeneration(row: Record<string, unknown>): GrowthPersonalizationGeneration {
  const sourceSummary = Array.isArray(row.source_summary) ? (row.source_summary as string[]) : []
  return {
    id: asString(row.id),
    leadId: asString(row.lead_id),
    leadLabel: asString(row.lead_label),
    status: asString(row.status) as GrowthPersonalizationGenerationStatus,
    subject: asString(row.subject),
    body: asString(row.body),
    personalizationScore: Number(row.personalization_score ?? 0),
    evidenceCoverageScore: Number(row.evidence_coverage_score ?? 0),
    riskLevel: asString(row.risk_level) as GrowthPersonalizationGeneration["riskLevel"],
    blockedReason: asString(row.blocked_reason),
    sourceSummary: sourceSummary as GrowthPersonalizationSource[],
    requiresHumanReview: Boolean(row.requires_human_review ?? true),
    approvedAt: asString(row.approved_at) || null,
    rejectedAt: asString(row.rejected_at) || null,
    sentAt: asString(row.sent_at) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

async function upsertPersonalizationProfile(
  admin: SupabaseClient,
  input: {
    leadId: string
    leadLabel: string
    personalizationScore: number
    evidenceCoverageScore: number
    topSources: GrowthPersonalizationSource[]
  },
): Promise<string> {
  const now = new Date().toISOString()
  const { data: existing } = await profilesTable(admin).select("id").eq("lead_id", input.leadId).maybeSingle()
  const payload = {
    lead_id: input.leadId,
    lead_label: input.leadLabel,
    personalization_score: input.personalizationScore,
    evidence_coverage_score: input.evidenceCoverageScore,
    top_sources: input.topSources,
    updated_at: now,
  }
  if (existing) {
    await profilesTable(admin).update(payload).eq("lead_id", input.leadId)
    return asString((existing as { id?: string }).id)
  }
  const { data, error } = await profilesTable(admin).insert(payload).select("id").single()
  if (error) throw new Error(error.message)
  return asString((data as { id?: string }).id)
}

async function loadGenerationView(admin: SupabaseClient, generationId: string): Promise<GrowthPersonalizationGenerationView | null> {
  const { data, error } = await generationsTable(admin).select("*").eq("id", generationId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const [evidenceRes, riskRes, feedbackRes] = await Promise.all([
    admin.schema("growth").from("personalization_evidence").select("*").eq("generation_id", generationId).order("recorded_at", { ascending: false }),
    admin.schema("growth").from("personalization_risk_events").select("*").eq("generation_id", generationId).order("recorded_at", { ascending: false }),
    admin.schema("growth").from("personalization_feedback").select("*").eq("generation_id", generationId).order("recorded_at", { ascending: false }),
  ])

  return {
    ...mapGeneration(data as Record<string, unknown>),
    evidence: ((evidenceRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: asString(row.id),
      sourceType: asString(row.source_type) as GrowthPersonalizationGenerationView["evidence"][number]["sourceType"],
      claimKey: asString(row.claim_key),
      evidenceSnippet: asString(row.evidence_snippet),
      confidence: asString(row.confidence) as "low" | "medium" | "high" | "verified",
    })),
    riskEvents: ((riskRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: asString(row.id),
      riskType: asString(row.risk_type),
      severity: asString(row.severity) as GrowthPersonalizationGenerationView["riskEvents"][number]["severity"],
      title: asString(row.title),
      description: asString(row.description),
      recordedAt: asString(row.recorded_at),
    })),
    feedback: ((feedbackRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: asString(row.id),
      feedbackType: asString(row.feedback_type) as GrowthPersonalizationGenerationView["feedback"][number]["feedbackType"],
      notes: asString(row.notes),
      actorEmail: asString(row.actor_email),
      recordedAt: asString(row.recorded_at),
    })),
  }
}

export async function listPersonalizationGenerations(
  admin: SupabaseClient,
  input?: { leadId?: string; status?: GrowthPersonalizationGenerationStatus; limit?: number },
): Promise<GrowthPersonalizationGeneration[]> {
  let query = generationsTable(admin).select("*").order("created_at", { ascending: false })
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  if (input?.status) query = query.eq("status", input.status)
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapGeneration)
}

export async function getPersonalizationGenerationView(
  admin: SupabaseClient,
  generationId: string,
): Promise<GrowthPersonalizationGenerationView | null> {
  return loadGenerationView(admin, generationId)
}

export async function generatePersonalizationDraft(
  admin: SupabaseClient,
  input: {
    leadId: string
    actorUserId: string
    actorEmail: string
    contentTemplateVersionId?: string | null
    snippetIds?: string[]
    sequenceExecutionJobId?: string | null
  },
): Promise<GrowthPersonalizationGenerationView> {
  await enforceGovernanceIfReady(admin, {
    action: "personalization_generate",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    sourceRoute: "personalization.generate",
    entityType: "personalization_generation",
    entityId: input.leadId,
    requiresAiReview: true,
    humanApprovalConfirmed: true,
    approvalReason: "Human requested AI personalization generation.",
  }).catch(() => undefined)

  const context = await buildPersonalizationContext(admin, {
    leadId: input.leadId,
    contentTemplateVersionId: input.contentTemplateVersionId,
    snippetIds: input.snippetIds,
  })
  const evidence = buildPersonalizationEvidenceFromContext(context)
  const evidenceCoverageScore = computeEvidenceCoverageScore(evidence)

  let draft = buildDeterministicPersonalizationDraft({ context, evidence })
  const orgId = getGrowthEngineAiOrgId()
  if (orgId && evidence.length > 0) {
    try {
      const aiResult = await runAiTask({
        orgId,
        taskKey: "growth_ai_personalization",
        systemPrompt: buildPersonalizationSystemPrompt(),
        userPrompt: buildPersonalizationUserPrompt({ context, evidence }),
        responseFormat: "json",
      })
      const parsed = parsePersonalizationModelOutput(aiResult.outputText)
      if (parsed) draft = parsed
    } catch {
      // deterministic fallback only
    }
  }

  const validation = validatePersonalizationGeneration({
    subject: draft.subject,
    body: draft.body,
    companyName: context.companyName,
    evidence,
  })

  const status: GrowthPersonalizationGenerationStatus = validation.blocked ? "blocked" : "draft"
  const riskLevel = aggregatePersonalizationRiskLevel(validation.riskFindings)
  const now = new Date().toISOString()

  const profileId = await upsertPersonalizationProfile(admin, {
    leadId: input.leadId,
    leadLabel: context.leadLabel,
    personalizationScore: validation.personalizationScore,
    evidenceCoverageScore,
    topSources: context.sourcesUsed,
  })

  const { data: generationRow, error } = await generationsTable(admin)
    .insert({
      lead_id: input.leadId,
      profile_id: profileId,
      lead_label: context.leadLabel,
      status,
      subject: draft.subject,
      body: draft.body,
      personalization_score: validation.personalizationScore,
      evidence_coverage_score: evidenceCoverageScore,
      risk_level: riskLevel,
      blocked_reason: validation.blockedReason,
      source_summary: context.sourcesUsed,
      content_template_version_id: input.contentTemplateVersionId ?? null,
      snippet_ids: input.snippetIds ?? [],
      sequence_execution_job_id: input.sequenceExecutionJobId ?? null,
      requires_human_review: true,
      created_by: input.actorUserId,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const generationId = asString((generationRow as Record<string, unknown>).id)

  if (evidence.length) {
    await admin.schema("growth").from("personalization_evidence").insert(
      evidence.map((entry) => ({
        generation_id: generationId,
        lead_id: input.leadId,
        source_type: entry.sourceType,
        claim_key: entry.claimKey,
        evidence_snippet: entry.evidenceSnippet,
        confidence: entry.confidence,
      })),
    )
  }

  if (validation.riskFindings.length) {
    await admin.schema("growth").from("personalization_risk_events").insert(
      validation.riskFindings.map((finding) => ({
        generation_id: generationId,
        lead_id: input.leadId,
        risk_type: finding.riskType,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
      })),
    )
  }

  await appendPersonalizationTimelineEvent(admin, {
    eventType: validation.blocked ? "personalization_blocked" : "personalization_generated",
    title: validation.blocked ? "Personalization blocked" : "Personalization generated",
    summary: context.leadLabel,
    leadId: input.leadId,
    metadata: { generation_id: generationId, risk_level: riskLevel },
  })

  const view = await loadGenerationView(admin, generationId)
  if (!view) throw new Error("generation_create_failed")
  return view
}

export async function updatePersonalizationGeneration(
  admin: SupabaseClient,
  generationId: string,
  input: { subject?: string; body?: string; actorUserId: string; actorEmail: string },
): Promise<GrowthPersonalizationGenerationView> {
  const existing = await loadGenerationView(admin, generationId)
  if (!existing) throw new Error("generation_not_found")
  if (existing.status === "blocked") throw new Error("personalization_blocked")

  const subject = input.subject?.trim() ?? existing.subject
  const body = input.body?.trim() ?? existing.body
  const validation = validatePersonalizationGeneration({
    subject,
    body,
    companyName: existing.leadLabel,
    evidence: existing.evidence.map((entry) => ({
      sourceType: entry.sourceType,
      claimKey: entry.claimKey,
      evidenceSnippet: entry.evidenceSnippet,
      confidence: entry.confidence,
    })),
  })

  const status: GrowthPersonalizationGenerationStatus = validation.blocked ? "blocked" : "draft"
  const now = new Date().toISOString()
  await generationsTable(admin)
    .update({
      subject,
      body,
      status,
      personalization_score: validation.personalizationScore,
      risk_level: aggregatePersonalizationRiskLevel(validation.riskFindings),
      blocked_reason: validation.blockedReason,
      updated_at: now,
    })
    .eq("id", generationId)

  await recordPersonalizationFeedback(admin, {
    generationId,
    leadId: existing.leadId,
    feedbackType: "edited",
    notes: "Generation edited before approval.",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  const view = await loadGenerationView(admin, generationId)
  if (!view) throw new Error("generation_not_found")
  return view
}

export async function approvePersonalizationGeneration(
  admin: SupabaseClient,
  input: { generationId: string; actorUserId: string; actorEmail: string; humanApprovalConfirmed?: boolean },
): Promise<GrowthPersonalizationGenerationView> {
  const existing = await loadGenerationView(admin, input.generationId)
  if (!existing) throw new Error("generation_not_found")
  assertPersonalizationCanBeApproved({ status: existing.status, blockedReason: existing.blockedReason })

  await enforceGovernanceIfReady(admin, {
    action: "personalization_approve",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    sourceRoute: "personalization.approve",
    entityType: "personalization_generation",
    entityId: input.generationId,
    requiresAiReview: true,
    humanApprovalConfirmed: input.humanApprovalConfirmed ?? true,
    approvalReason: "Human approved AI personalization.",
  })

  const now = new Date().toISOString()
  await generationsTable(admin)
    .update({
      status: "approved",
      approved_by: input.actorUserId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", input.generationId)

  await recordPersonalizationFeedback(admin, {
    generationId: input.generationId,
    leadId: existing.leadId,
    feedbackType: "approved",
    notes: "Human approved personalization.",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  const { recordAttributionTouch } = await import("@/lib/growth/revenue-attribution/record-attribution-touch")
  await recordAttributionTouch(admin, {
    touchType: "personalization",
    leadId: existing.leadId,
    repUserId: input.actorUserId ?? null,
    attributionSource: "personalization_generation",
    attributionConfidence: 0.8,
    metadata: { generation_id: existing.id, generation_type: existing.generationType },
  }).catch(() => undefined)

  await recordPersonalizationPerformanceSnapshot(admin, {
    generationId: input.generationId,
    leadId: existing.leadId,
    sourceType: existing.sourceSummary[0] ?? "relationship_memory",
    attributionScore: computeAttributionScore({
      evidenceCoverageScore: existing.evidenceCoverageScore,
      personalizationScore: existing.personalizationScore,
    }),
  })

  await appendPersonalizationTimelineEvent(admin, {
    eventType: "personalization_approved",
    title: "Personalization approved",
    summary: existing.leadLabel,
    leadId: existing.leadId,
    metadata: { generation_id: input.generationId },
  })

  const view = await loadGenerationView(admin, input.generationId)
  if (!view) throw new Error("generation_not_found")
  return view
}

export async function rejectPersonalizationGeneration(
  admin: SupabaseClient,
  input: { generationId: string; actorUserId: string; actorEmail: string; reason?: string },
): Promise<GrowthPersonalizationGenerationView> {
  const existing = await loadGenerationView(admin, input.generationId)
  if (!existing) throw new Error("generation_not_found")

  const now = new Date().toISOString()
  await generationsTable(admin)
    .update({
      status: "rejected",
      rejected_by: input.actorUserId,
      rejected_at: now,
      blocked_reason: input.reason?.trim() || existing.blockedReason,
      updated_at: now,
    })
    .eq("id", input.generationId)

  await recordPersonalizationFeedback(admin, {
    generationId: input.generationId,
    leadId: existing.leadId,
    feedbackType: "rejected",
    notes: input.reason?.trim() ?? "Rejected by reviewer.",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  await appendPersonalizationTimelineEvent(admin, {
    eventType: "personalization_rejected",
    title: "Personalization rejected",
    summary: existing.leadLabel,
    leadId: existing.leadId,
    metadata: { generation_id: input.generationId },
  })

  const view = await loadGenerationView(admin, input.generationId)
  if (!view) throw new Error("generation_not_found")
  return view
}

export async function fetchGrowthAiPersonalizationDashboard(
  admin: SupabaseClient,
): Promise<GrowthAiPersonalizationDashboard> {
  const [generations, evidenceRes, riskRes, feedbackRes, performanceSnapshots] = await Promise.all([
    listPersonalizationGenerations(admin, { limit: 50 }),
    admin.schema("growth").from("personalization_evidence").select("*").order("recorded_at", { ascending: false }).limit(20),
    admin.schema("growth").from("personalization_risk_events").select("*").order("recorded_at", { ascending: false }).limit(20),
    admin.schema("growth").from("personalization_feedback").select("*").order("recorded_at", { ascending: false }).limit(20),
    listPersonalizationPerformanceSnapshots(admin, { limit: 20 }),
  ])

  const sourceCounts = new Map<GrowthPersonalizationSource, number>()
  for (const generation of generations) {
    for (const source of generation.sourceSummary) {
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)
    }
  }

  const avgCoverage =
    generations.length > 0
      ? Math.round(generations.reduce((sum, row) => sum + row.evidenceCoverageScore, 0) / generations.length)
      : 0

  return {
    qa_marker: GROWTH_AI_PERSONALIZATION_QA_MARKER,
    generatedPersonalizations: generations.length,
    approvalQueue: generations.filter((row) => row.status === "draft").length,
    highRiskGenerations: generations.filter((row) => row.riskLevel === "high" || row.riskLevel === "critical").length,
    evidenceCoverage: avgCoverage,
    performanceAttribution:
      performanceSnapshots.length > 0
        ? Math.round(
            performanceSnapshots.reduce((sum, row) => sum + row.attributionScore, 0) / performanceSnapshots.length,
          )
        : 0,
    topSources: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    generations,
    recentEvidence: ((evidenceRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: asString(row.id),
      sourceType: asString(row.source_type) as GrowthPersonalizationSource,
      claimKey: asString(row.claim_key),
      evidenceSnippet: asString(row.evidence_snippet),
      confidence: asString(row.confidence) as "low" | "medium" | "high" | "verified",
    })),
    recentRiskEvents: ((riskRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: asString(row.id),
      riskType: asString(row.risk_type),
      severity: asString(row.severity) as GrowthAiPersonalizationDashboard["recentRiskEvents"][number]["severity"],
      title: asString(row.title),
      description: asString(row.description),
      recordedAt: asString(row.recorded_at),
    })),
    recentFeedback: ((feedbackRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: asString(row.id),
      feedbackType: asString(row.feedback_type) as GrowthAiPersonalizationDashboard["recentFeedback"][number]["feedbackType"],
      notes: asString(row.notes),
      actorEmail: asString(row.actor_email),
      recordedAt: asString(row.recorded_at),
    })),
    performanceSnapshots,
  }
}

export async function getApprovedPersonalizationForJob(
  admin: SupabaseClient,
  generationId: string,
): Promise<{ subject: string; body: string } | null> {
  const view = await loadGenerationView(admin, generationId)
  if (!view || view.status !== "approved") return null
  return { subject: view.subject, body: view.body }
}

export { maskPersonalizationLeadLabel }
