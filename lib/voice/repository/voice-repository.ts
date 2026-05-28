import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import type {
  VoiceCallDirection,
  VoiceCallRecord,
  VoiceCallStatus,
  VoiceInfrastructureReadinessSnapshot,
  VoiceProviderConfigurationRecord,
  VoiceProviderId,
} from "@/lib/voice/types"
import { VOICE_FOUNDATION_QA_MARKER } from "@/lib/voice/types"

function mapProviderConfig(row: Record<string, unknown>): VoiceProviderConfigurationRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    provider: row.provider as VoiceProviderId,
    providerAccountReference: String(row.provider_account_reference ?? ""),
    status: row.status as VoiceProviderConfigurationRecord["status"],
    voiceEnabled: Boolean(row.voice_enabled),
    smsEnabled: Boolean(row.sms_enabled),
    webhookValidated: Boolean(row.webhook_validated),
    lastValidationAt: row.last_validation_at ? String(row.last_validation_at) : null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapVoiceCall(row: Record<string, unknown>): VoiceCallRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    provider: row.provider as VoiceProviderId,
    providerCallId: String(row.provider_call_id),
    direction: row.direction as VoiceCallDirection,
    status: row.status as VoiceCallStatus,
    fromNumber: String(row.from_number ?? ""),
    toNumber: String(row.to_number ?? ""),
    startedAt: row.started_at ? String(row.started_at) : null,
    answeredAt: row.answered_at ? String(row.answered_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    durationSeconds: Number(row.duration_seconds ?? 0),
    recordingAvailable: Boolean(row.recording_available),
    transcriptionAvailable: Boolean(row.transcription_available),
    transferred: Boolean(row.transferred),
    transferredTo: row.transferred_to ? String(row.transferred_to) : null,
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    relatedCustomerId: row.related_customer_id ? String(row.related_customer_id) : null,
    relatedProspectId: row.related_prospect_id ? String(row.related_prospect_id) : null,
    relatedOpportunityId: row.related_opportunity_id ? String(row.related_opportunity_id) : null,
    operatorDisposition: (row.operator_disposition as VoiceCallRecord["operatorDisposition"]) ?? null,
    costCurrency: String(row.cost_currency ?? "USD"),
    costAmount: row.cost_amount == null ? null : Number(row.cost_amount),
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function resolveVoiceInfrastructureOrganizationId(): string | null {
  return getGrowthEngineAiOrgId()
}

export async function fetchVoiceProviderConfigurations(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceProviderConfigurationRecord[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_provider_configurations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("provider", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapProviderConfig(row as Record<string, unknown>))
}

export async function countVoiceNumbers(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_numbers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
  if (error) return 0
  return count ?? 0
}

export async function countVoiceOptOuts(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_opt_outs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
  if (error) return 0
  return count ?? 0
}

export async function fetchVoiceInfrastructureReadiness(
  admin: SupabaseClient,
  organizationId: string | null,
): Promise<VoiceInfrastructureReadinessSnapshot> {
  if (!organizationId) {
    return {
      qaMarker: VOICE_FOUNDATION_QA_MARKER,
      organizationId: null,
      configuredProviders: [],
      phoneNumberCount: 0,
      webhookValidationSummary: { validatedCount: 0, pendingCount: 0 },
      complianceReadiness: {
        optOutCount: 0,
        message: "Set GROWTH_ENGINE_AI_ORG_ID to scope voice infrastructure readiness.",
      },
      infrastructureMessage:
        "Voice infrastructure foundation is installed. Organization scope is not configured yet.",
    }
  }

  const configuredProviders = await fetchVoiceProviderConfigurations(admin, organizationId)
  const phoneNumberCount = await countVoiceNumbers(admin, organizationId)
  const optOutCount = await countVoiceOptOuts(admin, organizationId)
  const validatedCount = configuredProviders.filter((p) => p.webhookValidated).length
  const pendingCount = configuredProviders.length - validatedCount

  return {
    qaMarker: VOICE_FOUNDATION_QA_MARKER,
    organizationId,
    configuredProviders,
    phoneNumberCount,
    webhookValidationSummary: { validatedCount, pendingCount },
    complianceReadiness: {
      optOutCount,
      message:
        optOutCount > 0
          ? `${optOutCount} opt-out record(s) on file. Compliance registry is active.`
          : "No opt-outs recorded yet. Registry is ready for operator-managed entries.",
    },
    infrastructureMessage:
      configuredProviders.length === 0
        ? "No voice providers configured yet. This is infrastructure scaffolding — not AI calling."
        : "Provider readiness tracked. Webhook validation and number inventory are operator-controlled.",
  }
}

export async function resolveVoiceOrganizationFromWebhook(
  admin: SupabaseClient,
  input: {
    provider: VoiceProviderId
    accountSid?: string | null
    fromNumber?: string | null
    toNumber?: string | null
  },
): Promise<string | null> {
  if (input.accountSid) {
    const { data } = await admin
      .schema("voice")
      .from("voice_provider_configurations")
      .select("organization_id")
      .eq("provider", input.provider)
      .eq("provider_account_reference", input.accountSid)
      .maybeSingle()
    if (data?.organization_id) return String(data.organization_id)
  }

  const candidates = [input.fromNumber, input.toNumber]
    .map((n) => normalizePhoneNumber(n))
    .filter(Boolean)
  for (const phone of candidates) {
    const { data } = await admin
      .schema("voice")
      .from("voice_numbers")
      .select("organization_id")
      .eq("phone_number", phone)
      .maybeSingle()
    if (data?.organization_id) return String(data.organization_id)
  }

  return resolveVoiceInfrastructureOrganizationId()
}

export async function findVoiceCallByProviderId(
  admin: SupabaseClient,
  organizationId: string,
  provider: VoiceProviderId,
  providerCallId: string,
): Promise<VoiceCallRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .eq("provider_call_id", providerCallId)
    .maybeSingle()
  if (error || !data) return null
  return mapVoiceCall(data as Record<string, unknown>)
}

export async function upsertVoiceCallFromWebhook(
  admin: SupabaseClient,
  input: {
    organizationId: string
    provider: VoiceProviderId
    providerCallId: string
    direction: VoiceCallDirection
    status: VoiceCallStatus
    fromNumber: string
    toNumber: string
    startedAt?: string | null
    answeredAt?: string | null
    endedAt?: string | null
    durationSeconds?: number
    recordingAvailable?: boolean
    costCurrency?: string
    costAmount?: number | null
    metadataJson?: Record<string, unknown>
  },
): Promise<VoiceCallRecord | null> {
  const existing = await findVoiceCallByProviderId(
    admin,
    input.organizationId,
    input.provider,
    input.providerCallId,
  )

  const payload = {
    organization_id: input.organizationId,
    provider: input.provider,
    provider_call_id: input.providerCallId,
    direction: input.direction,
    status: input.status,
    from_number: input.fromNumber,
    to_number: input.toNumber,
    started_at: input.startedAt ?? existing?.startedAt ?? new Date().toISOString(),
    answered_at: input.answeredAt ?? existing?.answeredAt ?? null,
    ended_at: input.endedAt ?? existing?.endedAt ?? null,
    duration_seconds: input.durationSeconds ?? existing?.durationSeconds ?? 0,
    recording_available: input.recordingAvailable ?? existing?.recordingAvailable ?? false,
    transcription_available: existing?.transcriptionAvailable ?? false,
    cost_currency: input.costCurrency ?? existing?.costCurrency ?? "USD",
    cost_amount: input.costAmount ?? existing?.costAmount ?? null,
    metadata_json: {
      ...(existing?.metadataJson ?? {}),
      ...(input.metadataJson ?? {}),
    },
  }

  const { data, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .upsert(payload, { onConflict: "organization_id,provider,provider_call_id" })
    .select("*")
    .single()
  if (error || !data) return null
  return mapVoiceCall(data as Record<string, unknown>)
}

export async function appendVoiceCallEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    provider: VoiceProviderId
    eventType: string
    eventTimestamp: string
    payloadJson: Record<string, unknown>
    idempotencyKey: string
  },
): Promise<{ ok: true; eventId: string } | { ok: false; duplicate: boolean }> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_call_events")
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      provider: input.provider,
      event_type: input.eventType,
      event_timestamp: input.eventTimestamp,
      payload_json: input.payloadJson,
      idempotency_key: input.idempotencyKey,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") return { ok: false, duplicate: true }
    return { ok: false, duplicate: false }
  }
  return { ok: true, eventId: String(data.id) }
}

export async function ensureDefaultVoiceProviderConfigurations(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const defaults: Array<{ provider: VoiceProviderId; providerAccountReference: string }> = [
    { provider: "twilio", providerAccountReference: process.env.TWILIO_ACCOUNT_SID?.trim() ?? "" },
    { provider: "stub", providerAccountReference: "stub" },
  ]
  for (const row of defaults) {
    await admin.schema("voice").from("voice_provider_configurations").upsert(
      {
        organization_id: organizationId,
        provider: row.provider,
        provider_account_reference: row.providerAccountReference,
        status: row.provider === "stub" ? "ready" : row.providerAccountReference ? "pending" : "pending",
        voice_enabled: row.provider !== "stub",
        sms_enabled: false,
        webhook_validated: false,
        metadata_json: { phase: "1a", scaffold: true },
      },
      { onConflict: "organization_id,provider" },
    )
  }
}
