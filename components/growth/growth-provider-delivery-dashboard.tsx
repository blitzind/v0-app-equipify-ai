"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { providerHealthTier, providerStatusLabel } from "@/lib/growth/providers/provider-health"
import { listDeliveryProviderRegistry } from "@/lib/growth/providers/provider-registry"
import type {
  GrowthDeliveryDashboard,
  GrowthDeliveryEvent,
  GrowthDeliveryProvider,
  GrowthDeliveryRoute,
  GrowthDeliveryRouteSelection,
} from "@/lib/growth/providers/provider-types"
import { GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER } from "@/lib/growth/providers/provider-types"
import type {
  GrowthDeliveryAttempt,
  GrowthProviderRateLimitRow,
  GrowthTransportHealthSnapshot,
  GrowthTransportSimulationResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"
import {
  GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER,
  GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE,
} from "@/lib/growth/providers/adapters/provider-adapter-types"
import { transportHealthLabel } from "@/lib/growth/providers/transport/transport-health"
import { supportsLiveTransport } from "@/lib/growth/providers/adapters/provider-transport-capability-registry"
import type { GrowthSenderAccount } from "@/lib/growth/sender/sender-types"
import {
  GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER,
  type GrowthComplianceDashboard,
} from "@/lib/growth/compliance/compliance-types"
import { senderReputationTierLabel } from "@/lib/growth/compliance/sender-reputation"
import { complianceHealthLabel, type GrowthSuppressionHealthSnapshot } from "@/lib/growth/compliance/suppression-health"
import {
  GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER,
  type GrowthEngagementAttributionDashboard,
  type GrowthTrackingHealthSnapshot,
} from "@/lib/growth/tracking/tracking-types"
import {
  GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER,
  type GrowthProviderWebhookDashboard,
} from "@/lib/growth/webhooks/webhook-types"
import { supportsTrackingSimulation, trackingHealthLabel } from "@/lib/growth/tracking/tracking-health"
import { GrowthAdminWidgetErrorBoundary } from "@/components/growth/growth-admin-widget-error-boundary"
import {
  GROWTH_PROVIDER_DELIVERY_RUNTIME_STABLE_QA_MARKER,
  sanitizeGrowthAdminUiError,
} from "@/lib/growth/admin-route-runtime-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  draft: "neutral",
  connected: "healthy",
  warning: "attention",
  degraded: "attention",
  disabled: "blocked",
  healthy: "healthy",
  critical: "critical",
}

const SEVERITY_TONE: Record<string, "healthy" | "medium" | "attention" | "critical" | "neutral"> = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function senderLabel(sender: GrowthSenderAccount): string {
  return sender.display_name || sender.email_address || "Sender"
}

type ListPayload = {
  ok?: boolean
  providers?: GrowthDeliveryProvider[]
  routes?: GrowthDeliveryRoute[]
  senders?: GrowthSenderAccount[]
  message?: string
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthDeliveryDashboard
  providers?: GrowthDeliveryProvider[]
  routes?: GrowthDeliveryRoute[]
  events?: GrowthDeliveryEvent[]
  senders?: GrowthSenderAccount[]
  message?: string
}

const REGISTRY = listDeliveryProviderRegistry()

function GrowthProviderDeliveryDashboardContent() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthDeliveryDashboard | null>(null)
  const [providers, setProviders] = useState<GrowthDeliveryProvider[]>([])
  const [routes, setRoutes] = useState<GrowthDeliveryRoute[]>([])
  const [events, setEvents] = useState<GrowthDeliveryEvent[]>([])
  const [senders, setSenders] = useState<GrowthSenderAccount[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const [newProviderKey, setNewProviderKey] = useState("")
  const [newProviderName, setNewProviderName] = useState("")
  const [newProviderFamily, setNewProviderFamily] = useState("google")
  const [newSenderId, setNewSenderId] = useState("")
  const [simSenderId, setSimSenderId] = useState("")
  const [simVolume, setSimVolume] = useState("1")
  const [simProviderState, setSimProviderState] = useState("connected")
  const [simulation, setSimulation] = useState<GrowthDeliveryRouteSelection | null>(null)
  const [transportSimulation, setTransportSimulation] = useState<GrowthTransportSimulationResult | null>(null)
  const [attempts, setAttempts] = useState<GrowthDeliveryAttempt[]>([])
  const [rateLimits, setRateLimits] = useState<Array<GrowthProviderRateLimitRow & { status?: { allowed: boolean; reason: string } }>>([])
  const [transportHealth, setTransportHealth] = useState<GrowthTransportHealthSnapshot | null>(null)
  const [trackingHealth, setTrackingHealth] = useState<GrowthTrackingHealthSnapshot | null>(null)
  const [complianceDashboard, setComplianceDashboard] = useState<GrowthComplianceDashboard | null>(null)
  const [complianceHealth, setComplianceHealth] = useState<GrowthSuppressionHealthSnapshot | null>(null)
  const [webhookDashboard, setWebhookDashboard] = useState<GrowthProviderWebhookDashboard | null>(null)
  const [testSendOpen, setTestSendOpen] = useState(false)
  const [testSendTo, setTestSendTo] = useState("")
  const [testSendConfirmed, setTestSendConfirmed] = useState(false)
  const [simProviderId, setSimProviderId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<GrowthDeliveryProvider | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null,
    [providers, selectedProviderId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [listResponse, dashboardResponse, attemptsResponse, rateLimitsResponse, engagementResponse, complianceResponse, webhooksResponse] = await Promise.all([
        fetch("/api/platform/growth/providers"),
        fetch("/api/platform/growth/providers/dashboard"),
        fetch("/api/platform/growth/providers/delivery-attempts?limit=20"),
        fetch("/api/platform/growth/providers/rate-limits"),
        fetch("/api/platform/growth/engagement"),
        fetch("/api/platform/growth/compliance/dashboard"),
        fetch("/api/platform/growth/webhooks/provider-events"),
      ])
      const listPayload = (await listResponse.json()) as ListPayload
      const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload
      const attemptsPayload = (await attemptsResponse.json()) as { attempts?: GrowthDeliveryAttempt[] }
      const rateLimitsPayload = (await rateLimitsResponse.json()) as {
        rate_limits?: Array<GrowthProviderRateLimitRow & { status?: { allowed: boolean; reason: string } }>
      }
      const engagementPayload = (await engagementResponse.json()) as {
        dashboard?: GrowthEngagementAttributionDashboard
      }
      const compliancePayload = (await complianceResponse.json()) as {
        dashboard?: GrowthComplianceDashboard
      }
      const webhooksPayload = (await webhooksResponse.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthProviderWebhookDashboard
        message?: string
      }
      if (!listResponse.ok) throw new Error(listPayload.message ?? "Could not load delivery providers.")
      if (!dashboardResponse.ok) throw new Error(dashboardPayload.message ?? "Could not load delivery dashboard.")

      const mergedProviders = dashboardPayload.providers ?? listPayload.providers ?? []
      setProviders(mergedProviders)
      setRoutes(dashboardPayload.routes ?? listPayload.routes ?? [])
      setSenders(dashboardPayload.senders ?? listPayload.senders ?? [])
      setDashboard(dashboardPayload.dashboard ?? null)
      setEvents(dashboardPayload.events ?? [])
      setAttempts(attemptsPayload.attempts ?? [])
      setRateLimits(rateLimitsPayload.rate_limits ?? [])

      const connectedCount = mergedProviders.filter((provider) => provider.status === "connected").length
      setTransportHealth({
        qa_marker: GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER,
        queued_count: (attemptsPayload.attempts ?? []).filter((attempt) => attempt.status === "queued").length,
        sent_count_24h: (attemptsPayload.attempts ?? []).filter((attempt) => attempt.status === "sent").length,
        failed_count_24h: (attemptsPayload.attempts ?? []).filter((attempt) => attempt.status === "failed").length,
        retry_scheduled_count: (attemptsPayload.attempts ?? []).filter((attempt) => attempt.status === "retry_scheduled").length,
        rate_limited_providers: (rateLimitsPayload.rate_limits ?? []).filter((row) => row.status && !row.status.allowed).length,
        healthy_providers: Math.max(0, connectedCount - (rateLimitsPayload.rate_limits ?? []).filter((row) => row.status && !row.status.allowed).length),
      })
      setTrackingHealth(engagementPayload.dashboard?.trackingHealth ?? null)
      setComplianceDashboard(compliancePayload.dashboard ?? null)
      setWebhookDashboard(
        webhooksResponse.ok && webhooksPayload.ok !== false ? (webhooksPayload.dashboard ?? null) : null,
      )
      setComplianceHealth(
        compliancePayload.dashboard
          ? {
              qa_marker: GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER,
              schema_ready: true,
              active_suppressions: compliancePayload.dashboard.suppressionCount,
              unsubscribes_30d: 0,
              hard_bounces_30d: 0,
              complaints_30d: 0,
              compliance_health:
                compliancePayload.dashboard.senderReputation.tier === "critical"
                  ? "critical"
                  : compliancePayload.dashboard.senderReputation.tier === "warning"
                    ? "degraded"
                    : "healthy",
              notes: [],
            }
          : null,
      )

      if (!selectedProviderId && mergedProviders.length > 0) {
        setSelectedProviderId(mergedProviders[0].id)
      }
      if (!simSenderId && (listPayload.senders?.length ?? 0) > 0) {
        setSimSenderId(listPayload.senders![0].id)
      }
    } catch (loadError) {
      setError(
        sanitizeGrowthAdminUiError(
          loadError instanceof Error ? loadError.message : "Could not load provider delivery layer.",
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [selectedProviderId, simSenderId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    try {
      await action()
      await load()
    } catch (actionError) {
      setError(
        sanitizeGrowthAdminUiError(
          actionError instanceof Error ? actionError.message : "Delivery action failed.",
        ),
      )
    } finally {
      setActionLoading(null)
    }
  }

  async function createProvider() {
    const response = await fetch("/api/platform/growth/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerKey: newProviderKey.trim(),
        providerName: newProviderName.trim(),
        providerFamily: newProviderFamily,
        senderAccountId: newSenderId || undefined,
      }),
    })
    const payload = (await response.json()) as { message?: string; provider?: GrowthDeliveryProvider }
    if (!response.ok) throw new Error(payload.message ?? "Could not create delivery provider.")
    if (payload.provider) setSelectedProviderId(payload.provider.id)
    setNewProviderKey("")
    setNewProviderName("")
  }

  async function validateProvider() {
    if (!selectedProvider) throw new Error("Select a provider first.")
    const response = await fetch("/api/platform/growth/providers/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: selectedProvider.id }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not validate provider.")
  }

  async function disableProvider() {
    if (!selectedProvider) throw new Error("Select a provider first.")
    const response = await fetch(`/api/platform/growth/providers/${selectedProvider.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "disabled" }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not disable provider.")
  }

  async function deleteProvider(provider: GrowthDeliveryProvider) {
    const response = await fetch(`/api/platform/growth/providers/${provider.id}`, { method: "DELETE" })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not delete provider.")
    setDeleteTarget(null)
  }

  async function runRouteTest() {
    const volume = Number.parseInt(simVolume, 10)
    const response = await fetch("/api/platform/growth/providers/route-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderAccountId: simSenderId,
        volume: Number.isFinite(volume) ? volume : 1,
        providerState: simProviderState,
      }),
    })
    const payload = (await response.json()) as { message?: string; selection?: GrowthDeliveryRouteSelection }
    if (!response.ok) throw new Error(payload.message ?? "Route test failed.")
    setSimulation(payload.selection ?? null)

    const matchedRoute = routes.find(
      (route) =>
        route.sender_account_id === simSenderId &&
        (simProviderId ? route.provider_id === simProviderId : true),
    )
    const matchedRateLimit = rateLimits.find((row) => row.provider_id === (matchedRoute?.provider_id ?? ""))
    const fallbackRoute = routes.find((route) => route.id === payload.selection?.fallback_route_id)

    setTransportSimulation({
      route: {
        selected_route_id: payload.selection?.selected_route_id ?? null,
        selected_provider_name: payload.selection?.selected_provider_name ?? null,
        fallback_route_id: payload.selection?.fallback_route_id ?? null,
        fallback_provider_name: payload.selection?.fallback_provider_name ?? null,
        reason: payload.selection?.reason ?? "",
      },
      rate_limit: {
        allowed: matchedRateLimit?.status?.allowed ?? true,
        reason: matchedRateLimit?.status?.reason ?? "No rate limit row configured.",
        minute_remaining: matchedRateLimit ? Math.max(0, matchedRateLimit.minute_cap - matchedRateLimit.current_minute) : 0,
        hour_remaining: matchedRateLimit ? Math.max(0, matchedRateLimit.hour_cap - matchedRateLimit.current_hour) : 0,
        day_remaining: matchedRateLimit ? Math.max(0, matchedRateLimit.day_cap - matchedRateLimit.current_day) : 0,
      },
      fallback_route: {
        route_id: fallbackRoute?.id ?? payload.selection?.fallback_route_id ?? null,
        provider_name: fallbackRoute?.provider_name ?? payload.selection?.fallback_provider_name ?? null,
      },
    })
  }

  async function runLiveSendTest() {
    if (!testSendConfirmed) throw new Error("Confirm human approval before sending.")
    if (!simSenderId) throw new Error("Select a sender for the live send test.")
    const response = await fetch("/api/platform/growth/providers/test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderAccountId: simSenderId,
        to: testSendTo.trim(),
        humanApproved: true,
        humanApprovalConfirmed: true,
      }),
    })
    const payload = (await response.json()) as { message?: string; ok?: boolean; error?: string }
    if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Live send test failed.")
    setTestSendOpen(false)
    setTestSendConfirmed(false)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading provider delivery layer…
      </div>
    )
  }

  return (
    <div
      className="space-y-6"
      data-qa-marker={GROWTH_PROVIDER_DELIVERY_RUNTIME_STABLE_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER} · {GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER} ·{" "}
          {GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER} · {GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER} ·{" "}
          {GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER} · {GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/providers">Provider Diagnostics</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(actionLoading)}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Provider Health">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Connected" value={String(dashboard?.connected_count ?? 0)} />
          <StatTile label="Warning" value={String(dashboard?.warning_count ?? 0)} />
          <StatTile label="Disabled" value={String(dashboard?.disabled_count ?? 0)} />
          <StatTile label="Average Health" value={String(dashboard?.average_health_score ?? 0)} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Transport Health">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Queued" value={String(transportHealth?.queued_count ?? 0)} />
          <StatTile label="Sent (recent)" value={String(transportHealth?.sent_count_24h ?? 0)} />
          <StatTile label="Failed (recent)" value={String(transportHealth?.failed_count_24h ?? 0)} />
          <StatTile label="Retry scheduled" value={String(transportHealth?.retry_scheduled_count ?? 0)} />
          <StatTile label="System" value={transportHealth ? transportHealthLabel(transportHealth) : "—"} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Attribution Health">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Tracking enabled" value={trackingHealth?.tracking_enabled ? "Yes" : "No"} />
          <StatTile label="Attribution health" value={trackingHealth ? trackingHealthLabel(trackingHealth.attribution_health) : "—"} />
          <StatTile label="Opens (24h)" value={String(trackingHealth?.open_events_24h ?? 0)} />
          <StatTile label="Clicks (24h)" value={String(trackingHealth?.click_events_24h ?? 0)} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Compliance status">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Compliance health"
            value={complianceHealth ? complianceHealthLabel(complianceHealth.compliance_health) : "—"}
          />
          <StatTile
            label="Reputation trend"
            value={
              complianceDashboard
                ? `${complianceDashboard.senderReputation.score} (${senderReputationTierLabel(complianceDashboard.senderReputation.tier)})`
                : "—"
            }
          />
          <StatTile label="Suppression protection" value={String(complianceDashboard?.suppressionCount ?? 0)} />
          <StatTile label="Hard bounce rate" value={complianceDashboard ? `${complianceDashboard.hardBounceRate.toFixed(1)}%` : "—"} />
        </div>
        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/providers/compliance">Open Compliance</Link>
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Webhook Health">
        <p className="mb-3 text-xs text-muted-foreground">{GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Received (24h)" value={String(webhookDashboard?.received24h ?? 0)} />
          <StatTile label="Last Provider Event" value={formatDate(webhookDashboard?.lastProviderEventAt)} />
          <StatTile
            label="Delivery Confirmation Rate"
            value={webhookDashboard ? `${webhookDashboard.deliveryConfirmationRate.toFixed(1)}%` : "—"}
          />
          <StatTile label="Signature Failures (24h)" value={String(webhookDashboard?.signatureFailures24h ?? 0)} />
        </div>
        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/providers/webhooks">Open Webhooks</Link>
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Rate Limits">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Provider</th>
                <th className="px-2 py-2 font-medium">Minute</th>
                <th className="px-2 py-2 font-medium">Hour</th>
                <th className="px-2 py-2 font-medium">Day</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rateLimits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    Rate limits initialize on first human-approved send.
                  </td>
                </tr>
              ) : (
                rateLimits.map((row) => {
                  const providerName = providers.find((provider) => provider.id === row.provider_id)?.provider_name ?? "Provider"
                  return (
                    <tr key={row.id} className="border-b">
                      <td className="px-2 py-2">{providerName}</td>
                      <td className="px-2 py-2">
                        {row.current_minute}/{row.minute_cap}
                      </td>
                      <td className="px-2 py-2">
                        {row.current_hour}/{row.hour_cap}
                      </td>
                      <td className="px-2 py-2">
                        {row.current_day}/{row.day_cap}
                      </td>
                      <td className="px-2 py-2">
                        <GrowthBadge
                          label={row.status?.allowed ? "Available" : "Limited"}
                          tone={row.status?.allowed ? "healthy" : "attention"}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Attempt Queue">
        <div className="space-y-2">
          {attempts.slice(0, 8).map((attempt) => (
            <div key={attempt.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge label={attempt.status} tone={STATUS_TONE[attempt.status === "sent" ? "healthy" : attempt.status === "failed" ? "critical" : "attention"] ?? "neutral"} />
                <span className="font-medium">{attempt.metadata.subject ? String(attempt.metadata.subject) : "Delivery attempt"}</span>
                <span className="text-xs text-muted-foreground">{formatDate(attempt.queued_at)}</span>
              </div>
              {attempt.failure_reason ? (
                <p className="mt-1 text-xs text-muted-foreground">{attempt.failure_reason}</p>
              ) : null}
              {(attempt.metadata.tracking as { tracking_enabled?: boolean } | undefined)?.tracking_enabled === true ? (
                <p className="mt-1 text-xs text-emerald-700">Tracking enabled</p>
              ) : null}
            </div>
          ))}
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No delivery attempts yet. Use Live Send Test with human approval.</p>
          ) : null}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Add Provider">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
          <div className="space-y-2">
            <Label htmlFor="provider-key">Provider key</Label>
            <Input id="provider-key" value={newProviderKey} onChange={(e) => setNewProviderKey(e.target.value)} placeholder="acme-google-primary" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider-name">Display name</Label>
            <Input id="provider-name" value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)} placeholder="Acme Google Primary" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider-family">Family</Label>
            <Select value={newProviderFamily} onValueChange={setNewProviderFamily}>
              <SelectTrigger id="provider-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGISTRY.map((entry) => (
                  <SelectItem key={entry.provider_family} value={entry.provider_family}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="route-sender">Optional sender route</Label>
            <Select value={newSenderId || "__none__"} onValueChange={(value) => setNewSenderId(value === "__none__" ? "" : value)}>
              <SelectTrigger id="route-sender">
                <SelectValue placeholder="No route yet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No route</SelectItem>
                {senders.map((sender) => (
                  <SelectItem key={sender.id} value={sender.id}>
                    {senderLabel(sender)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={!newProviderKey.trim() || !newProviderName.trim() || Boolean(actionLoading)}
            onClick={() => void runAction("create-provider", createProvider)}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add Provider
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Provider Table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Provider</th>
                <th className="px-2 py-2 font-medium">Family</th>
                <th className="px-2 py-2 font-medium">Capabilities</th>
                <th className="px-2 py-2 font-medium">Health</th>
                <th className="px-2 py-2 font-medium">Connected</th>
                <th className="px-2 py-2 font-medium">Validated</th>
                <th className="px-2 py-2 font-medium">Transport</th>
                <th className="px-2 py-2 font-medium">Daily Capacity</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                    No delivery providers registered yet.
                  </td>
                </tr>
              ) : (
                providers.map((provider) => (
                  <tr
                    key={provider.id}
                    className={`border-b ${selectedProvider?.id === provider.id ? "bg-muted/60" : ""}`}
                    onClick={() => setSelectedProviderId(provider.id)}
                  >
                    <td className="cursor-pointer px-2 py-2">{provider.provider_name}</td>
                    <td className="px-2 py-2">{provider.provider_family}</td>
                    <td className="px-2 py-2">{provider.capabilities_label ?? "—"}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge
                        label={`${provider.health_score} · ${providerHealthTier(provider.health_score)}`}
                        tone={STATUS_TONE[providerHealthTier(provider.health_score)] ?? "neutral"}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <GrowthBadge
                        label={provider.status === "connected" || provider.status === "warning" ? "Yes" : "No"}
                        tone={provider.status === "connected" ? "healthy" : "neutral"}
                      />
                    </td>
                    <td className="px-2 py-2">{formatDate(provider.last_validation_at)}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge
                        label={supportsLiveTransport(provider.provider_family) ? providerHealthTier(provider.health_score) : "N/A"}
                        tone={supportsLiveTransport(provider.provider_family) ? STATUS_TONE[providerHealthTier(provider.health_score)] ?? "neutral" : "neutral"}
                      />
                    </td>
                    <td className="px-2 py-2">{provider.max_daily_volume}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge label={providerStatusLabel(provider.status)} tone={STATUS_TONE[provider.status] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(provider)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {selectedProvider ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" variant="outline" size="sm" disabled={Boolean(actionLoading)} onClick={() => void runAction("validate", validateProvider)}>
              Validate
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={Boolean(actionLoading)} onClick={() => void runAction("disable", disableProvider)}>
              Disable
            </Button>
          </div>
        ) : null}
      </GrowthEngineCard>

      <GrowthEngineCard title="Route Table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Sender</th>
                <th className="px-2 py-2 font-medium">Primary Route</th>
                <th className="px-2 py-2 font-medium">Fallback</th>
                <th className="px-2 py-2 font-medium">Current Volume</th>
                <th className="px-2 py-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    No delivery routes configured. Add a provider with an optional sender route.
                  </td>
                </tr>
              ) : (
                routes.map((route) => (
                  <tr key={route.id} className="border-b">
                    <td className="px-2 py-2">{route.sender_label}</td>
                    <td className="px-2 py-2">{route.provider_name}</td>
                    <td className="px-2 py-2">{route.fallback_provider_name ?? "—"}</td>
                    <td className="px-2 py-2">
                      {route.current_volume}
                      {route.daily_cap > 0 ? ` / ${route.daily_cap}` : ""}
                    </td>
                    <td className="px-2 py-2">{route.health_weight}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Sender pool rotation">
        <p className="text-sm text-muted-foreground">
          When a sequence or delivery job references a sender pool, the rotation engine selects an eligible sender before
          provider route selection. Manual sender selection is preserved when auto-rotation is off.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/admin/growth/providers/sender-pools">Open Sender Pools</Link>
        </Button>
      </GrowthEngineCard>

      <GrowthEngineCard title="Deliverability operations">
        <p className="text-sm text-muted-foreground">
          Monitor sender, domain, provider, and compliance health with human-gated recommendations. No autonomous DNS,
          sender, volume, or provider route changes.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/admin/growth/providers/deliverability-ops">Open Deliverability Ops</Link>
        </Button>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <GrowthEngineCard title="Transport Simulator">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sim-sender">Sender</Label>
              <Select value={simSenderId} onValueChange={setSimSenderId}>
                <SelectTrigger id="sim-sender">
                  <SelectValue placeholder="Select sender" />
                </SelectTrigger>
                <SelectContent>
                  {senders.map((sender) => (
                    <SelectItem key={sender.id} value={sender.id}>
                      {senderLabel(sender)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-volume">Volume</Label>
              <Input id="sim-volume" value={simVolume} onChange={(e) => setSimVolume(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-provider">Provider</Label>
              <Select value={simProviderId || "__auto__"} onValueChange={(value) => setSimProviderId(value === "__auto__" ? "" : value)}>
                <SelectTrigger id="sim-provider">
                  <SelectValue placeholder="Auto route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Auto route</SelectItem>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.provider_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sim-state">Provider State</Label>
              <Select value={simProviderState} onValueChange={setSimProviderState}>
                <SelectTrigger id="sim-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="degraded">Degraded</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={!simSenderId || Boolean(actionLoading)} onClick={() => void runAction("route-test", runRouteTest)}>
              Simulate Transport
            </Button>
            <Button type="button" variant="outline" disabled={!simSenderId || Boolean(actionLoading)} onClick={() => setTestSendOpen(true)}>
              Live Send Test
            </Button>
          </div>
          {transportSimulation ? (
            <div className="mt-4 space-y-2 rounded-xl border border-border px-4 py-3 text-sm">
              <p>
                <span className="font-medium">Route:</span> {transportSimulation.route.selected_provider_name ?? "None"}
              </p>
              <p>
                <span className="font-medium">Rate limit:</span>{" "}
                {transportSimulation.rate_limit.allowed ? "Available" : "Limited"} — {transportSimulation.rate_limit.reason}
              </p>
              <p>
                <span className="font-medium">Fallback route:</span> {transportSimulation.fallback_route.provider_name ?? "None"}
              </p>
              {(() => {
                const sim = supportsTrackingSimulation()
                return (
                  <>
                    <p>
                      <span className="font-medium">Tracking support:</span> {sim.trackingSupport ? "Enabled" : "Disabled"}
                    </p>
                    <p>
                      <span className="font-medium">Link rewrite support:</span> {sim.linkRewriteSupport ? "Enabled" : "Disabled"}
                    </p>
                    <p>
                      <span className="font-medium">Pixel support:</span> {sim.pixelSupport ? "Enabled" : "Disabled"}
                    </p>
                  </>
                )
              })()}
              <p className="text-muted-foreground">{transportSimulation.route.reason}</p>
            </div>
          ) : simulation ? (
            <div className="mt-4 space-y-2 rounded-xl border border-border px-4 py-3 text-sm">
              <p>
                <span className="font-medium">Selected route:</span> {simulation.selected_provider_name ?? "None"}
              </p>
              <p>
                <span className="font-medium">Fallback route:</span> {simulation.fallback_provider_name ?? "None"}
              </p>
              <p className="text-muted-foreground">{simulation.reason}</p>
            </div>
          ) : null}
        </GrowthEngineCard>

        <GrowthEngineCard title="Provider Delivery Feed">
          <div className="space-y-2">
            {events.slice(0, 10).map((event) => (
              <div key={event.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={event.severity} tone={SEVERITY_TONE[event.severity] ?? "neutral"} />
                  <span className="text-sm font-medium">{event.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
              </div>
            ))}
            {events.length === 0 ? <p className="text-sm text-muted-foreground">No delivery events yet.</p> : null}
          </div>
        </GrowthEngineCard>
      </div>

      <AlertDialog open={testSendOpen} onOpenChange={(open) => !open && (setTestSendOpen(false), setTestSendConfirmed(false))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Live Send Test — human approval required</AlertDialogTitle>
            <AlertDialogDescription>
              This sends a real message through the selected provider route. Autonomous sending is disabled — you must confirm
              manually. No secrets are shown in this dialog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="test-send-to">Recipient email</Label>
              <Input id="test-send-to" type="email" value={testSendTo} onChange={(e) => setTestSendTo(e.target.value)} placeholder="you@company.com" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={testSendConfirmed}
                onChange={(e) => setTestSendConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span>I confirm this human-approved live send test. I understand this is not autonomous outreach.</span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={!testSendTo.trim() || !testSendConfirmed || Boolean(actionLoading)}
              onClick={() => void runAction("test-send", runLiveSendTest)}
            >
              Send test message
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete delivery provider?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes {deleteTarget?.provider_name} and disables routing. No messages will be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(actionLoading)}
              onClick={() => deleteTarget && void runAction("delete", () => deleteProvider(deleteTarget))}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function GrowthProviderDeliveryDashboardPanel() {
  const [retryKey, setRetryKey] = useState(0)

  return (
    <GrowthAdminWidgetErrorBoundary
      label="Provider delivery"
      qaMarker={GROWTH_PROVIDER_DELIVERY_RUNTIME_STABLE_QA_MARKER}
      onRetry={() => setRetryKey((value) => value + 1)}
    >
      <GrowthProviderDeliveryDashboardBoundaryContent retryKey={retryKey} />
    </GrowthAdminWidgetErrorBoundary>
  )
}

function GrowthProviderDeliveryDashboardBoundaryContent({ retryKey }: { retryKey: number }): ReactNode {
  return <GrowthProviderDeliveryDashboardContent key={retryKey} />
}
