"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Loader2,
  Plug,
  RefreshCw,
  ShieldOff,
  TestTube2,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_PROVIDER_CAPABILITY_LABELS,
  growthProviderDeleteRequiresConfirmation,
  type GrowthPlatformTimelineEvent,
  type GrowthProviderCapabilityKey,
  type GrowthProviderConnectionSummary,
  type GrowthProviderLifecycleStatus,
  type GrowthProviderValidationResult,
} from "@/lib/growth/outbound/provider-types"
import { GrowthLemlistProviderSettings } from "@/components/growth/growth-lemlist-provider-settings"
import { GROWTH_OUTBOUND_PROVIDER_FAMILIES, type GrowthOutboundProviderFamily } from "@/lib/growth/outbound/types"

const LIFECYCLE_TONE: Record<
  GrowthProviderLifecycleStatus,
  "healthy" | "attention" | "critical" | "neutral" | "blocked"
> = {
  connected: "healthy",
  warning: "attention",
  error: "critical",
  configuring: "neutral",
  not_connected: "neutral",
  disabled: "blocked",
}

const CAPABILITY_TONE: Record<string, string> = {
  supported: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  unavailable: "bg-muted text-muted-foreground",
  disabled: "bg-slate-100 text-slate-700",
}

type ConnectionsPayload = {
  ok?: boolean
  error?: string
  message?: string
  connections?: GrowthProviderConnectionSummary[]
  adapters?: Array<{ providerKey: string; providerName: string; providerFamily: GrowthOutboundProviderFamily }>
  capabilityLabels?: Record<GrowthProviderCapabilityKey, string>
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function GrowthProvidersDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [connections, setConnections] = useState<GrowthProviderConnectionSummary[]>([])
  const [adapters, setAdapters] = useState<ConnectionsPayload["adapters"]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<GrowthPlatformTimelineEvent[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [newFamily, setNewFamily] = useState<GrowthOutboundProviderFamily>("lemlist")
  const [newLabel, setNewLabel] = useState("")
  const [credentialApiKey, setCredentialApiKey] = useState("")

  const selected = useMemo(
    () => (selectedId ? connections.find((entry) => entry.id === selectedId) ?? null : null),
    [connections, selectedId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/providers/connections", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as ConnectionsPayload
      if (!res.ok || !data.ok || !data.connections) {
        throw new Error(data.message ?? "Could not load provider connections.")
      }
      setConnections(data.connections)
      setAdapters(data.adapters ?? [])
      setSelectedId((current) => {
        if (current && data.connections!.some((entry) => entry.id === current)) return current
        return data.connections![0]?.id ?? ""
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTimeline = useCallback(async (connectionId: string) => {
    const res = await fetch(
      `/api/platform/growth/providers/connections/${connectionId}/timeline?includeHistory=false`,
      { cache: "no-store" },
    )
    const data = (await res.json().catch(() => ({}))) as { events?: GrowthPlatformTimelineEvent[] }
    if (res.ok) setTimeline(data.events ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selected?.id) void loadTimeline(selected.id)
  }, [selected?.id, loadTimeline])

  async function runAction(key: string, fn: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    setSuccess(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function createConnection() {
    if (!newLabel.trim()) {
      setError("Label is required.")
      return
    }
    await runAction("create", async () => {
      const res = await fetch("/api/platform/growth/providers/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerFamily: newFamily, label: newLabel.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { connection?: GrowthProviderConnectionSummary; message?: string }
      if (!res.ok) throw new Error(data.message ?? "Create failed.")
      setSuccess("Provider connection created.")
      setNewLabel("")
      await load()
      if (data.connection) setSelectedId(data.connection.id)
    })
  }

  async function saveCredentials() {
    if (!selected || !credentialApiKey.trim()) {
      setError("API key is required.")
      return
    }
    await runAction("credentials", async () => {
      const res = await fetch(`/api/platform/growth/providers/connections/${selected.id}/credentials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: credentialApiKey.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Credential update failed.")
      setCredentialApiKey("")
      setSuccess("Credentials saved (write-only). Run Test Connection.")
      await load()
    })
  }

  async function testConnection() {
    if (!selected) return
    await runAction("validate", async () => {
      const res = await fetch(`/api/platform/growth/providers/connections/${selected.id}/validate`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        remainingMs?: number
        validation?: GrowthProviderValidationResult
      }
      if (res.status === 429) {
        throw new Error(`Validation cooldown active (${Math.ceil((data.remainingMs ?? 0) / 1000)}s remaining).`)
      }
      if (!res.ok) throw new Error(data.message ?? "Validation failed.")
      setSuccess(
        data.validation?.healthy
          ? `Connection healthy (${formatMs(data.validation.durationMs)}).`
          : "Validation completed with errors.",
      )
      await load()
      await loadTimeline(selected.id)
    })
  }

  async function disableConnection() {
    if (!selected) return
    await runAction("disable", async () => {
      const res = await fetch(`/api/platform/growth/providers/connections/${selected.id}/disable`, { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Disable failed.")
      setSuccess("Provider disabled.")
      await load()
      await loadTimeline(selected.id)
    })
  }

  async function reconnectConnection() {
    if (!selected) return
    await runAction("reconnect", async () => {
      const res = await fetch(`/api/platform/growth/providers/connections/${selected.id}/reconnect`, { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Reconnect failed.")
      setSuccess("Provider reconnected — run Test Connection.")
      await load()
      await loadTimeline(selected.id)
    })
  }

  async function deleteConnection() {
    if (!selected) return
    const deletedId = selected.id
    await runAction("delete", async () => {
      const res = await fetch(`/api/platform/growth/providers/connections/${deletedId}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        error?: string
        deleted?: { id: string; deletedAt: string }
      }
      if (res.status === 409 && data.error === "active_email_provider") {
        throw new Error(data.message ?? "Clear the active email provider in Communication Settings first.")
      }
      if (!res.ok || !data.ok || !data.deleted?.deletedAt) {
        throw new Error(data.message ?? "Delete failed.")
      }
      setDeleteDialogOpen(false)
      setConnections((prev) => prev.filter((entry) => entry.id !== deletedId))
      setSelectedId("")
      setTimeline([])
      setSuccess("Provider connection deleted.")
      await load()
    })
  }

  function handleDeleteClick() {
    if (!selected) return
    if (growthProviderDeleteRequiresConfirmation(selected.health.lifecycleStatus)) {
      setDeleteDialogOpen(true)
      return
    }
    void deleteConnection()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading provider connections…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <GrowthEngineCard title="Add Provider Connection" icon={<Plug size={16} />}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="provider-family">Provider family</Label>
            <select
              id="provider-family"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={newFamily}
              onChange={(e) => setNewFamily(e.target.value as GrowthOutboundProviderFamily)}
            >
              {GROWTH_OUTBOUND_PROVIDER_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {adapters?.find((a) => a.providerFamily === family)?.providerName ?? family}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="provider-label">Label</Label>
            <Input
              id="provider-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Production Smartlead"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void createConnection()} disabled={actionLoading === "create"}>
            {actionLoading === "create" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create Connection
          </Button>
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <GrowthEngineCard title="Connections">
          <div className="flex flex-col gap-2">
            {connections.map((connection) => (
              <button
                key={connection.id}
                type="button"
                onClick={() => setSelectedId(connection.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  (selectedId ? selectedId === connection.id : connections[0]?.id === connection.id)
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="font-medium">{connection.label}</div>
                <div className="text-xs text-muted-foreground">{connection.providerFamily}</div>
              </button>
            ))}
          </div>
        </GrowthEngineCard>

        {selected ? (
          <div className="flex flex-col gap-6">
            <GrowthEngineCard title={selected.label}>
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge
                  label={selected.health.lifecycleStatus.replaceAll("_", " ")}
                  tone={LIFECYCLE_TONE[selected.health.lifecycleStatus]}
                />
                {selected.health.temporarilyDegraded ? (
                  <GrowthBadge label="Degraded" tone="attention" />
                ) : null}
                {selected.credentialsConfigured ? (
                  <GrowthBadge label="Credentials set" tone="healthy" />
                ) : (
                  <GrowthBadge label="No credentials" tone="neutral" />
                )}
              </div>

              {selected.health.healthReason ? (
                <p className="mt-3 text-sm text-muted-foreground">{selected.health.healthReason}</p>
              ) : null}

              {selected.health.temporarilyDegraded && selected.health.degradedReason ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <div>{selected.health.degradedReason}</div>
                    {selected.health.degradedUntil ? (
                      <div className="text-xs opacity-80">Until {formatDate(selected.health.degradedUntil)}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Seats</dt>
                  <dd className="font-medium">{selected.seatCount ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Monthly cost</dt>
                  <dd className="font-medium">
                    {selected.monthlyCostEstimate != null ? `$${selected.monthlyCostEstimate}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last validation</dt>
                  <dd className="font-medium">{formatDate(selected.health.lastValidationAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last duration</dt>
                  <dd className="font-medium">{formatMs(selected.health.lastValidationDurationMs)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Average duration</dt>
                  <dd className="font-medium">{formatMs(selected.health.averageValidationDurationMs)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Next validation allowed</dt>
                  <dd className="font-medium">{formatDate(selected.health.nextValidationAllowedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Credential rotated</dt>
                  <dd className="font-medium">{formatDate(selected.health.credentialLastRotatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Rotation recommended</dt>
                  <dd className="font-medium">{formatDate(selected.health.credentialRotationRecommendedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Validation failures</dt>
                  <dd className="font-medium">{selected.health.validationFailureCount}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void testConnection()} disabled={actionLoading === "validate"}>
                  {actionLoading === "validate" ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <TestTube2 className="mr-2 size-4" />
                  )}
                  Test Connection
                </Button>
                <Button variant="outline" onClick={() => void reconnectConnection()} disabled={actionLoading === "reconnect"}>
                  <RefreshCw className="mr-2 size-4" />
                  Reconnect
                </Button>
                <Button variant="ghost" onClick={() => void disableConnection()} disabled={actionLoading === "disable"}>
                  <ShieldOff className="mr-2 size-4" />
                  Disable
                </Button>
                <Button
                  variant="ghost"
                  className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  onClick={() => handleDeleteClick()}
                  disabled={actionLoading === "delete"}
                >
                  {actionLoading === "delete" ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 size-4" />
                  )}
                  Delete
                </Button>
              </div>
            </GrowthEngineCard>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Provider Connection</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>This removes the provider connection and provider configuration.</p>
                      <p>No outbound messages are deleted.</p>
                      <p>Provider timeline history remains.</p>
                      <p>Capability history remains.</p>
                      <p className="font-medium text-foreground">This cannot be undone.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={actionLoading === "delete"}>Cancel</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={actionLoading === "delete"}
                    onClick={() => void deleteConnection()}
                  >
                    {actionLoading === "delete" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Delete Connection
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <GrowthEngineCard title="Capabilities">
              <div className="flex flex-wrap gap-2">
                {(Object.entries(selected.health.capabilitySnapshot) as [GrowthProviderCapabilityKey, string][]).map(
                  ([key, status]) => (
                    <span
                      key={key}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${CAPABILITY_TONE[status] ?? CAPABILITY_TONE.unavailable}`}
                    >
                      {GROWTH_PROVIDER_CAPABILITY_LABELS[key]} · {status}
                    </span>
                  ),
                )}
              </div>
            </GrowthEngineCard>

            {selected.providerFamily === "lemlist" ? (
              <GrowthLemlistProviderSettings connection={selected} onUpdated={load} />
            ) : null}

            <GrowthEngineCard title="Credentials (write-only)">
              <p className="mb-3 text-sm text-muted-foreground">
                Credentials are encrypted at rest. API responses never include secret values.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    autoComplete="off"
                    value={credentialApiKey}
                    onChange={(e) => setCredentialApiKey(e.target.value)}
                    placeholder={selected.credentialsConfigured ? "Replace stored key" : "Enter API key"}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="provider-notes">Notes</Label>
                  <Textarea id="provider-notes" value={selected.notes ?? ""} readOnly rows={2} />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={() => void saveCredentials()} disabled={actionLoading === "credentials"}>
                  {actionLoading === "credentials" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Save Credentials
                </Button>
              </div>
            </GrowthEngineCard>

            <GrowthEngineCard title="Platform Timeline">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No platform events yet.</p>
              ) : (
                <ul className="space-y-3">
                  {timeline.map((event) => (
                    <li key={event.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="font-medium">{event.title}</div>
                      {event.summary ? <div className="text-muted-foreground">{event.summary}</div> : null}
                      <div className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          </div>
        ) : (
          <GrowthEngineCard title="No connections">
            <p className="text-sm text-muted-foreground">Create a provider connection to get started.</p>
          </GrowthEngineCard>
        )}
      </div>
    </div>
  )
}
