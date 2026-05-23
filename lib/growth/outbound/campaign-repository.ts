import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOutboundCampaign } from "@/lib/growth/outbound/types"

type CampaignDbRow = {
  id: string
  connection_id: string
  provider: string
  provider_campaign_id: string | null
  name: string
  campaign_type: string
  status: string
  source_channel: string | null
  source_campaign: string | null
  sent_count: number
  reply_count: number
  positive_reply_count: number
  call_ready_count: number
  unsubscribe_count: number
  bounce_count: number
  engagement_score: number
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, connection_id, provider, provider_campaign_id, name, campaign_type, status, source_channel, source_campaign, sent_count, reply_count, positive_reply_count, call_ready_count, unsubscribe_count, bounce_count, engagement_score, metadata, created_at, updated_at"

function campaignsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outbound_campaigns")
}

function mapRow(row: CampaignDbRow): GrowthOutboundCampaign {
  return {
    id: row.id,
    connectionId: row.connection_id,
    provider: row.provider,
    providerCampaignId: row.provider_campaign_id,
    name: row.name,
    campaignType: row.campaign_type as GrowthOutboundCampaign["campaignType"],
    status: row.status as GrowthOutboundCampaign["status"],
    sourceChannel: row.source_channel,
    sourceCampaign: row.source_campaign,
    sentCount: row.sent_count,
    replyCount: row.reply_count,
    positiveReplyCount: row.positive_reply_count,
    callReadyCount: row.call_ready_count,
    unsubscribeCount: row.unsubscribe_count,
    bounceCount: row.bounce_count,
    engagementScore: Number(row.engagement_score),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertGrowthOutboundCampaign(
  admin: SupabaseClient,
  input: {
    connectionId: string
    provider: string
    providerCampaignId?: string | null
    name: string
    sourceChannel?: string | null
    sourceCampaign?: string | null
  },
): Promise<GrowthOutboundCampaign> {
  const providerCampaignId = input.providerCampaignId ?? null
  if (providerCampaignId) {
    const { data: existing } = await campaignsTable(admin)
      .select(SELECT)
      .eq("connection_id", input.connectionId)
      .eq("provider_campaign_id", providerCampaignId)
      .maybeSingle()
    if (existing) return mapRow(existing as CampaignDbRow)
  }

  const { data, error } = await campaignsTable(admin)
    .insert({
      connection_id: input.connectionId,
      provider: input.provider,
      provider_campaign_id: providerCampaignId,
      name: input.name,
      status: "active",
      source_channel: input.sourceChannel ?? null,
      source_campaign: input.sourceCampaign ?? null,
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as CampaignDbRow)
}

export async function recomputeGrowthOutboundCampaignMetrics(
  admin: SupabaseClient,
  campaignId: string,
): Promise<GrowthOutboundCampaign | null> {
  const { data: messages, error: messageError } = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("id, lead_id")
    .eq("campaign_id", campaignId)

  if (messageError) throw new Error(messageError.message)
  const messageIds = (messages ?? []).map((m) => m.id)
  if (messageIds.length === 0) return fetchGrowthOutboundCampaignById(admin, campaignId)

  const { data: eventRows, error: eventError } = await admin
    .schema("growth")
    .from("message_events")
    .select("event_type, lead_id")
    .in("message_id", messageIds)

  if (eventError) throw new Error(eventError.message)
  return applyCampaignMetrics(admin, campaignId, eventRows ?? [], messageIds)
}

async function applyCampaignMetrics(
  admin: SupabaseClient,
  campaignId: string,
  events: Array<{ event_type: string; lead_id?: string | null }>,
  messageIds: string[] = [],
): Promise<GrowthOutboundCampaign | null> {
  const sentCount = events.filter((e) => e.event_type === "sent").length
  const replyCount = events.filter((e) => e.event_type === "replied").length
  const bounceCount = events.filter((e) => e.event_type === "bounced").length
  const unsubscribeCount = events.filter((e) => e.event_type === "unsubscribed").length

  const { data: replies } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("classification, lead_id")
    .in("message_id", messageIds)

  const positiveReplyCount = (replies ?? []).filter((r) => r.classification === "interested").length

  const { data: callReadyLeads } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .eq("status", "call_ready")
    .in("id", [...new Set((replies ?? []).map((r) => r.lead_id).filter(Boolean))] as string[])

  const callReadyCount = callReadyLeads?.length ?? 0
  const openCount = events.filter((e) => e.event_type === "opened").length
  const clickCount = events.filter((e) => e.event_type === "clicked").length
  const engagementScore =
    sentCount === 0
      ? 0
      : Math.round(((replyCount * 3 + clickCount * 2 + openCount) / sentCount) * 100) / 100

  const { data, error } = await campaignsTable(admin)
    .update({
      sent_count: sentCount,
      reply_count: replyCount,
      positive_reply_count: positiveReplyCount,
      call_ready_count: callReadyCount,
      unsubscribe_count: unsubscribeCount,
      bounce_count: bounceCount,
      engagement_score: engagementScore,
    })
    .eq("id", campaignId)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as CampaignDbRow) : null
}

export async function fetchGrowthOutboundCampaignById(
  admin: SupabaseClient,
  campaignId: string,
): Promise<GrowthOutboundCampaign | null> {
  const { data, error } = await campaignsTable(admin).select(SELECT).eq("id", campaignId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as CampaignDbRow) : null
}
