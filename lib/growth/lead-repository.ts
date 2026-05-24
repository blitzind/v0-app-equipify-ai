import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type {
  CreateGrowthLeadInput,
  GrowthLead,
  GrowthLeadStatus,
  ListGrowthLeadsInput,
  UpdateGrowthLeadInput,
} from "@/lib/growth/types"

const LEAD_SELECT =
  "id, source_kind, source_detail, external_ref, company_name, contact_name, contact_email, contact_phone, website, address_line1, city, state, postal_code, country, status, promoted_organization_id, promoted_prospect_id, promoted_at, score, notes, metadata, latest_research_run_id, last_researched_at, research_priority, call_disposition, call_disposition_at, last_call_at, follow_up_at, call_priority_score, call_priority_tier, call_priority_computed_at, call_priority_override, last_human_touch_at, decision_maker_status, primary_decision_maker_id, next_best_action, next_best_action_reason, next_best_action_computed_at, estimated_annual_revenue, estimated_employee_count, fleet_size_estimate, crm_detected, field_service_stack_detected, momentum_score, momentum_tier, momentum_why_summary, momentum_computed_at, workflow_health, workflow_health_reason, workflow_health_computed_at, source_channel, source_campaign, source_import_batch_id, source_vendor, aging_days, aging_bucket, first_human_touch_at, time_to_first_touch_hours, contact_temperature, call_attempt_count, voicemail_count, connected_call_count, engagement_score, engagement_tier, engagement_last_activity_at, engagement_summary, engagement_top_signals, engagement_dormancy_exempt_until, engagement_computed_at, relationship_strength_score, relationship_strength_tier, relationship_last_meaningful_touch_at, relationship_summary, relationship_top_signals, relationship_trend, relationship_previous_score, relationship_owner_attention_level, relationship_recovery_attempt_count, relationship_computed_at, opportunity_readiness_score, opportunity_readiness_tier, opportunity_readiness_summary, opportunity_readiness_top_signals, opportunity_blockers, opportunity_accelerators, opportunity_readiness_trend, opportunity_readiness_previous_score, opportunity_buying_signal_strength, opportunity_readiness_confidence, opportunity_age_bucket, opportunity_readiness_computed_at, revenue_probability_score, revenue_probability_tier, revenue_probability_summary, revenue_probability_top_signals, revenue_probability_confidence, revenue_probability_previous_score, revenue_trajectory, revenue_probability_volatility, forecast_contribution_weight, forecast_attention_level, forecast_attention_last_changed_at, revenue_forecast_computed_at, executive_priority_score, executive_priority_tier, executive_priority_summary, executive_priority_top_signals, executive_priority_volatility, executive_priority_previous_score, intelligence_conflicts, intelligence_conflict_severity_score, executive_recommendation, executive_owner, executive_intervention_opened_at, executive_intervention_age_bucket, executive_operating_computed_at, operational_capacity_score, operational_capacity_tier, operational_capacity_summary, operational_capacity_top_constraints, capacity_pressure_level, capacity_pressure_volatility, protected_pipeline_coverage, operational_constraints, capacity_conflicts, capacity_protection_recommendation, constraint_opened_at, constraint_age_bucket, capacity_recovery_direction, operational_capacity_previous_score, operational_capacity_computed_at, conversation_health_score, conversation_health_tier, conversation_summary, conversation_top_signals, conversation_sentiment, conversation_urgency_level, conversation_buying_intent, conversation_objection_profile, conversation_competitor_mentions, conversation_competitor_pressure, conversation_last_meaningful_conversation_at, conversation_previous_score, conversation_trend, conversation_confidence, conversation_momentum, conversation_response_pattern, conversation_computed_at, recommended_sequence_pattern_id, recommended_sequence_reason, recommended_sequence_confidence, recommended_sequence_next_step, sequence_fatigue_risk, recommended_sequence_computed_at, created_by, assigned_to, created_at, updated_at"

type GrowthLeadDbRow = {
  id: string
  source_kind: string
  source_detail: string | null
  external_ref: string | null
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  status: string
  promoted_organization_id: string | null
  promoted_prospect_id: string | null
  promoted_at: string | null
  score: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
  latest_research_run_id: string | null
  last_researched_at: string | null
  research_priority: string
  call_disposition: string | null
  call_disposition_at: string | null
  last_call_at: string | null
  follow_up_at: string | null
  call_priority_score: number | null
  call_priority_tier: string | null
  call_priority_computed_at: string | null
  call_priority_override: number | null
  last_human_touch_at: string | null
  decision_maker_status: string | null
  primary_decision_maker_id: string | null
  next_best_action: string | null
  next_best_action_reason: string | null
  next_best_action_computed_at: string | null
  estimated_annual_revenue: string | null
  estimated_employee_count: string | null
  fleet_size_estimate: string | null
  crm_detected: string | null
  field_service_stack_detected: string | null
  momentum_score: number | null
  momentum_tier: string | null
  momentum_why_summary: string | null
  momentum_computed_at: string | null
  workflow_health: string | null
  workflow_health_reason: string | null
  workflow_health_computed_at: string | null
  source_channel: string | null
  source_campaign: string | null
  source_import_batch_id: string | null
  source_vendor: string | null
  aging_days: number | null
  aging_bucket: string | null
  first_human_touch_at: string | null
  time_to_first_touch_hours: number | null
  contact_temperature: string | null
  call_attempt_count: number | null
  voicemail_count: number | null
  connected_call_count: number | null
  engagement_score: number | null
  engagement_tier: string | null
  engagement_last_activity_at: string | null
  engagement_summary: string | null
  engagement_top_signals: unknown
  engagement_dormancy_exempt_until: string | null
  engagement_computed_at: string | null
  relationship_strength_score: number | null
  relationship_strength_tier: string | null
  relationship_last_meaningful_touch_at: string | null
  relationship_summary: string | null
  relationship_top_signals: unknown
  relationship_trend: string | null
  relationship_previous_score: number | null
  relationship_owner_attention_level: string
  relationship_recovery_attempt_count: number
  relationship_computed_at: string | null
  opportunity_readiness_score: number | null
  opportunity_readiness_tier: string | null
  opportunity_readiness_summary: string | null
  opportunity_readiness_top_signals: unknown
  opportunity_blockers: unknown
  opportunity_accelerators: unknown
  opportunity_readiness_trend: string | null
  opportunity_readiness_previous_score: number | null
  opportunity_buying_signal_strength: string
  opportunity_readiness_confidence: number
  opportunity_age_bucket: string
  opportunity_readiness_computed_at: string | null
  revenue_probability_score: number | null
  revenue_probability_tier: string | null
  revenue_probability_summary: string | null
  revenue_probability_top_signals: unknown
  revenue_probability_confidence: number
  revenue_probability_previous_score: number | null
  revenue_trajectory: string
  revenue_probability_volatility: number
  forecast_contribution_weight: number
  forecast_attention_level: string
  forecast_attention_last_changed_at: string | null
  revenue_forecast_computed_at: string | null
  executive_priority_score: number | null
  executive_priority_tier: string | null
  executive_priority_summary: string | null
  executive_priority_top_signals: unknown
  executive_priority_volatility: number
  executive_priority_previous_score: number | null
  intelligence_conflicts: unknown
  intelligence_conflict_severity_score: number
  executive_recommendation: string | null
  executive_owner: string | null
  executive_intervention_opened_at: string | null
  executive_intervention_age_bucket: string
  executive_operating_computed_at: string | null
  operational_capacity_score: number | null
  operational_capacity_tier: string | null
  operational_capacity_summary: string | null
  operational_capacity_top_constraints: unknown
  capacity_pressure_level: number
  capacity_pressure_volatility: number
  protected_pipeline_coverage: number
  operational_constraints: unknown
  capacity_conflicts: unknown
  capacity_protection_recommendation: string | null
  constraint_opened_at: string | null
  constraint_age_bucket: string
  capacity_recovery_direction: string
  operational_capacity_previous_score: number | null
  operational_capacity_computed_at: string | null
  conversation_health_score: number | null
  conversation_health_tier: string | null
  conversation_summary: string | null
  conversation_top_signals: unknown
  conversation_sentiment: string | null
  conversation_urgency_level: string | null
  conversation_buying_intent: string | null
  conversation_objection_profile: unknown
  conversation_competitor_mentions: unknown
  conversation_competitor_pressure: number | null
  conversation_last_meaningful_conversation_at: string | null
  conversation_previous_score: number | null
  conversation_trend: string | null
  conversation_confidence: number | null
  conversation_momentum: string | null
  conversation_response_pattern: string | null
  conversation_computed_at: string | null
  recommended_sequence_pattern_id: string | null
  recommended_sequence_reason: string | null
  recommended_sequence_confidence: number | null
  recommended_sequence_next_step: unknown
  sequence_fatigue_risk: string | null
  recommended_sequence_computed_at: string | null
  created_by: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function mapGrowthLeadRow(row: GrowthLeadDbRow): GrowthLead {
  return {
    id: row.id,
    sourceKind: row.source_kind as GrowthLead["sourceKind"],
    sourceDetail: row.source_detail,
    externalRef: row.external_ref,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    website: row.website,
    addressLine1: row.address_line1,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    status: row.status as GrowthLeadStatus,
    promotedOrganizationId: row.promoted_organization_id,
    promotedProspectId: row.promoted_prospect_id,
    promotedAt: row.promoted_at,
    score: row.score,
    notes: row.notes,
    metadata: row.metadata ?? {},
    latestResearchRunId: row.latest_research_run_id,
    lastResearchedAt: row.last_researched_at,
    researchPriority: row.research_priority as GrowthLead["researchPriority"],
    callDisposition: row.call_disposition as GrowthLead["callDisposition"],
    callDispositionAt: row.call_disposition_at,
    lastCallAt: row.last_call_at,
    followUpAt: row.follow_up_at,
    callPriorityScore: row.call_priority_score,
    callPriorityTier: row.call_priority_tier as GrowthLead["callPriorityTier"],
    callPriorityComputedAt: row.call_priority_computed_at,
    callPriorityOverride: row.call_priority_override,
    lastHumanTouchAt: row.last_human_touch_at,
    decisionMakerStatus: row.decision_maker_status as GrowthLead["decisionMakerStatus"],
    primaryDecisionMakerId: row.primary_decision_maker_id,
    nextBestAction: row.next_best_action as GrowthLead["nextBestAction"],
    nextBestActionReason: row.next_best_action_reason,
    nextBestActionComputedAt: row.next_best_action_computed_at,
    estimatedAnnualRevenue: row.estimated_annual_revenue,
    estimatedEmployeeCount: row.estimated_employee_count,
    fleetSizeEstimate: row.fleet_size_estimate,
    crmDetected: row.crm_detected,
    fieldServiceStackDetected: row.field_service_stack_detected,
    momentumScore: row.momentum_score,
    momentumTier: row.momentum_tier as GrowthLead["momentumTier"],
    momentumWhySummary: row.momentum_why_summary,
    momentumComputedAt: row.momentum_computed_at,
    workflowHealth: row.workflow_health as GrowthLead["workflowHealth"],
    workflowHealthReason: row.workflow_health_reason,
    workflowHealthComputedAt: row.workflow_health_computed_at,
    sourceChannel: row.source_channel,
    sourceCampaign: row.source_campaign,
    sourceImportBatchId: row.source_import_batch_id,
    sourceVendor: row.source_vendor,
    agingDays: row.aging_days,
    agingBucket: row.aging_bucket as GrowthLead["agingBucket"],
    firstHumanTouchAt: row.first_human_touch_at,
    timeToFirstTouchHours: row.time_to_first_touch_hours,
    contactTemperature: row.contact_temperature as GrowthLead["contactTemperature"],
    callAttemptCount: row.call_attempt_count ?? 0,
    voicemailCount: row.voicemail_count ?? 0,
    connectedCallCount: row.connected_call_count ?? 0,
    engagementScore: row.engagement_score,
    engagementTier: row.engagement_tier as GrowthLead["engagementTier"],
    engagementLastActivityAt: row.engagement_last_activity_at,
    engagementSummary: row.engagement_summary,
    engagementTopSignals: Array.isArray(row.engagement_top_signals)
      ? (row.engagement_top_signals as GrowthLead["engagementTopSignals"])
      : [],
    engagementDormancyExemptUntil: row.engagement_dormancy_exempt_until,
    engagementComputedAt: row.engagement_computed_at,
    relationshipStrengthScore: row.relationship_strength_score,
    relationshipStrengthTier: row.relationship_strength_tier as GrowthLead["relationshipStrengthTier"],
    relationshipLastMeaningfulTouchAt: row.relationship_last_meaningful_touch_at,
    relationshipSummary: row.relationship_summary,
    relationshipTopSignals: Array.isArray(row.relationship_top_signals)
      ? (row.relationship_top_signals as GrowthLead["relationshipTopSignals"])
      : [],
    relationshipTrend: row.relationship_trend as GrowthLead["relationshipTrend"],
    relationshipPreviousScore: row.relationship_previous_score,
    relationshipOwnerAttentionLevel: (row.relationship_owner_attention_level ??
      "none") as GrowthLead["relationshipOwnerAttentionLevel"],
    relationshipRecoveryAttemptCount: row.relationship_recovery_attempt_count ?? 0,
    relationshipComputedAt: row.relationship_computed_at,
    opportunityReadinessScore: row.opportunity_readiness_score,
    opportunityReadinessTier: row.opportunity_readiness_tier as GrowthLead["opportunityReadinessTier"],
    opportunityReadinessSummary: row.opportunity_readiness_summary,
    opportunityReadinessTopSignals: Array.isArray(row.opportunity_readiness_top_signals)
      ? (row.opportunity_readiness_top_signals as GrowthLead["opportunityReadinessTopSignals"])
      : [],
    opportunityBlockers: Array.isArray(row.opportunity_blockers)
      ? (row.opportunity_blockers as GrowthLead["opportunityBlockers"])
      : [],
    opportunityAccelerators: Array.isArray(row.opportunity_accelerators)
      ? (row.opportunity_accelerators as GrowthLead["opportunityAccelerators"])
      : [],
    opportunityReadinessTrend: row.opportunity_readiness_trend as GrowthLead["opportunityReadinessTrend"],
    opportunityReadinessPreviousScore: row.opportunity_readiness_previous_score,
    opportunityBuyingSignalStrength: (row.opportunity_buying_signal_strength ??
      "none") as GrowthLead["opportunityBuyingSignalStrength"],
    opportunityReadinessConfidence: row.opportunity_readiness_confidence ?? 0,
    opportunityAgeBucket: (row.opportunity_age_bucket ?? "new") as GrowthLead["opportunityAgeBucket"],
    opportunityReadinessComputedAt: row.opportunity_readiness_computed_at,
    revenueProbabilityScore: row.revenue_probability_score,
    revenueProbabilityTier: row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"],
    revenueProbabilitySummary: row.revenue_probability_summary,
    revenueProbabilityTopSignals: Array.isArray(row.revenue_probability_top_signals)
      ? (row.revenue_probability_top_signals as GrowthLead["revenueProbabilityTopSignals"])
      : [],
    revenueProbabilityConfidence: row.revenue_probability_confidence ?? 0,
    revenueProbabilityPreviousScore: row.revenue_probability_previous_score,
    revenueTrajectory: (row.revenue_trajectory ?? "steady") as GrowthLead["revenueTrajectory"],
    revenueProbabilityVolatility: row.revenue_probability_volatility ?? 0,
    forecastContributionWeight: row.forecast_contribution_weight ?? 0,
    forecastAttentionLevel: (row.forecast_attention_level ??
      "none") as GrowthLead["forecastAttentionLevel"],
    forecastAttentionLastChangedAt: row.forecast_attention_last_changed_at,
    revenueForecastComputedAt: row.revenue_forecast_computed_at,
    executivePriorityScore: row.executive_priority_score,
    executivePriorityTier: row.executive_priority_tier as GrowthLead["executivePriorityTier"],
    executivePrioritySummary: row.executive_priority_summary,
    executivePriorityTopSignals: Array.isArray(row.executive_priority_top_signals)
      ? (row.executive_priority_top_signals as GrowthLead["executivePriorityTopSignals"])
      : [],
    executivePriorityVolatility: row.executive_priority_volatility ?? 0,
    executivePriorityPreviousScore: row.executive_priority_previous_score,
    intelligenceConflicts: Array.isArray(row.intelligence_conflicts)
      ? (row.intelligence_conflicts as GrowthLead["intelligenceConflicts"])
      : [],
    intelligenceConflictSeverityScore: row.intelligence_conflict_severity_score ?? 0,
    executiveRecommendation: row.executive_recommendation,
    executiveOwner: row.executive_owner,
    executiveInterventionOpenedAt: row.executive_intervention_opened_at,
    executiveInterventionAgeBucket: (row.executive_intervention_age_bucket ??
      "new") as GrowthLead["executiveInterventionAgeBucket"],
    executiveOperatingComputedAt: row.executive_operating_computed_at,
    operationalCapacityScore: row.operational_capacity_score,
    operationalCapacityTier: row.operational_capacity_tier as GrowthLead["operationalCapacityTier"],
    operationalCapacitySummary: row.operational_capacity_summary,
    operationalCapacityTopConstraints: Array.isArray(row.operational_capacity_top_constraints)
      ? (row.operational_capacity_top_constraints as GrowthLead["operationalCapacityTopConstraints"])
      : [],
    capacityPressureLevel: row.capacity_pressure_level ?? 0,
    capacityPressureVolatility: row.capacity_pressure_volatility ?? 0,
    protectedPipelineCoverage: row.protected_pipeline_coverage ?? 0,
    operationalConstraints: Array.isArray(row.operational_constraints)
      ? (row.operational_constraints as GrowthLead["operationalConstraints"])
      : [],
    capacityConflicts: Array.isArray(row.capacity_conflicts)
      ? (row.capacity_conflicts as GrowthLead["capacityConflicts"])
      : [],
    capacityProtectionRecommendation: row.capacity_protection_recommendation,
    constraintOpenedAt: row.constraint_opened_at,
    constraintAgeBucket: (row.constraint_age_bucket ?? "new") as GrowthLead["constraintAgeBucket"],
    capacityRecoveryDirection: (row.capacity_recovery_direction ??
      "stable") as GrowthLead["capacityRecoveryDirection"],
    operationalCapacityPreviousScore: row.operational_capacity_previous_score,
    operationalCapacityComputedAt: row.operational_capacity_computed_at,
    conversationHealthScore: row.conversation_health_score,
    conversationHealthTier: row.conversation_health_tier as GrowthLead["conversationHealthTier"],
    conversationSummary: row.conversation_summary,
    conversationTopSignals: Array.isArray(row.conversation_top_signals)
      ? (row.conversation_top_signals as GrowthLead["conversationTopSignals"])
      : [],
    conversationSentiment: row.conversation_sentiment as GrowthLead["conversationSentiment"],
    conversationUrgencyLevel: row.conversation_urgency_level as GrowthLead["conversationUrgencyLevel"],
    conversationBuyingIntent: row.conversation_buying_intent as GrowthLead["conversationBuyingIntent"],
    conversationObjectionProfile:
      row.conversation_objection_profile &&
      typeof row.conversation_objection_profile === "object" &&
      !Array.isArray(row.conversation_objection_profile)
        ? (row.conversation_objection_profile as GrowthLead["conversationObjectionProfile"])
        : { clusters: [], totalSeverityScore: 0 },
    conversationCompetitorMentions: Array.isArray(row.conversation_competitor_mentions)
      ? (row.conversation_competitor_mentions as GrowthLead["conversationCompetitorMentions"])
      : [],
    conversationCompetitorPressure: row.conversation_competitor_pressure,
    conversationLastMeaningfulConversationAt: row.conversation_last_meaningful_conversation_at,
    conversationPreviousScore: row.conversation_previous_score,
    conversationTrend: row.conversation_trend as GrowthLead["conversationTrend"],
    conversationConfidence: row.conversation_confidence,
    conversationMomentum: row.conversation_momentum as GrowthLead["conversationMomentum"],
    conversationResponsePattern: row.conversation_response_pattern as GrowthLead["conversationResponsePattern"],
    conversationComputedAt: row.conversation_computed_at,
    recommendedSequencePatternId: row.recommended_sequence_pattern_id,
    recommendedSequenceReason: row.recommended_sequence_reason,
    recommendedSequenceConfidence: row.recommended_sequence_confidence,
    recommendedSequenceNextStep:
      row.recommended_sequence_next_step &&
      typeof row.recommended_sequence_next_step === "object" &&
      !Array.isArray(row.recommended_sequence_next_step)
        ? (row.recommended_sequence_next_step as GrowthLead["recommendedSequenceNextStep"])
        : {},
    sequenceFatigueRisk: row.sequence_fatigue_risk as GrowthLead["sequenceFatigueRisk"],
    recommendedSequenceComputedAt: row.recommended_sequence_computed_at,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listGrowthLeads(
  admin: SupabaseClient,
  input: ListGrowthLeadsInput = {},
): Promise<GrowthLead[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200)
  const offset = Math.max(input.offset ?? 0, 0)

  let query = growthLeadsTable(admin).select(LEAD_SELECT).order("created_at", { ascending: false })

  if (input.status) {
    query = query.eq("status", input.status)
  }

  const { data, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    logGrowthEngine("lead_list_failed", {
      table: "growth.leads",
      action: "select",
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  return ((data ?? []) as GrowthLeadDbRow[]).map(mapGrowthLeadRow)
}

export async function fetchGrowthLeadById(admin: SupabaseClient, leadId: string): Promise<GrowthLead | null> {
  const { data, error } = await growthLeadsTable(admin).select(LEAD_SELECT).eq("id", leadId).maybeSingle()

  if (error) {
    logGrowthEngine("lead_fetch_failed", {
      table: "growth.leads",
      action: "select",
      leadId,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  return data ? mapGrowthLeadRow(data as GrowthLeadDbRow) : null
}

export async function createGrowthLead(
  admin: SupabaseClient,
  input: CreateGrowthLeadInput,
): Promise<GrowthLead> {
  const companyName = input.companyName.trim()
  if (!companyName) {
    throw new Error("company_name_required")
  }

  const row = {
    source_kind: input.sourceKind ?? "manual",
    source_detail: trimOrNull(input.sourceDetail),
    external_ref: trimOrNull(input.externalRef),
    company_name: companyName,
    contact_name: trimOrNull(input.contactName),
    contact_email: trimOrNull(input.contactEmail),
    contact_phone: trimOrNull(input.contactPhone),
    website: trimOrNull(input.website),
    address_line1: trimOrNull(input.addressLine1),
    city: trimOrNull(input.city),
    state: trimOrNull(input.state),
    postal_code: trimOrNull(input.postalCode),
    country: trimOrNull(input.country) ?? "US",
    status: input.status ?? "new",
    score: input.score ?? null,
    notes: trimOrNull(input.notes),
    metadata: input.metadata ?? {},
    research_priority: input.researchPriority ?? "normal",
    source_channel: trimOrNull(input.sourceChannel),
    source_campaign: trimOrNull(input.sourceCampaign),
    source_import_batch_id: input.sourceImportBatchId ?? null,
    source_vendor: trimOrNull(input.sourceVendor),
    assigned_to: trimOrNull(input.assignedTo),
    created_by: trimOrNull(input.createdBy),
  }

  const { data, error } = await growthLeadsTable(admin).insert(row).select(LEAD_SELECT).single()

  if (error) {
    logGrowthEngine("lead_create_failed", {
      table: "growth.leads",
      action: "insert",
      code: error.code ?? null,
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })
    throw new Error(error.message)
  }

  const lead = mapGrowthLeadRow(data as GrowthLeadDbRow)
  logGrowthEngine("lead_created", {
    leadId: lead.id,
    status: lead.status,
    sourceKind: lead.sourceKind,
    companyName: lead.companyName,
  })
  return lead
}

export async function updateGrowthLead(
  admin: SupabaseClient,
  leadId: string,
  input: UpdateGrowthLeadInput,
): Promise<GrowthLead | null> {
  const patch: Record<string, unknown> = {}

  if (input.sourceKind !== undefined) patch.source_kind = input.sourceKind
  if (input.sourceDetail !== undefined) patch.source_detail = trimOrNull(input.sourceDetail)
  if (input.externalRef !== undefined) patch.external_ref = trimOrNull(input.externalRef)
  if (input.companyName !== undefined) {
    const companyName = input.companyName.trim()
    if (!companyName) throw new Error("company_name_required")
    patch.company_name = companyName
  }
  if (input.contactName !== undefined) patch.contact_name = trimOrNull(input.contactName)
  if (input.contactEmail !== undefined) patch.contact_email = trimOrNull(input.contactEmail)
  if (input.contactPhone !== undefined) patch.contact_phone = trimOrNull(input.contactPhone)
  if (input.website !== undefined) patch.website = trimOrNull(input.website)
  if (input.addressLine1 !== undefined) patch.address_line1 = trimOrNull(input.addressLine1)
  if (input.city !== undefined) patch.city = trimOrNull(input.city)
  if (input.state !== undefined) patch.state = trimOrNull(input.state)
  if (input.postalCode !== undefined) patch.postal_code = trimOrNull(input.postalCode)
  if (input.country !== undefined) patch.country = trimOrNull(input.country)
  if (input.status !== undefined) patch.status = input.status
  if (input.score !== undefined) patch.score = input.score
  if (input.notes !== undefined) patch.notes = trimOrNull(input.notes)
  if (input.metadata !== undefined) patch.metadata = input.metadata
  if (input.researchPriority !== undefined) patch.research_priority = input.researchPriority
  if (input.callPriorityOverride !== undefined) patch.call_priority_override = input.callPriorityOverride
  if (input.decisionMakerStatus !== undefined) patch.decision_maker_status = input.decisionMakerStatus
  if (input.primaryDecisionMakerId !== undefined) patch.primary_decision_maker_id = input.primaryDecisionMakerId
  if (input.estimatedAnnualRevenue !== undefined) patch.estimated_annual_revenue = trimOrNull(input.estimatedAnnualRevenue)
  if (input.estimatedEmployeeCount !== undefined) patch.estimated_employee_count = trimOrNull(input.estimatedEmployeeCount)
  if (input.fleetSizeEstimate !== undefined) patch.fleet_size_estimate = trimOrNull(input.fleetSizeEstimate)
  if (input.crmDetected !== undefined) patch.crm_detected = trimOrNull(input.crmDetected)
  if (input.fieldServiceStackDetected !== undefined) {
    patch.field_service_stack_detected = trimOrNull(input.fieldServiceStackDetected)
  }
  if (input.sourceChannel !== undefined) patch.source_channel = trimOrNull(input.sourceChannel)
  if (input.sourceCampaign !== undefined) patch.source_campaign = trimOrNull(input.sourceCampaign)
  if (input.sourceImportBatchId !== undefined) patch.source_import_batch_id = input.sourceImportBatchId
  if (input.sourceVendor !== undefined) patch.source_vendor = trimOrNull(input.sourceVendor)
  if (input.assignedTo !== undefined) patch.assigned_to = trimOrNull(input.assignedTo)

  if (Object.keys(patch).length === 0) {
    throw new Error("empty_patch")
  }

  const { data, error } = await growthLeadsTable(admin)
    .update(patch)
    .eq("id", leadId)
    .select(LEAD_SELECT)
    .maybeSingle()

  if (error) {
    logGrowthEngine("lead_update_failed", {
      table: "growth.leads",
      action: "update",
      leadId,
      code: error.code ?? null,
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })
    throw new Error(error.message)
  }

  if (!data) return null

  const lead = mapGrowthLeadRow(data as GrowthLeadDbRow)
  logGrowthEngine("lead_updated", {
    leadId: lead.id,
    status: lead.status,
    patchedFields: Object.keys(patch),
  })
  return lead
}

/** Import merge — applies only safe empty-field patches; never touches protected workflow fields. */
export async function updateGrowthLeadFromImportMerge(
  admin: SupabaseClient,
  leadId: string,
  patch: Record<string, unknown>,
): Promise<GrowthLead | null> {
  if (Object.keys(patch).length === 0) {
    return fetchGrowthLeadById(admin, leadId)
  }

  const { data, error } = await growthLeadsTable(admin)
    .update(patch)
    .eq("id", leadId)
    .select(LEAD_SELECT)
    .maybeSingle()

  if (error) {
    logGrowthEngine("lead_import_merge_failed", {
      table: "growth.leads",
      action: "update",
      leadId,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  if (!data) return null

  const lead = mapGrowthLeadRow(data as GrowthLeadDbRow)
  logGrowthEngine("lead_import_merged", {
    leadId: lead.id,
    patchedFields: Object.keys(patch),
  })
  return lead
}

export async function markGrowthLeadResearchCompleted(
  admin: SupabaseClient,
  input: {
    leadId: string
    latestResearchRunId: string
    equipifyFitScore: number
    status: GrowthLeadStatus
  },
): Promise<GrowthLead | null> {
  const now = new Date().toISOString()
  const { data, error } = await growthLeadsTable(admin)
    .update({
      status: input.status,
      score: input.equipifyFitScore,
      latest_research_run_id: input.latestResearchRunId,
      last_researched_at: now,
    })
    .eq("id", input.leadId)
    .select(LEAD_SELECT)
    .maybeSingle()

  if (error) {
    logGrowthEngine("lead_research_tracking_failed", {
      table: "growth.leads",
      action: "update",
      leadId: input.leadId,
      runId: input.latestResearchRunId,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  if (!data) return null

  const lead = mapGrowthLeadRow(data as GrowthLeadDbRow)
  logGrowthEngine("lead_research_tracking_updated", {
    leadId: lead.id,
    latestResearchRunId: input.latestResearchRunId,
    lastResearchedAt: now,
  })
  return lead
}

export async function deleteGrowthLead(admin: SupabaseClient, leadId: string): Promise<boolean> {
  const { data, error } = await growthLeadsTable(admin).delete().eq("id", leadId).select("id").maybeSingle()

  if (error) {
    logGrowthEngine("lead_delete_failed", {
      table: "growth.leads",
      action: "delete",
      leadId,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  if (!data) return false

  logGrowthEngine("lead_deleted", { leadId })
  return true
}
