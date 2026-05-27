"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
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
import type { GrowthSenderAccount } from "@/lib/growth/sender/sender-types"

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

export function GrowthProviderDeliveryDashboardPanel() {
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
      const [listResponse, dashboardResponse] = await Promise.all([
        fetch("/api/platform/growth/providers"),
        fetch("/api/platform/growth/providers/dashboard"),
      ])
      const listPayload = (await listResponse.json()) as ListPayload
      const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload
      if (!listResponse.ok) throw new Error(listPayload.message ?? "Could not load delivery providers.")
      if (!dashboardResponse.ok) throw new Error(dashboardPayload.message ?? "Could not load delivery dashboard.")

      const mergedProviders = dashboardPayload.providers ?? listPayload.providers ?? []
      setProviders(mergedProviders)
      setRoutes(dashboardPayload.routes ?? listPayload.routes ?? [])
      setSenders(dashboardPayload.senders ?? listPayload.senders ?? [])
      setDashboard(dashboardPayload.dashboard ?? null)
      setEvents(dashboardPayload.events ?? [])

      if (!selectedProviderId && mergedProviders.length > 0) {
        setSelectedProviderId(mergedProviders[0].id)
      }
      if (!simSenderId && (listPayload.senders?.length ?? 0) > 0) {
        setSimSenderId(listPayload.senders![0].id)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load provider delivery layer.")
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
      setError(actionError instanceof Error ? actionError.message : "Delivery action failed.")
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER} · Transport abstraction and route simulation only — no live sending or workers.
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

      <GrowthEngineCard title="Live Delivery Engine">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Outbound delivery workers and provider dispatch are not enabled in this foundation phase.
          </p>
          <Button type="button" variant="outline" size="sm" disabled>
            Live Delivery Engine
            <GrowthBadge label="Coming Soon" tone="neutral" className="ml-2" />
          </Button>
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
                <th className="px-2 py-2 font-medium">Validation</th>
                <th className="px-2 py-2 font-medium">Daily Capacity</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
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
                    <td className="px-2 py-2">{formatDate(provider.last_validation_at)}</td>
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

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <GrowthEngineCard title="Route Simulator">
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
          <Button type="button" className="mt-4" disabled={!simSenderId || Boolean(actionLoading)} onClick={() => void runAction("route-test", runRouteTest)}>
            Route Test
          </Button>
          {simulation ? (
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

        <GrowthEngineCard title="Delivery Events">
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
