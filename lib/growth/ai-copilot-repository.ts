import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthAiCopilotGeneration,
  GrowthAiCopilotGenerationStatus,
  GrowthAiCopilotGenerationType,
  GrowthCopilotSettings,
  GrowthAiCopilotRule,
} from "@/lib/growth/ai-copilot-types"
import {
  resolveGrowthCallCopilotEnabled,
  resolveGrowthCallCopilotRequireSummaryApproval,
} from "@/lib/growth/call-copilot-settings"

function copilotSettingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("copilot_settings")
}

function copilotRulesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_rules")
}

function generationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_generations")
}

function effectivenessTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_effectiveness")
}

const SETTINGS_SELECT =
  "id, ai_copilot_enabled, ai_copilot_human_approval_required, ai_copilot_store_generations, ai_copilot_generation_retention_days, ai_copilot_default_prompt_variant, ai_copilot_playbook_enabled, ai_copilot_playbook_max_rules_per_generation, ai_copilot_playbook_source_retention_days, outreach_personalization_enabled, outreach_personalization_max_words, call_copilot_enabled, call_copilot_require_summary_approval, updated_by, created_at, updated_at"

const RULES_SELECT =
  "id, rule_key, label, description, enabled, rule_config, sort_order, created_at, updated_at"

const GENERATION_SELECT =
  "id, lead_id, generation_type, prompt_version, prompt_variant, input_snapshot, generated_content, generated_subject, classification, status, source_reply_id, input_hash, playbook_influence_score, playbook_attribution, approved_at, approved_by, sent_at, created_by, created_at"

type SettingsRow = {
  id: string
  ai_copilot_enabled: boolean
  ai_copilot_human_approval_required: boolean
  ai_copilot_store_generations: boolean
  ai_copilot_generation_retention_days: number
  ai_copilot_default_prompt_variant: string
  ai_copilot_playbook_enabled: boolean
  ai_copilot_playbook_max_rules_per_generation: number
  ai_copilot_playbook_source_retention_days: number
  outreach_personalization_enabled: boolean
  outreach_personalization_max_words: number
  call_copilot_enabled: boolean
  call_copilot_require_summary_approval: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}

type GenerationRow = {
  id: string
  lead_id: string
  generation_type: string
  prompt_version: string
  prompt_variant: string
  input_snapshot: unknown
  generated_content: string
  generated_subject: string | null
  classification: unknown
  status: string
  source_reply_id: string | null
  input_hash: string | null
  playbook_influence_score: number
  playbook_attribution: unknown
  approved_at: string | null
  approved_by: string | null
  sent_at: string | null
  created_by: string | null
  created_at: string
}

function mapSettings(row: SettingsRow): GrowthCopilotSettings {
  return {
    id: row.id,
    aiCopilotEnabled: row.ai_copilot_enabled,
    aiCopilotHumanApprovalRequired: row.ai_copilot_human_approval_required,
    aiCopilotStoreGenerations: row.ai_copilot_store_generations,
    aiCopilotGenerationRetentionDays: row.ai_copilot_generation_retention_days,
    aiCopilotDefaultPromptVariant: row.ai_copilot_default_prompt_variant,
    aiCopilotPlaybookEnabled: row.ai_copilot_playbook_enabled ?? true,
    aiCopilotPlaybookMaxRulesPerGeneration: row.ai_copilot_playbook_max_rules_per_generation ?? 12,
    aiCopilotPlaybookSourceRetentionDays: row.ai_copilot_playbook_source_retention_days ?? 30,
    outreachPersonalizationEnabled: row.outreach_personalization_enabled ?? true,
    outreachPersonalizationMaxWords: row.outreach_personalization_max_words ?? 120,
    callCopilotEnabled: resolveGrowthCallCopilotEnabled({
      callCopilotEnabled: row.call_copilot_enabled,
      aiCopilotEnabled: row.ai_copilot_enabled,
    }),
    callCopilotRequireSummaryApproval: resolveGrowthCallCopilotRequireSummaryApproval({
      callCopilotRequireSummaryApproval: row.call_copilot_require_summary_approval,
    }),
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapGeneration(row: GenerationRow): GrowthAiCopilotGeneration {
  return {
    id: row.id,
    leadId: row.lead_id,
    generationType: row.generation_type as GrowthAiCopilotGenerationType,
    promptVersion: row.prompt_version,
    promptVariant: row.prompt_variant,
    inputSnapshot: (row.input_snapshot as Record<string, unknown>) ?? {},
    generatedContent: row.generated_content,
    generatedSubject: row.generated_subject,
    classification: (row.classification as GrowthAiCopilotGeneration["classification"]) ?? {},
    status: row.status as GrowthAiCopilotGenerationStatus,
    sourceReplyId: row.source_reply_id,
    inputHash: row.input_hash,
    playbookInfluenceScore: row.playbook_influence_score ?? 0,
    playbookAttribution: (row.playbook_attribution as Record<string, unknown>) ?? {},
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    sentAt: row.sent_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export async function fetchGrowthCopilotSettings(admin: SupabaseClient): Promise<GrowthCopilotSettings> {
  const { data, error } = await copilotSettingsTable(admin).select(SETTINGS_SELECT).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return mapSettings(data as SettingsRow)

  const { data: inserted, error: insertError } = await copilotSettingsTable(admin)
    .insert({ singleton: true })
    .select(SETTINGS_SELECT)
    .single()
  if (insertError) throw new Error(insertError.message)
  return mapSettings(inserted as SettingsRow)
}

export async function updateGrowthCopilotSettings(
  admin: SupabaseClient,
  input: {
    aiCopilotEnabled?: boolean
    aiCopilotStoreGenerations?: boolean
    aiCopilotGenerationRetentionDays?: number
    aiCopilotDefaultPromptVariant?: string
    aiCopilotPlaybookEnabled?: boolean
    aiCopilotPlaybookMaxRulesPerGeneration?: number
    aiCopilotPlaybookSourceRetentionDays?: number
    outreachPersonalizationEnabled?: boolean
    outreachPersonalizationMaxWords?: number
    updatedBy: string
  },
): Promise<GrowthCopilotSettings> {
  const existing = await fetchGrowthCopilotSettings(admin)
  const patch: Record<string, unknown> = {
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
    ai_copilot_human_approval_required: true,
  }
  if (input.aiCopilotEnabled !== undefined) patch.ai_copilot_enabled = input.aiCopilotEnabled
  if (input.aiCopilotStoreGenerations !== undefined) {
    patch.ai_copilot_store_generations = input.aiCopilotStoreGenerations
  }
  if (input.aiCopilotGenerationRetentionDays !== undefined) {
    patch.ai_copilot_generation_retention_days = input.aiCopilotGenerationRetentionDays
  }
  if (input.aiCopilotDefaultPromptVariant !== undefined) {
    patch.ai_copilot_default_prompt_variant = input.aiCopilotDefaultPromptVariant
  }
  if (input.aiCopilotPlaybookEnabled !== undefined) {
    patch.ai_copilot_playbook_enabled = input.aiCopilotPlaybookEnabled
  }
  if (input.aiCopilotPlaybookMaxRulesPerGeneration !== undefined) {
    patch.ai_copilot_playbook_max_rules_per_generation = input.aiCopilotPlaybookMaxRulesPerGeneration
  }
  if (input.aiCopilotPlaybookSourceRetentionDays !== undefined) {
    patch.ai_copilot_playbook_source_retention_days = input.aiCopilotPlaybookSourceRetentionDays
  }
  if (input.outreachPersonalizationEnabled !== undefined) {
    patch.outreach_personalization_enabled = input.outreachPersonalizationEnabled
  }
  if (input.outreachPersonalizationMaxWords !== undefined) {
    patch.outreach_personalization_max_words = input.outreachPersonalizationMaxWords
  }
  if (input.callCopilotEnabled !== undefined) patch.call_copilot_enabled = input.callCopilotEnabled
  if (input.callCopilotRequireSummaryApproval !== undefined) {
    patch.call_copilot_require_summary_approval = input.callCopilotRequireSummaryApproval
  }

  const { data, error } = await copilotSettingsTable(admin)
    .update(patch)
    .eq("id", existing.id)
    .select(SETTINGS_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapSettings(data as SettingsRow)
}

export async function listGrowthAiCopilotRules(admin: SupabaseClient): Promise<GrowthAiCopilotRule[]> {
  const { data, error } = await copilotRulesTable(admin).select(RULES_SELECT).order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    ruleKey: row.rule_key as string,
    label: row.label as string,
    description: (row.description as string | null) ?? null,
    enabled: row.enabled as boolean,
    ruleConfig: (row.rule_config as Record<string, unknown>) ?? {},
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }))
}

export async function updateGrowthAiCopilotRule(
  admin: SupabaseClient,
  ruleKey: string,
  input: { enabled?: boolean; ruleConfig?: Record<string, unknown> },
): Promise<GrowthAiCopilotRule> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.enabled !== undefined) patch.enabled = input.enabled
  if (input.ruleConfig !== undefined) patch.rule_config = input.ruleConfig

  const { data, error } = await copilotRulesTable(admin)
    .update(patch)
    .eq("rule_key", ruleKey)
    .select(RULES_SELECT)
    .single()
  if (error) throw new Error(error.message)

  return {
    id: data.id as string,
    ruleKey: data.rule_key as string,
    label: data.label as string,
    description: (data.description as string | null) ?? null,
    enabled: data.enabled as boolean,
    ruleConfig: (data.rule_config as Record<string, unknown>) ?? {},
    sortOrder: data.sort_order as number,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  }
}

export async function insertGrowthAiCopilotGeneration(
  admin: SupabaseClient,
  input: {
    leadId: string
    generationType: GrowthAiCopilotGenerationType
    promptVersion: string
    promptVariant: string
    inputSnapshot: Record<string, unknown>
    generatedContent: string
    generatedSubject: string | null
    classification: Record<string, unknown>
    sourceReplyId?: string | null
    inputHash?: string | null
    playbookInfluenceScore?: number
    playbookAttribution?: Record<string, unknown>
    createdBy: string | null
  },
): Promise<GrowthAiCopilotGeneration> {
  const { data, error } = await generationsTable(admin)
    .insert({
      lead_id: input.leadId,
      generation_type: input.generationType,
      prompt_version: input.promptVersion,
      prompt_variant: input.promptVariant,
      input_snapshot: input.inputSnapshot,
      generated_content: input.generatedContent,
      generated_subject: input.generatedSubject,
      classification: input.classification,
      status: "draft",
      source_reply_id: input.sourceReplyId ?? null,
      input_hash: input.inputHash ?? null,
      playbook_influence_score: input.playbookInfluenceScore ?? 0,
      playbook_attribution: input.playbookAttribution ?? {},
      created_by: input.createdBy,
    })
    .select(GENERATION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGeneration(data as GenerationRow)
}

export async function fetchGrowthAiCopilotGenerationById(
  admin: SupabaseClient,
  generationId: string,
): Promise<GrowthAiCopilotGeneration | null> {
  const { data, error } = await generationsTable(admin).select(GENERATION_SELECT).eq("id", generationId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGeneration(data as GenerationRow) : null
}

export async function listGrowthAiCopilotGenerationsForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 20,
): Promise<GrowthAiCopilotGeneration[]> {
  const { data, error } = await generationsTable(admin)
    .select(GENERATION_SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGeneration(row as GenerationRow))
}

export async function listGrowthAiCopilotGenerations(
  admin: SupabaseClient,
  input: { status?: GrowthAiCopilotGenerationStatus; limit?: number },
): Promise<GrowthAiCopilotGeneration[]> {
  let query = generationsTable(admin).select(GENERATION_SELECT).order("created_at", { ascending: false })
  if (input.status) query = query.eq("status", input.status)
  query = query.limit(Math.min(input.limit ?? 50, 100))
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGeneration(row as GenerationRow))
}

export async function updateGrowthAiCopilotGenerationRecord(
  admin: SupabaseClient,
  generationId: string,
  input: {
    generatedContent?: string
    generatedSubject?: string | null
    classification?: Record<string, unknown>
    sentAt?: string | null
    status?: GrowthAiCopilotGenerationStatus
  },
): Promise<GrowthAiCopilotGeneration> {
  if (input.generatedContent !== undefined || input.generatedSubject !== undefined) {
    const existing = await fetchGrowthAiCopilotGenerationById(admin, generationId)
    if (existing) {
      const invalidated = await invalidateAvaSupervisedApprovalOnContentChange(admin, existing, {
        generatedContent: input.generatedContent,
        generatedSubject: input.generatedSubject,
      })
      if (invalidated) return invalidated
    }
  }

  const patch: Record<string, unknown> = {}
  if (input.generatedContent !== undefined) patch.generated_content = input.generatedContent
  if (input.generatedSubject !== undefined) patch.generated_subject = input.generatedSubject
  if (input.classification !== undefined) patch.classification = input.classification
  if (input.sentAt !== undefined) patch.sent_at = input.sentAt
  if (input.status !== undefined) patch.status = input.status

  const { data, error } = await generationsTable(admin)
    .update(patch)
    .eq("id", generationId)
    .select(GENERATION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGeneration(data as GenerationRow)
}

export async function invalidateAvaSupervisedApprovalOnContentChange(
  admin: SupabaseClient,
  generation: GrowthAiCopilotGeneration,
  next: {
    generatedContent?: string
    generatedSubject?: string | null
  },
): Promise<GrowthAiCopilotGeneration | null> {
  const { isAvaSupervisedOutboundGeneration, readAvaSupervisedOutboundApprovalBinding } =
    await import("@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types")
  const { detectAvaSupervisedApprovalContentDrift } = await import(
    "@/lib/growth/ava-reasoning/ava-supervised-outbound-bundle-verification"
  )
  const { stripAccidentalAvaSignatureFromBody } = await import(
    "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
  )

  if (!isAvaSupervisedOutboundGeneration(generation) || generation.status !== "approved") {
    return null
  }

  const binding = readAvaSupervisedOutboundApprovalBinding(
    generation.classification as Record<string, unknown>,
  )
  if (!binding) return null

  const draft = {
    ...generation,
    generatedContent: next.generatedContent ?? generation.generatedContent,
    generatedSubject:
      next.generatedSubject === undefined ? generation.generatedSubject : next.generatedSubject,
  }

  const unsignedBody = stripAccidentalAvaSignatureFromBody(draft.generatedContent)
  if (
    !detectAvaSupervisedApprovalContentDrift({
      generation: draft,
      binding,
      unsignedBody,
    })
  ) {
    return null
  }

  const classification = { ...(generation.classification as Record<string, unknown>) }
  delete classification.avaSupervisedOutboundApproval
  delete classification.avaSupervisedOutboundSendReceipt
  delete classification.avaSupervisedOutboundSendLifecycle

  return updateGrowthAiCopilotGenerationRecord(admin, generation.id, {
    generatedContent: draft.generatedContent,
    generatedSubject: draft.generatedSubject,
    status: "draft",
    classification,
    sentAt: null,
  })
}

export async function invalidateAvaSupervisedApprovalsForSenderMigration(
  admin: SupabaseClient,
  input: {
    leadId: string
    previousAssignmentId: string
    previousSenderAccountId: string
    contactEmail: string
  },
): Promise<number> {
  const { isAvaSupervisedOutboundGeneration, readAvaSupervisedOutboundApprovalBinding } =
    await import("@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types")

  const contactNormalized = input.contactEmail.trim().toLowerCase()
  const { data, error } = await generationsTable(admin)
    .select(GENERATION_SELECT)
    .eq("lead_id", input.leadId)
    .eq("status", "approved")
    .is("sent_at", null)

  if (error) throw new Error(error.message)
  let invalidated = 0

  for (const row of data ?? []) {
    const generation = mapGeneration(row as GenerationRow)
    if (!isAvaSupervisedOutboundGeneration(generation)) continue

    const binding = readAvaSupervisedOutboundApprovalBinding(
      generation.classification as Record<string, unknown>,
    )
    if (!binding) continue

    const recipientMatches = binding.recipientEmail.trim().toLowerCase() === contactNormalized
    const assignmentMatches =
      binding.senderAssignmentId === input.previousAssignmentId ||
      binding.senderAccountId === input.previousSenderAccountId

    if (!recipientMatches || !assignmentMatches) continue

    const classification = { ...(generation.classification as Record<string, unknown>) }
    delete classification.avaSupervisedOutboundApproval
    delete classification.avaSupervisedOutboundSendReceipt
    delete classification.avaSupervisedOutboundSendLifecycle

    await updateGrowthAiCopilotGenerationRecord(admin, generation.id, {
      status: "draft",
      classification,
      sentAt: null,
    })
    invalidated += 1
  }

  return invalidated
}

export async function updateGrowthAiCopilotGenerationStatus(
  admin: SupabaseClient,
  generationId: string,
  input: {
    status: GrowthAiCopilotGenerationStatus
    approvedBy?: string | null
  },
): Promise<GrowthAiCopilotGeneration> {
  const patch: Record<string, unknown> = { status: input.status }
  if (input.status === "approved") {
    patch.approved_at = new Date().toISOString()
    patch.approved_by = input.approvedBy ?? null
  }

  const { data, error } = await generationsTable(admin)
    .update(patch)
    .eq("id", generationId)
    .select(GENERATION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGeneration(data as GenerationRow)
}

export async function insertGrowthAiCopilotEffectiveness(
  admin: SupabaseClient,
  input: {
    generationId: string
    leadId: string
    generationType: GrowthAiCopilotGenerationType
    promptVariant: string
    promptVersion: string
    outcome: "generated" | "approved" | "discarded" | "expired"
    classificationPrimary?: string | null
    effectivenessScore?: number
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await effectivenessTable(admin).insert({
    generation_id: input.generationId,
    lead_id: input.leadId,
    generation_type: input.generationType,
    prompt_variant: input.promptVariant,
    prompt_version: input.promptVersion,
    outcome: input.outcome,
    classification_primary: input.classificationPrimary ?? null,
    effectiveness_score: input.effectivenessScore ?? 0,
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export async function purgeExpiredGrowthAiCopilotGenerations(
  admin: SupabaseClient,
  retentionDays: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await generationsTable(admin)
    .update({ status: "expired" })
    .lt("created_at", cutoff)
    .in("status", ["draft", "discarded"])
    .select("id")
  if (error) throw new Error(error.message)
  return (data ?? []).length
}
