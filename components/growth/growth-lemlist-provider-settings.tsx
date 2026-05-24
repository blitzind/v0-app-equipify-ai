"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Copy, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  buildLemlistWebhookCallbackPath,
  parseLemlistConnectionConfig,
} from "@/lib/growth/outbound/providers/lemlist/lemlist-config"
import {
  LEMLIST_AUTO_LAUNCH_WARNING,
  LEMLIST_WEBHOOK_VERIFICATION_NOTE,
} from "@/lib/growth/outbound/providers/lemlist/lemlist-labels"
import type { GrowthProviderConnectionSummary } from "@/lib/growth/outbound/provider-types"

type LemlistCampaignRow = {
  id: string
  name: string
  status: string | null
  selected?: boolean
}

type LemlistCampaignStats = {
  sent: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  interested: number
  unsubscribed: number
  meetingBooked: number
}

type SyncedCampaign = {
  providerCampaignId: string
  name: string
  status: string | null
  stats: LemlistCampaignStats | null
}

type Props = {
  connection: GrowthProviderConnectionSummary
  onUpdated: () => Promise<void>
}

function formatStat(value: number | undefined): string {
  return value != null ? String(value) : "—"
}

export function GrowthLemlistProviderSettings({ connection, onUpdated }: Props) {
  const config = useMemo(() => parseLemlistConnectionConfig(connection.config), [connection.config])
  const [campaigns, setCampaigns] = useState<LemlistCampaignRow[]>([])
  const [syncedCampaigns, setSyncedCampaigns] = useState<SyncedCampaign[]>([])
  const [defaultCampaignId, setDefaultCampaignId] = useState(config.defaultCampaignId ?? "")
  const [deduplicate, setDeduplicate] = useState(config.deduplicateAcrossCampaigns)
  const [webhookSecret, setWebhookSecret] = useState("")
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const webhookPath = buildLemlistWebhookCallbackPath(connection.id)
  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return webhookPath
    const base = `${window.location.origin}${webhookPath}`
    return connection.webhookSecretConfigured ? `${base}?secret=[configured]` : `${base}?secret=YOUR_SECRET`
  }, [connection.id, connection.webhookSecretConfigured, webhookPath])

  const selectedCampaign = campaigns.find((row) => row.id === defaultCampaignId) ?? null
  const selectedSyncedStats =
    syncedCampaigns.find((row) => row.providerCampaignId === defaultCampaignId)?.stats ?? null

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/providers/connections/${connection.id}/campaigns`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        campaigns?: LemlistCampaignRow[]
      }
      if (!res.ok || !data.ok || !data.campaigns) {
        throw new Error(data.message ?? "Could not load Lemlist campaigns.")
      }
      setCampaigns(data.campaigns)
      if (!defaultCampaignId && data.campaigns.find((row) => row.selected)) {
        const selected = data.campaigns.find((row) => row.selected)
        if (selected) setDefaultCampaignId(selected.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Campaign load failed.")
    } finally {
      setLoadingCampaigns(false)
    }
  }, [connection.id, defaultCampaignId])

  useEffect(() => {
    void loadCampaigns()
  }, [loadCampaigns])

  useEffect(() => {
    setDefaultCampaignId(config.defaultCampaignId ?? "")
    setDeduplicate(config.deduplicateAcrossCampaigns)
  }, [config.defaultCampaignId, config.deduplicateAcrossCampaigns])

  async function saveSettings() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/platform/growth/providers/connections/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            ...connection.config,
            defaultCampaignId: defaultCampaignId.trim() || null,
            deduplicateAcrossCampaigns: deduplicate,
            campaignAutoLaunchWarning: selectedCampaign?.status === "running",
          },
          ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Save failed.")
      setWebhookSecret("")
      setSuccess("Lemlist settings saved.")
      await onUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  async function syncCampaigns() {
    setSyncing(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/platform/growth/providers/connections/${connection.id}/campaigns`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        campaigns?: SyncedCampaign[]
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Campaign sync failed.")
      setSyncedCampaigns(data.campaigns ?? [])
      setSuccess("Lemlist campaigns synced.")
      await loadCampaigns()
      await onUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Campaign sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setSuccess("Webhook URL copied.")
    } catch {
      setError("Could not copy webhook URL.")
    }
  }

  return (
    <GrowthEngineCard title="Lemlist Campaign Settings">
      {error ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {success ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="lemlist-campaign">Default campaign</Label>
          <select
            id="lemlist-campaign"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={defaultCampaignId}
            onChange={(e) => setDefaultCampaignId(e.target.value)}
            disabled={loadingCampaigns}
          >
            <option value="">Select a campaign…</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
                {campaign.status ? ` (${campaign.status})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 md:col-span-2">
          <input
            id="lemlist-deduplicate"
            type="checkbox"
            checked={deduplicate}
            onChange={(e) => setDeduplicate(e.target.checked)}
          />
          <Label htmlFor="lemlist-deduplicate">Deduplicate leads across Lemlist campaigns</Label>
        </div>
      </div>

      {selectedCampaign?.status === "running" ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>{LEMLIST_AUTO_LAUNCH_WARNING}</div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void loadCampaigns()} disabled={loadingCampaigns}>
          {loadingCampaigns ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh Campaigns
        </Button>
        <Button onClick={() => void syncCampaigns()} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Sync Campaign Stats
        </Button>
        <Button onClick={() => void saveSettings()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save Lemlist Settings
        </Button>
      </div>

      {selectedSyncedStats ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Sent</dt>
            <dd className="font-medium">{formatStat(selectedSyncedStats.sent)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Opened</dt>
            <dd className="font-medium">{formatStat(selectedSyncedStats.opened)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Clicked</dt>
            <dd className="font-medium">{formatStat(selectedSyncedStats.clicked)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Replied</dt>
            <dd className="font-medium">{formatStat(selectedSyncedStats.replied)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Interested</dt>
            <dd className="font-medium">{formatStat(selectedSyncedStats.interested)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bounced</dt>
            <dd className="font-medium">{formatStat(selectedSyncedStats.bounced)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Unsubscribed</dt>
            <dd className="font-medium">{formatStat(selectedSyncedStats.unsubscribed)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Meetings booked</dt>
            <dd className="font-medium">{formatStat(selectedSyncedStats.meetingBooked)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-6 space-y-3 border-t border-border pt-4">
        <div className="space-y-2">
          <Label htmlFor="lemlist-webhook-secret">Webhook secret (write-only)</Label>
          <Input
            id="lemlist-webhook-secret"
            type="password"
            autoComplete="off"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={connection.webhookSecretConfigured ? "Replace stored secret" : "Set webhook secret"}
          />
        </div>
        <div className="space-y-2">
          <Label>Webhook callback URL</Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => void copyWebhookUrl()}>
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{LEMLIST_WEBHOOK_VERIFICATION_NOTE}</p>
        </div>
      </div>
    </GrowthEngineCard>
  )
}
