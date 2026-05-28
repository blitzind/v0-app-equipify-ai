import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceDropApprovalStatus,
  VoiceDropCampaignPublicView,
  VoiceDropCampaignStatus,
  VoiceDropCampaignType,
  VoiceDropDeliveryAttemptPublicView,
  VoiceDropDeliveryStatus,
  VoiceDropProviderId,
  VoiceDropRecipientPublicView,
  VoiceDropRecipientStatus,
} from "@/lib/voice/voice-drops/types"

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

type CampaignRow = {
  id: string
  organization_id: string
  name: string
  status: VoiceDropCampaignStatus
  campaign_type: VoiceDropCampaignType
  message_template: string
  voice_provider: VoiceDropProviderId
  voice_id: string | null
  approval_status: VoiceDropApprovalStatus
  scheduled_at: string | null
  created_by: string | null
  metadata_json: Record<string, unknown> | unknown
  created_at: string
  updated_at: string
}

type RecipientRow = {
  id: string
  organization_id: string
  campaign_id: string
  related_customer_id: string | null
  related_prospect_id: string | null
  phone_number: string
  recipient_name: string | null
  status: VoiceDropRecipientStatus
  suppression_reason: string | null
  compliance_decision: string | null
  compliance_reasons_json: unknown
  manual_review_required: boolean
  delivery_attempt_count: number
  last_attempt_at: string | null
  rendered_message_preview: string | null
  metadata_json: Record<string, unknown> | unknown
  created_at: string
  updated_at: string
}

type DeliveryRow = {
  id: string
  organization_id: string
  campaign_id: string
  recipient_id: string
  provider: VoiceDropProviderId
  provider_delivery_id: string | null
  status: VoiceDropDeliveryStatus
  failure_reason: string | null
  delivered_at: string | null
  duration_seconds: number | null
  cost_amount: number | null
  metadata_json: Record<string, unknown> | unknown
  created_at: string
}

function mapCampaign(row: CampaignRow, counts?: { recipient: number; suppressed: number; delivered: number }): VoiceDropCampaignPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    status: row.status,
    campaignType: row.campaign_type,
    messageTemplate: row.message_template,
    voiceProvider: row.voice_provider,
    voiceId: row.voice_id,
    approvalStatus: row.approval_status,
    scheduledAt: row.scheduled_at,
    createdBy: row.created_by,
    recipientCount: counts?.recipient ?? 0,
    suppressedCount: counts?.suppressed ?? 0,
    deliveredCount: counts?.delivered ?? 0,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRecipient(row: RecipientRow): VoiceDropRecipientPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campaignId: row.campaign_id,
    relatedCustomerId: row.related_customer_id,
    relatedProspectId: row.related_prospect_id,
    phoneNumber: row.phone_number,
    recipientName: row.recipient_name,
    status: row.status,
    suppressionReason: row.suppression_reason,
    complianceDecision: (row.compliance_decision as VoiceDropRecipientPublicView["complianceDecision"]) ?? null,
    complianceReasons: Array.isArray(row.compliance_reasons_json)
      ? (row.compliance_reasons_json as string[])
      : [],
    manualReviewRequired: Boolean(row.manual_review_required),
    deliveryAttemptCount: row.delivery_attempt_count,
    lastAttemptAt: row.last_attempt_at,
    renderedMessagePreview: row.rendered_message_preview,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDelivery(row: DeliveryRow): VoiceDropDeliveryAttemptPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campaignId: row.campaign_id,
    recipientId: row.recipient_id,
    provider: row.provider,
    providerDeliveryId: row.provider_delivery_id,
    status: row.status,
    failureReason: row.failure_reason,
    deliveredAt: row.delivered_at,
    durationSeconds: row.duration_seconds,
    costAmount: row.cost_amount != null ? Number(row.cost_amount) : null,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
  }
}

export async function createVoiceDropCampaign(
  admin: SupabaseClient,
  input: {
    organizationId: string
    name: string
    campaignType: VoiceDropCampaignType
    messageTemplate: string
    voiceProvider: VoiceDropProviderId
    voiceId?: string | null
    createdBy?: string | null
  },
): Promise<VoiceDropCampaignPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_campaigns")
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      campaign_type: input.campaignType,
      message_template: input.messageTemplate,
      voice_provider: input.voiceProvider,
      voice_id: input.voiceId ?? null,
      created_by: input.createdBy ?? null,
      status: "draft",
      approval_status: "draft",
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapCampaign(data as CampaignRow)
}

export async function listVoiceDropCampaigns(
  admin: SupabaseClient,
  organizationId: string,
  limit = 30,
): Promise<VoiceDropCampaignPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_campaigns")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }

  const campaigns = (data ?? []) as CampaignRow[]
  const results: VoiceDropCampaignPublicView[] = []

  for (const row of campaigns) {
    const counts = await countRecipientsByCampaign(admin, row.id)
    results.push(mapCampaign(row, counts))
  }
  return results
}

async function countRecipientsByCampaign(
  admin: SupabaseClient,
  campaignId: string,
): Promise<{ recipient: number; suppressed: number; delivered: number }> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .select("status")
    .eq("campaign_id", campaignId)

  if (error || !data) return { recipient: 0, suppressed: 0, delivered: 0 }
  return {
    recipient: data.length,
    suppressed: data.filter((r) => r.status === "suppressed").length,
    delivered: data.filter((r) => r.status === "delivered").length,
  }
}

export async function getVoiceDropCampaign(
  admin: SupabaseClient,
  organizationId: string,
  campaignId: string,
): Promise<VoiceDropCampaignPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_campaigns")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  const counts = await countRecipientsByCampaign(admin, campaignId)
  return mapCampaign(data as CampaignRow, counts)
}

export async function updateVoiceDropCampaign(
  admin: SupabaseClient,
  input: {
    organizationId: string
    campaignId: string
    patch: Partial<{
      name: string
      messageTemplate: string
      status: VoiceDropCampaignStatus
      approvalStatus: VoiceDropApprovalStatus
      scheduledAt: string | null
    }>
  },
): Promise<VoiceDropCampaignPublicView | null> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.patch.name != null) dbPatch.name = input.patch.name
  if (input.patch.messageTemplate != null) dbPatch.message_template = input.patch.messageTemplate
  if (input.patch.status != null) dbPatch.status = input.patch.status
  if (input.patch.approvalStatus != null) dbPatch.approval_status = input.patch.approvalStatus
  if (input.patch.scheduledAt !== undefined) dbPatch.scheduled_at = input.patch.scheduledAt

  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_campaigns")
    .update(dbPatch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.campaignId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  const counts = await countRecipientsByCampaign(admin, input.campaignId)
  return mapCampaign(data as CampaignRow, counts)
}

export async function addVoiceDropRecipient(
  admin: SupabaseClient,
  input: {
    organizationId: string
    campaignId: string
    phoneNumber: string
    recipientName?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    status?: VoiceDropRecipientStatus
    suppressionReason?: string | null
    complianceDecision?: VoiceDropRecipientPublicView["complianceDecision"]
    complianceReasons?: string[]
    manualReviewRequired?: boolean
    renderedMessagePreview?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<VoiceDropRecipientPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .insert({
      organization_id: input.organizationId,
      campaign_id: input.campaignId,
      phone_number: input.phoneNumber,
      recipient_name: input.recipientName ?? null,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      status: input.status ?? "pending",
      suppression_reason: input.suppressionReason ?? null,
      compliance_decision: input.complianceDecision ?? null,
      compliance_reasons_json: input.complianceReasons ?? [],
      manual_review_required: input.manualReviewRequired ?? false,
      rendered_message_preview: input.renderedMessagePreview ?? null,
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRecipient(data as RecipientRow)
}

export async function listVoiceDropRecipients(
  admin: SupabaseClient,
  organizationId: string,
  campaignId: string,
): Promise<VoiceDropRecipientPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapRecipient(row as RecipientRow))
}

export async function updateVoiceDropRecipient(
  admin: SupabaseClient,
  input: {
    organizationId: string
    recipientId: string
    patch: Partial<{
      status: VoiceDropRecipientStatus
      suppressionReason: string | null
      complianceDecision: VoiceDropRecipientPublicView["complianceDecision"]
      complianceReasons: string[]
      manualReviewRequired: boolean
      renderedMessagePreview: string | null
      deliveryAttemptCount: number
      lastAttemptAt: string | null
    }>
  },
): Promise<VoiceDropRecipientPublicView | null> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.patch.status != null) dbPatch.status = input.patch.status
  if (input.patch.suppressionReason !== undefined) dbPatch.suppression_reason = input.patch.suppressionReason
  if (input.patch.complianceDecision !== undefined) dbPatch.compliance_decision = input.patch.complianceDecision
  if (input.patch.complianceReasons !== undefined) dbPatch.compliance_reasons_json = input.patch.complianceReasons
  if (input.patch.manualReviewRequired !== undefined) dbPatch.manual_review_required = input.patch.manualReviewRequired
  if (input.patch.renderedMessagePreview !== undefined) dbPatch.rendered_message_preview = input.patch.renderedMessagePreview
  if (input.patch.deliveryAttemptCount != null) dbPatch.delivery_attempt_count = input.patch.deliveryAttemptCount
  if (input.patch.lastAttemptAt !== undefined) dbPatch.last_attempt_at = input.patch.lastAttemptAt

  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .update(dbPatch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.recipientId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapRecipient(data as RecipientRow) : null
}

export async function appendVoiceDropDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    organizationId: string
    campaignId: string
    recipientId: string
    provider: VoiceDropProviderId
    providerDeliveryId?: string | null
    status: VoiceDropDeliveryStatus
    failureReason?: string | null
    deliveredAt?: string | null
    durationSeconds?: number | null
    costAmount?: number | null
    metadata?: Record<string, unknown>
  },
): Promise<VoiceDropDeliveryAttemptPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_delivery_attempts")
    .insert({
      organization_id: input.organizationId,
      campaign_id: input.campaignId,
      recipient_id: input.recipientId,
      provider: input.provider,
      provider_delivery_id: input.providerDeliveryId ?? null,
      status: input.status,
      failure_reason: input.failureReason ?? null,
      delivered_at: input.deliveredAt ?? null,
      duration_seconds: input.durationSeconds ?? null,
      cost_amount: input.costAmount ?? null,
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapDelivery(data as DeliveryRow)
}

export async function recipientExistsInCampaign(
  admin: SupabaseClient,
  campaignId: string,
  phoneNumber: string,
): Promise<boolean> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("phone_number", phoneNumber)
    .limit(1)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export async function recentDeliveryForPhone(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
  sinceIso: string,
): Promise<boolean> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .select("id, last_attempt_at, phone_number, status")
    .eq("organization_id", organizationId)
    .eq("phone_number", phoneNumber)
    .gte("last_attempt_at", sinceIso)
    .limit(1)

  if (error) return false
  return (data ?? []).some((r) => r.status === "delivered" || r.status === "queued")
}
