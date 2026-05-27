"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Webhook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER,
  GROWTH_WEBHOOK_PRIVACY_NOTE,
  type GrowthProviderWebhookDashboard,
} from "@/lib/growth/webhooks/webhook-types"

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  processed: "healthy",
  pending: "neutral",
  failed: "critical",
  duplicate: "attention",
  signature_failed: "blocked",
  active: "healthy",
  simulation: "attention",
  disabled: "blocked",
}

export function GrowthProviderWebhooksDashboardPanel() {
  const [dashboard, setDashboard] = useState<GrowthProviderWebhookDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/webhooks/provider-events", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthProviderWebhookDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load provider webhook dashboard.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading provider webhooks…
      </div>
    )
  }

  if (error && !dashboard) {
    return <p className="text-sm text-rose-600">{error}</p>
  }

  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        {GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER} · {GROWTH_WEBHOOK_PRIVACY_NOTE}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Received 24h" value={dashboard.received24h} />
          <StatTile label="Processed" value={dashboard.processed24h} />
          <StatTile label="Failed" value={dashboard.failed24h} />
          <StatTile label="Signature Failures" value={dashboard.signatureFailures24h} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Webhook health" icon={<Webhook className="size-4" />}>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Delivery confirmation rate: {dashboard.deliveryConfirmationRate.toFixed(1)}%</span>
          <span>Last provider event: {formatDate(dashboard.lastProviderEventAt)}</span>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Provider Event Feed">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Provider</th>
                <th className="px-2 py-2 font-medium">Event</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Attempt</th>
                <th className="px-2 py-2 font-medium">Lead</th>
                <th className="px-2 py-2 font-medium">Occurred</th>
                <th className="px-2 py-2 font-medium">Processed</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-muted-foreground">
                    No provider webhook events yet.
                  </td>
                </tr>
              ) : (
                dashboard.events.map((event) => (
                  <tr key={event.id} className="border-b border-border/40">
                    <td className="px-2 py-2 capitalize">{event.providerFamily}</td>
                    <td className="px-2 py-2">{event.normalizedEventType}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge
                        label={event.processingStatus}
                        tone={STATUS_TONE[event.processingStatus] ?? "neutral"}
                      />
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{event.deliveryAttemptId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-2 py-2 font-mono text-xs">{event.leadId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-2 py-2">{formatDate(event.occurredAt)}</td>
                    <td className="px-2 py-2">{formatDate(event.processedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Endpoint table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Provider</th>
                <th className="px-2 py-2 font-medium">Slug</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Last Received</th>
                <th className="px-2 py-2 font-medium">Failures</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.endpoints.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-muted-foreground">
                    No webhook endpoints configured.
                  </td>
                </tr>
              ) : (
                dashboard.endpoints.map((endpoint) => (
                  <tr key={endpoint.id} className="border-b border-border/40">
                    <td className="px-2 py-2 capitalize">{endpoint.providerFamily}</td>
                    <td className="px-2 py-2 font-mono text-xs">{endpoint.endpointSlug}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge label={endpoint.status} tone={STATUS_TONE[endpoint.status] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-2">{formatDate(endpoint.lastReceivedAt)}</td>
                    <td className="px-2 py-2">{endpoint.failureCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>
    </div>
  )
}
