import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertGrowthOutboundCampaign, updateGrowthOutboundCampaignProviderStats } from "@/lib/growth/outbound/campaign-repository"
import {
  fetchLemlistCampaignStats,
  listLemlistCampaigns,
  type LemlistCampaignStats,
} from "@/lib/growth/outbound/providers/lemlist/lemlist-api-client"
import type { GrowthEmailProviderConnection } from "@/lib/growth/outbound/types"

export async function syncLemlistCampaignsForConnection(
  admin: SupabaseClient,
  input: {
    connection: GrowthEmailProviderConnection
    apiKey: string
  },
): Promise<Array<{ providerCampaignId: string; name: string; status: string | null; stats: LemlistCampaignStats | null }>> {
  const campaigns = await listLemlistCampaigns({
    apiKey: input.apiKey,
    apiBaseUrl: input.connection.apiBaseUrl,
  })

  const synced: Array<{ providerCampaignId: string; name: string; status: string | null; stats: LemlistCampaignStats | null }> = []

  for (const campaign of campaigns) {
    let stats: LemlistCampaignStats | null = null
    try {
      stats = await fetchLemlistCampaignStats({
        apiKey: input.apiKey,
        apiBaseUrl: input.connection.apiBaseUrl,
        campaignId: campaign.id,
      })
    } catch {
      stats = null
    }

    const local = await upsertGrowthOutboundCampaign(admin, {
      connectionId: input.connection.id,
      provider: input.connection.provider,
      providerCampaignId: campaign.id,
      name: campaign.name,
    })

    if (stats) {
      await updateGrowthOutboundCampaignProviderStats(admin, local.id, {
        sentCount: stats.sent,
        replyCount: stats.replied,
        positiveReplyCount: stats.interested,
        unsubscribeCount: stats.unsubscribed,
        bounceCount: stats.bounced,
        metadata: {
          providerStats: stats,
          providerCampaignStatus: campaign.status,
          syncedAt: new Date().toISOString(),
        },
      })
    }

    synced.push({
      providerCampaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      stats,
    })
  }

  return synced
}
