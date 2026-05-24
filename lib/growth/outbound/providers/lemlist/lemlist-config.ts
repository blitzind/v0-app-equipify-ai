/** Client-safe Lemlist connection config parsing (Growth Engine slice 6.15A). */

export type LemlistConnectionConfig = {
  defaultCampaignId: string | null
  deduplicateAcrossCampaigns: boolean
  campaignAutoLaunchWarning: boolean
}

export function parseLemlistConnectionConfig(config: Record<string, unknown> | null | undefined): LemlistConnectionConfig {
  const raw = config ?? {}
  const defaultCampaignId =
    typeof raw.defaultCampaignId === "string" && raw.defaultCampaignId.trim()
      ? raw.defaultCampaignId.trim()
      : null
  return {
    defaultCampaignId,
    deduplicateAcrossCampaigns: raw.deduplicateAcrossCampaigns === true,
    campaignAutoLaunchWarning: raw.campaignAutoLaunchWarning === true,
  }
}

export function buildLemlistWebhookCallbackPath(connectionId: string): string {
  return `/api/growth/webhooks/outbound/lemlist/${connectionId}`
}
