import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import type {
  GrowthAiCopilotPlaybookApprovedRule,
  GrowthAiCopilotPlaybookDraftRule,
  GrowthAiCopilotPlaybookEffectivenessOutcome,
  GrowthAiCopilotPlaybookExtraction,
  GrowthAiCopilotPlaybookIndustryScope,
  GrowthAiCopilotPlaybookSource,
  GrowthAiCopilotPlaybookSourceKind,
  GrowthAiCopilotPlaybookTrainerProfile,
} from "@/lib/growth/ai-copilot-playbook-types"
import { slugifyPlaybookRuleKey } from "@/lib/growth/ai-copilot-playbook-types"

function sourcesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_playbook_sources")
}

function extractionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_playbook_extractions")
}

function draftRulesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_playbook_draft_rules")
}

function approvedRulesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_playbook_approved_rules")
}

function ruleVersionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_playbook_rule_versions")
}

function attributionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_playbook_rule_attributions")
}

function generationRulesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_generation_playbook_rules")
}

function effectivenessTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_playbook_effectiveness")
}

const SOURCE_SELECT =
  "id, title, source_kind, source_url, raw_content, content_hash, metadata, trainer_profile, industry_scope, storage_policy, status, retain_until, parent_source_id, created_by, created_at, updated_at"

const EXTRACTION_SELECT =
  "id, source_id, extraction_version, prompt_variant, input_snapshot, status, draft_rule_count, conflict_count, conflicts, model_provider, model_name, error_message, created_by, created_at"

const DRAFT_SELECT =
  "id, extraction_id, source_id, category, title, principle, applies_to, priority, industry_scope, trainer_profile, metadata, status, reviewed_by, reviewed_at, created_at"

const APPROVED_SELECT =
  "id, rule_key, category, title, principle, applies_to, priority, version, industry_scope, trainer_profile, status, source_id, approved_by, approved_at, superseded_at, created_at, updated_at"

function mapIndustryScope(value: unknown): GrowthAiCopilotPlaybookIndustryScope {
  const scope = (value as GrowthAiCopilotPlaybookIndustryScope) ?? {}
  return {
    appliesGlobally: scope.appliesGlobally ?? true,
    industries: scope.industries ?? [],
    tags: scope.tags ?? [],
  }
}

function mapTrainerProfile(value: unknown): GrowthAiCopilotPlaybookTrainerProfile {
  return (value as GrowthAiCopilotPlaybookTrainerProfile) ?? {}
}

function mapSource(row: Record<string, unknown>): GrowthAiCopilotPlaybookSource {
  return {
    id: row.id as string,
    title: row.title as string,
    sourceKind: row.source_kind as GrowthAiCopilotPlaybookSourceKind,
    sourceUrl: (row.source_url as string | null) ?? null,
    rawContent: (row.raw_content as string | null) ?? null,
    contentHash: (row.content_hash as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    trainerProfile: mapTrainerProfile(row.trainer_profile),
    industryScope: mapIndustryScope(row.industry_scope),
    storagePolicy: row.storage_policy as GrowthAiCopilotPlaybookSource["storagePolicy"],
    status: row.status as GrowthAiCopilotPlaybookSource["status"],
    retainUntil: (row.retain_until as string | null) ?? null,
    parentSourceId: (row.parent_source_id as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapExtraction(row: Record<string, unknown>): GrowthAiCopilotPlaybookExtraction {
  return {
    id: row.id as string,
    sourceId: row.source_id as string,
    extractionVersion: row.extraction_version as string,
    promptVariant: row.prompt_variant as string,
    inputSnapshot: (row.input_snapshot as Record<string, unknown>) ?? {},
    status: row.status as GrowthAiCopilotPlaybookExtraction["status"],
    draftRuleCount: row.draft_rule_count as number,
    conflictCount: row.conflict_count as number,
    conflicts: (row.conflicts as GrowthAiCopilotPlaybookExtraction["conflicts"]) ?? [],
    modelProvider: (row.model_provider as string | null) ?? null,
    modelName: (row.model_name as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

function mapDraft(row: Record<string, unknown>): GrowthAiCopilotPlaybookDraftRule {
  return {
    id: row.id as string,
    extractionId: row.extraction_id as string,
    sourceId: row.source_id as string,
    category: row.category as GrowthAiCopilotPlaybookDraftRule["category"],
    title: row.title as string,
    principle: row.principle as string,
    appliesTo: (row.applies_to as GrowthAiCopilotGenerationType[]) ?? [],
    priority: row.priority as number,
    industryScope: mapIndustryScope(row.industry_scope),
    trainerProfile: mapTrainerProfile(row.trainer_profile),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    status: row.status as GrowthAiCopilotPlaybookDraftRule["status"],
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

function mapApproved(row: Record<string, unknown>): GrowthAiCopilotPlaybookApprovedRule {
  return {
    id: row.id as string,
    ruleKey: row.rule_key as string,
    category: row.category as GrowthAiCopilotPlaybookApprovedRule["category"],
    title: row.title as string,
    principle: row.principle as string,
    appliesTo: (row.applies_to as GrowthAiCopilotGenerationType[]) ?? [],
    priority: row.priority as number,
    version: row.version as number,
    industryScope: mapIndustryScope(row.industry_scope),
    trainerProfile: mapTrainerProfile(row.trainer_profile),
    status: row.status as GrowthAiCopilotPlaybookApprovedRule["status"],
    sourceId: (row.source_id as string | null) ?? null,
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    supersededAt: (row.superseded_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function hashPlaybookSourceContent(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex")
}

export async function insertGrowthAiCopilotPlaybookSource(
  admin: SupabaseClient,
  input: {
    title: string
    sourceKind: GrowthAiCopilotPlaybookSourceKind
    sourceUrl?: string | null
    rawContent?: string | null
    trainerProfile?: GrowthAiCopilotPlaybookTrainerProfile
    industryScope?: GrowthAiCopilotPlaybookIndustryScope
    storagePolicy?: GrowthAiCopilotPlaybookSource["storagePolicy"]
    createdBy: string
  },
): Promise<GrowthAiCopilotPlaybookSource> {
  const rawContent = input.rawContent?.trim() ?? null
  const { data, error } = await sourcesTable(admin)
    .insert({
      title: input.title.trim(),
      source_kind: input.sourceKind,
      source_url: input.sourceUrl ?? null,
      raw_content: rawContent,
      content_hash: rawContent ? hashPlaybookSourceContent(rawContent) : null,
      trainer_profile: input.trainerProfile ?? {},
      industry_scope: input.industryScope ?? { appliesGlobally: true },
      storage_policy: input.storagePolicy ?? "principles_only",
      status: rawContent || input.sourceUrl ? "ready" : "pending",
      created_by: input.createdBy,
    })
    .select(SOURCE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapSource(data as Record<string, unknown>)
}

export async function listGrowthAiCopilotPlaybookSources(
  admin: SupabaseClient,
  limit = 50,
): Promise<GrowthAiCopilotPlaybookSource[]> {
  const { data, error } = await sourcesTable(admin)
    .select(SOURCE_SELECT)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 100))
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSource(row as Record<string, unknown>))
}

export async function fetchGrowthAiCopilotPlaybookSourceById(
  admin: SupabaseClient,
  sourceId: string,
): Promise<GrowthAiCopilotPlaybookSource | null> {
  const { data, error } = await sourcesTable(admin).select(SOURCE_SELECT).eq("id", sourceId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapSource(data as Record<string, unknown>) : null
}

export async function listGrowthAiCopilotPlaybookSourcesByIds(
  admin: SupabaseClient,
  sourceIds: string[],
): Promise<GrowthAiCopilotPlaybookSource[]> {
  if (sourceIds.length === 0) return []
  const { data, error } = await sourcesTable(admin).select(SOURCE_SELECT).in("id", sourceIds)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSource(row as Record<string, unknown>))
}

export async function updateGrowthAiCopilotPlaybookSourceStatus(
  admin: SupabaseClient,
  sourceId: string,
  status: GrowthAiCopilotPlaybookSource["status"],
): Promise<void> {
  const { error } = await sourcesTable(admin)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sourceId)
  if (error) throw new Error(error.message)
}

export async function insertGrowthAiCopilotPlaybookExtraction(
  admin: SupabaseClient,
  input: {
    sourceId: string
    extractionVersion: string
    promptVariant: string
    inputSnapshot: Record<string, unknown>
    createdBy: string
  },
): Promise<GrowthAiCopilotPlaybookExtraction> {
  const { data, error } = await extractionsTable(admin)
    .insert({
      source_id: input.sourceId,
      extraction_version: input.extractionVersion,
      prompt_variant: input.promptVariant,
      input_snapshot: input.inputSnapshot,
      status: "running",
      created_by: input.createdBy,
    })
    .select(EXTRACTION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapExtraction(data as Record<string, unknown>)
}

export async function finalizeGrowthAiCopilotPlaybookExtraction(
  admin: SupabaseClient,
  extractionId: string,
  input: {
    status: "succeeded" | "failed"
    draftRuleCount: number
    conflictCount: number
    conflicts: GrowthAiCopilotPlaybookExtraction["conflicts"]
    modelProvider?: string | null
    modelName?: string | null
    errorMessage?: string | null
  },
): Promise<GrowthAiCopilotPlaybookExtraction> {
  const { data, error } = await extractionsTable(admin)
    .update({
      status: input.status,
      draft_rule_count: input.draftRuleCount,
      conflict_count: input.conflictCount,
      conflicts: input.conflicts,
      model_provider: input.modelProvider ?? null,
      model_name: input.modelName ?? null,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", extractionId)
    .select(EXTRACTION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapExtraction(data as Record<string, unknown>)
}

export async function fetchGrowthAiCopilotPlaybookExtractionById(
  admin: SupabaseClient,
  extractionId: string,
): Promise<GrowthAiCopilotPlaybookExtraction | null> {
  const { data, error } = await extractionsTable(admin).select(EXTRACTION_SELECT).eq("id", extractionId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapExtraction(data as Record<string, unknown>) : null
}

export async function insertGrowthAiCopilotPlaybookDraftRules(
  admin: SupabaseClient,
  rules: Array<{
    extractionId: string
    sourceId: string
    category: GrowthAiCopilotPlaybookDraftRule["category"]
    title: string
    principle: string
    appliesTo: GrowthAiCopilotGenerationType[]
    priority: number
    industryScope: GrowthAiCopilotPlaybookIndustryScope
    trainerProfile: GrowthAiCopilotPlaybookTrainerProfile
  }>,
): Promise<GrowthAiCopilotPlaybookDraftRule[]> {
  if (rules.length === 0) return []
  const { data, error } = await draftRulesTable(admin)
    .insert(
      rules.map((rule) => ({
        extraction_id: rule.extractionId,
        source_id: rule.sourceId,
        category: rule.category,
        title: rule.title,
        principle: rule.principle,
        applies_to: rule.appliesTo,
        priority: rule.priority,
        industry_scope: rule.industryScope,
        trainer_profile: rule.trainerProfile,
      })),
    )
    .select(DRAFT_SELECT)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDraft(row as Record<string, unknown>))
}

export async function listGrowthAiCopilotPlaybookDraftRules(
  admin: SupabaseClient,
  input: { status?: GrowthAiCopilotPlaybookDraftRule["status"]; limit?: number },
): Promise<GrowthAiCopilotPlaybookDraftRule[]> {
  let query = draftRulesTable(admin).select(DRAFT_SELECT).order("created_at", { ascending: false })
  if (input.status) query = query.eq("status", input.status)
  query = query.limit(Math.min(input.limit ?? 100, 200))
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDraft(row as Record<string, unknown>))
}

export async function fetchGrowthAiCopilotPlaybookDraftRuleById(
  admin: SupabaseClient,
  draftId: string,
): Promise<GrowthAiCopilotPlaybookDraftRule | null> {
  const { data, error } = await draftRulesTable(admin).select(DRAFT_SELECT).eq("id", draftId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDraft(data as Record<string, unknown>) : null
}

export async function updateGrowthAiCopilotPlaybookDraftRuleStatus(
  admin: SupabaseClient,
  draftId: string,
  input: {
    status: GrowthAiCopilotPlaybookDraftRule["status"]
    reviewedBy: string
  },
): Promise<GrowthAiCopilotPlaybookDraftRule> {
  const { data, error } = await draftRulesTable(admin)
    .update({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .select(DRAFT_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapDraft(data as Record<string, unknown>)
}

export async function listActiveGrowthAiCopilotPlaybookApprovedRules(
  admin: SupabaseClient,
): Promise<GrowthAiCopilotPlaybookApprovedRule[]> {
  const { data, error } = await approvedRulesTable(admin)
    .select(APPROVED_SELECT)
    .eq("status", "active")
    .order("priority", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapApproved(row as Record<string, unknown>))
}

export async function listGrowthAiCopilotPlaybookApprovedRules(
  admin: SupabaseClient,
  limit = 100,
): Promise<GrowthAiCopilotPlaybookApprovedRule[]> {
  const { data, error } = await approvedRulesTable(admin)
    .select(APPROVED_SELECT)
    .order("updated_at", { ascending: false })
    .limit(Math.min(limit, 200))
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapApproved(row as Record<string, unknown>))
}

export async function approveGrowthAiCopilotPlaybookDraftRule(
  admin: SupabaseClient,
  input: {
    draft: GrowthAiCopilotPlaybookDraftRule
    approvedBy: string
  },
): Promise<GrowthAiCopilotPlaybookApprovedRule> {
  const ruleKeyBase = slugifyPlaybookRuleKey(input.draft.title) || "playbook_rule"
  const { data: existing } = await approvedRulesTable(admin)
    .select("version")
    .eq("rule_key", ruleKeyBase)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const version = existing?.version ? Number(existing.version) + 1 : 1
  if (existing?.version) {
    await approvedRulesTable(admin)
      .update({ status: "superseded", superseded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("rule_key", ruleKeyBase)
      .eq("status", "active")
  }

  const { data, error } = await approvedRulesTable(admin)
    .insert({
      rule_key: ruleKeyBase,
      category: input.draft.category,
      title: input.draft.title,
      principle: input.draft.principle,
      applies_to: input.draft.appliesTo,
      priority: input.draft.priority,
      version,
      industry_scope: input.draft.industryScope,
      trainer_profile: input.draft.trainerProfile,
      status: "active",
      source_id: input.draft.sourceId,
      approved_by: input.approvedBy,
      approved_at: new Date().toISOString(),
    })
    .select(APPROVED_SELECT)
    .single()
  if (error) throw new Error(error.message)

  const approved = mapApproved(data as Record<string, unknown>)

  await ruleVersionsTable(admin).insert({
    approved_rule_id: approved.id,
    rule_key: approved.ruleKey,
    version: approved.version,
    snapshot: {
      title: approved.title,
      principle: approved.principle,
      category: approved.category,
      appliesTo: approved.appliesTo,
      priority: approved.priority,
      industryScope: approved.industryScope,
      trainerProfile: approved.trainerProfile,
    },
    change_summary: version > 1 ? "Superseded prior active version" : "Initial approval",
    created_by: input.approvedBy,
  })

  await attributionsTable(admin).insert({
    approved_rule_id: approved.id,
    source_id: input.draft.sourceId,
    contribution_weight: 100,
    evidence_summary: input.draft.title,
  })

  return approved
}

export async function disableGrowthAiCopilotPlaybookApprovedRule(
  admin: SupabaseClient,
  ruleId: string,
): Promise<GrowthAiCopilotPlaybookApprovedRule> {
  const { data, error } = await approvedRulesTable(admin)
    .update({ status: "disabled", updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .select(APPROVED_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapApproved(data as Record<string, unknown>)
}

export async function linkGrowthAiCopilotGenerationPlaybookRules(
  admin: SupabaseClient,
  input: {
    generationId: string
    rules: GrowthAiCopilotPlaybookApprovedRule[]
  },
): Promise<void> {
  if (input.rules.length === 0) return
  const { error } = await generationRulesTable(admin).insert(
    input.rules.map((rule) => ({
      generation_id: input.generationId,
      approved_rule_id: rule.id,
      rule_version: rule.version,
      source_id: rule.sourceId,
    })),
  )
  if (error) throw new Error(error.message)
}

export async function updateGrowthAiCopilotGenerationPlaybookFields(
  admin: SupabaseClient,
  generationId: string,
  input: {
    playbookInfluenceScore: number
    playbookAttribution: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .update({
      playbook_influence_score: input.playbookInfluenceScore,
      playbook_attribution: input.playbookAttribution,
    })
    .eq("id", generationId)
  if (error) throw new Error(error.message)
}

export async function insertGrowthAiCopilotPlaybookEffectiveness(
  admin: SupabaseClient,
  input: {
    approvedRuleId?: string | null
    sourceId?: string | null
    generationId?: string | null
    leadId?: string | null
    outcome: GrowthAiCopilotPlaybookEffectivenessOutcome
    category?: string | null
    playbookInfluenceScore?: number
    effectivenessScore?: number
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await effectivenessTable(admin).insert({
    approved_rule_id: input.approvedRuleId ?? null,
    source_id: input.sourceId ?? null,
    generation_id: input.generationId ?? null,
    lead_id: input.leadId ?? null,
    outcome: input.outcome,
    category: input.category ?? null,
    playbook_influence_score: input.playbookInfluenceScore ?? 0,
    effectiveness_score: input.effectivenessScore ?? 0,
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export async function listGrowthAiCopilotPlaybookEffectivenessSummary(
  admin: SupabaseClient,
  limit = 50,
): Promise<
  Array<{
    outcome: string
    count: number
    avgInfluence: number
    avgEffectiveness: number
  }>
> {
  const { data, error } = await effectivenessTable(admin)
    .select("outcome, playbook_influence_score, effectiveness_score")
    .order("recorded_at", { ascending: false })
    .limit(Math.min(limit, 500))
  if (error) throw new Error(error.message)

  const buckets = new Map<string, { count: number; influence: number; effectiveness: number }>()
  for (const row of data ?? []) {
    const outcome = row.outcome as string
    const bucket = buckets.get(outcome) ?? { count: 0, influence: 0, effectiveness: 0 }
    bucket.count += 1
    bucket.influence += Number(row.playbook_influence_score ?? 0)
    bucket.effectiveness += Number(row.effectiveness_score ?? 0)
    buckets.set(outcome, bucket)
  }

  return [...buckets.entries()].map(([outcome, bucket]) => ({
    outcome,
    count: bucket.count,
    avgInfluence: bucket.count ? Math.round(bucket.influence / bucket.count) : 0,
    avgEffectiveness: bucket.count ? Math.round(bucket.effectiveness / bucket.count) : 0,
  }))
}
