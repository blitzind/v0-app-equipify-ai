import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateCallHourRule } from "@/lib/voice/compliance-orchestration/call-hour-evaluator"
import type {
  CommunicationComplianceEvaluationContext,
  VoiceCallHourRulePublicView,
  VoiceComplianceAuditAction,
  VoiceComplianceAuditEventPublicView,
  VoiceComplianceDecision,
  VoiceConsentChannel,
  VoiceConsentRecordPublicView,
  VoiceConsentStatus,
  VoiceDncEntryPublicView,
  VoiceSuppressionEntryPublicView,
} from "@/lib/voice/compliance-orchestration/types"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

function mapConsent(row: Record<string, unknown>): VoiceConsentRecordPublicView {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    relatedCustomerId: (row.related_customer_id as string | null) ?? null,
    relatedProspectId: (row.related_prospect_id as string | null) ?? null,
    relationshipMemoryProfileId: (row.relationship_memory_profile_id as string | null) ?? null,
    phoneNumber: row.phone_number as string,
    consentChannel: row.consent_channel as VoiceConsentChannel,
    consentStatus: row.consent_status as VoiceConsentStatus,
    consentSource: row.consent_source as string,
    evidenceText: row.evidence_text as string,
    capturedAt: row.captured_at as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    metadata: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapSuppression(row: Record<string, unknown>): VoiceSuppressionEntryPublicView {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    phoneNumber: row.phone_number as string,
    suppressionType: row.suppression_type as VoiceSuppressionEntryPublicView["suppressionType"],
    suppressionReason: row.suppression_reason as string,
    source: row.source as string,
    severity: row.severity as string,
    startsAt: row.starts_at as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    metadata: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }
}

function mapDnc(row: Record<string, unknown>): VoiceDncEntryPublicView {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    phoneNumber: row.phone_number as string,
    source: row.source as string,
    scope: row.scope as VoiceDncEntryPublicView["scope"],
    reason: row.reason as string,
    startsAt: row.starts_at as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    metadata: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }
}

function mapCallHourRule(row: Record<string, unknown>): VoiceCallHourRulePublicView {
  const days = row.allowed_days_json
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    timezone: row.timezone as string,
    allowedDays: Array.isArray(days) ? days.map(String) : [],
    allowedStartTime: String(row.allowed_start_time).slice(0, 5),
    allowedEndTime: String(row.allowed_end_time).slice(0, 5),
    channel: (row.channel as VoiceConsentChannel | null) ?? null,
    campaignType: (row.campaign_type as string | null) ?? null,
    isDefault: Boolean(row.is_default),
    metadata: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapAudit(row: Record<string, unknown>): VoiceComplianceAuditEventPublicView {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    phoneNumber: (row.phone_number as string | null) ?? null,
    channel: (row.channel as VoiceConsentChannel | null) ?? null,
    action: row.action as VoiceComplianceAuditAction,
    decision: (row.decision as VoiceComplianceDecision | null) ?? null,
    evidence: (row.evidence_json as Record<string, unknown>) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

export async function isPhoneOptedOutRegistry(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber)
  const { data, error } = await admin
    .schema("voice")
    .from("voice_opt_outs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("phone_number", normalized || phoneNumber)
    .limit(1)
    .maybeSingle()
  if (error) return false
  return Boolean(data)
}

export async function upsertVoiceOptOut(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    reason: string
    source: string
  },
): Promise<void> {
  const normalized = normalizePhoneNumber(input.phoneNumber) || input.phoneNumber
  await admin.schema("voice").from("voice_opt_outs").upsert(
    {
      organization_id: input.organizationId,
      phone_number: normalized,
      reason: input.reason,
      source: input.source,
    },
    { onConflict: "organization_id,phone_number" },
  )
}

export async function getConsentForPhone(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
  channel: VoiceConsentChannel,
): Promise<VoiceConsentRecordPublicView | null> {
  const normalized = normalizePhoneNumber(phoneNumber) || phoneNumber
  const { data, error } = await admin
    .schema("voice")
    .from("voice_consent_records")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("phone_number", normalized)
    .eq("consent_channel", channel)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapConsent(data) : null
}

export async function upsertConsentRecord(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    channel: VoiceConsentChannel
    consentStatus: VoiceConsentStatus
    consentSource: string
    evidenceText: string
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relationshipMemoryProfileId?: string | null
    createdBy?: string | null
  },
): Promise<VoiceConsentRecordPublicView> {
  const normalized = normalizePhoneNumber(input.phoneNumber) || input.phoneNumber
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_consent_records")
    .insert({
      organization_id: input.organizationId,
      phone_number: normalized,
      consent_channel: input.channel,
      consent_status: input.consentStatus,
      consent_source: input.consentSource,
      evidence_text: input.evidenceText,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      captured_at: now,
      revoked_at: input.consentStatus === "revoked" ? now : null,
      metadata_json: {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapConsent(data)
}

export async function listActiveSuppressions(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
): Promise<VoiceSuppressionEntryPublicView[]> {
  const normalized = normalizePhoneNumber(phoneNumber) || phoneNumber
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_suppression_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("phone_number", normalized)
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapSuppression(row))
}

export async function addSuppressionEntry(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    suppressionType: VoiceSuppressionEntryPublicView["suppressionType"]
    suppressionReason: string
    source: string
    severity?: string
    expiresAt?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<VoiceSuppressionEntryPublicView> {
  const normalized = normalizePhoneNumber(input.phoneNumber) || input.phoneNumber
  const { data, error } = await admin
    .schema("voice")
    .from("voice_suppression_entries")
    .insert({
      organization_id: input.organizationId,
      phone_number: normalized,
      suppression_type: input.suppressionType,
      suppression_reason: input.suppressionReason,
      source: input.source,
      severity: input.severity ?? "high",
      expires_at: input.expiresAt ?? null,
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapSuppression(data)
}

export async function countSuppressionEntries(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_suppression_entries")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (error) {
    if (isMissingTableError(error)) return 0
    return 0
  }
  return count ?? 0
}

export async function isPhoneOnDnc(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
): Promise<boolean | null> {
  const normalized = normalizePhoneNumber(phoneNumber) || phoneNumber
  const { data, error } = await admin
    .schema("voice")
    .from("voice_dnc_entries")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("phone_number", normalized)
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    return null
  }
  return Boolean(data)
}

export async function addDncEntry(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    source: string
    scope: VoiceDncEntryPublicView["scope"]
    reason: string
  },
): Promise<VoiceDncEntryPublicView> {
  const normalized = normalizePhoneNumber(input.phoneNumber) || input.phoneNumber
  const { data, error } = await admin
    .schema("voice")
    .from("voice_dnc_entries")
    .insert({
      organization_id: input.organizationId,
      phone_number: normalized,
      source: input.source,
      scope: input.scope,
      reason: input.reason,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapDnc(data)
}

export async function countDncEntries(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_dnc_entries")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (error) {
    if (isMissingTableError(error)) return 0
    return 0
  }
  return count ?? 0
}

export async function getDefaultCallHourRule(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceCallHourRulePublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_call_hour_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapCallHourRule(data) : null
}

export async function ensureDefaultCallHourRule(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceCallHourRulePublicView | null> {
  const existing = await getDefaultCallHourRule(admin, organizationId)
  if (existing) return existing

  const { data, error } = await admin
    .schema("voice")
    .from("voice_call_hour_rules")
    .insert({
      organization_id: organizationId,
      name: "Default business hours",
      timezone: "America/New_York",
      allowed_days_json: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      allowed_start_time: "09:00",
      allowed_end_time: "17:00",
      is_default: true,
    })
    .select("*")
    .single()

  if (error) {
    if (isMissingTableError(error)) return null
    return null
  }
  return data ? mapCallHourRule(data) : null
}

export async function appendComplianceAuditEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber?: string | null
    channel?: VoiceConsentChannel | null
    action: VoiceComplianceAuditAction
    decision?: VoiceComplianceDecision | null
    evidence?: Record<string, unknown>
    createdBy?: string | null
  },
): Promise<VoiceComplianceAuditEventPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_compliance_audit_events")
    .insert({
      organization_id: input.organizationId,
      phone_number: input.phoneNumber ?? null,
      channel: input.channel ?? null,
      action: input.action,
      decision: input.decision ?? null,
      evidence_json: input.evidence ?? {},
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapAudit(data)
}

export async function countComplianceAuditEvents(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_compliance_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (error) {
    if (isMissingTableError(error)) return 0
    return 0
  }
  return count ?? 0
}

export async function listRecentAuditEvents(
  admin: SupabaseClient,
  organizationId: string,
  limit = 20,
): Promise<VoiceComplianceAuditEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_compliance_audit_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapAudit(row))
}

export async function buildComplianceEvaluationContext(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    channel: VoiceConsentChannel
    duplicateInCampaign?: boolean
    recentContactWithinCap?: boolean
    relationshipSuppressed?: boolean
    providerReputationFlag?: boolean
  },
): Promise<CommunicationComplianceEvaluationContext> {
  const [isOptedOut, suppressions, consent, dncListed, callHourRule] = await Promise.all([
    isPhoneOptedOutRegistry(admin, input.organizationId, input.phoneNumber),
    listActiveSuppressions(admin, input.organizationId, input.phoneNumber),
    getConsentForPhone(admin, input.organizationId, input.phoneNumber, input.channel),
    isPhoneOnDnc(admin, input.organizationId, input.phoneNumber),
    getDefaultCallHourRule(admin, input.organizationId),
  ])

  const hourEval = evaluateCallHourRule(callHourRule)

  return {
    isOptedOut,
    activeSuppressions: suppressions,
    consentStatus: consent?.consentStatus ?? "unknown",
    dncListed,
    duplicateInCampaign: input.duplicateInCampaign ?? false,
    recentContactWithinCap: input.recentContactWithinCap ?? false,
    relationshipSuppressed: input.relationshipSuppressed ?? false,
    callHourRule,
    timezoneKnown: hourEval.timezoneKnown,
    withinCallHours: hourEval.withinCallHours,
    providerReputationFlag: input.providerReputationFlag ?? false,
  }
}

export async function countManualReviewRecipients(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("manual_review_required", true)

  if (error) {
    if (isMissingTableError(error)) return 0
    return 0
  }
  return count ?? 0
}

export async function propagateOptOutRegistry(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    reason: string
    source: string
  },
): Promise<void> {
  await upsertVoiceOptOut(admin, input)
  await addSuppressionEntry(admin, {
    organizationId: input.organizationId,
    phoneNumber: input.phoneNumber,
    suppressionType: "opt_out",
    suppressionReason: input.reason,
    source: input.source,
    severity: "high",
  })
}

export async function listManualReviewRecipients(
  admin: SupabaseClient,
  organizationId: string,
  limit = 30,
): Promise<
  Array<{
    id: string
    phoneNumber: string
    campaignId: string
    complianceDecision: VoiceComplianceDecision | null
    complianceReasons: string[]
    manualReviewRequired: boolean
    createdAt: string
    metadata: Record<string, unknown>
  }>
> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("manual_review_required", true)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    phoneNumber: row.phone_number as string,
    campaignId: row.campaign_id as string,
    complianceDecision: (row.compliance_decision as VoiceComplianceDecision | null) ?? null,
    complianceReasons: Array.isArray(row.compliance_reasons_json)
      ? (row.compliance_reasons_json as string[])
      : [],
    manualReviewRequired: Boolean(row.manual_review_required),
    createdAt: row.created_at as string,
    metadata: (row.metadata_json as Record<string, unknown>) ?? {},
  }))
}
