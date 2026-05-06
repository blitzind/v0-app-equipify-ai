"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type IntegrationRow = {
  id: string
  connection_status: string
  realm_id: string | null
  company_name: string | null
  last_successful_sync_at: string | null
  last_sync_attempt_at: string | null
  sync_health: string
  last_sync_error: string | null
  sync_settings?: { auto_sync_invoices?: boolean } | null
  updated_at: string | null
}

type SyncLogRow = {
  id: string
  sync_kind: string
  direction: string
  status: string
  records_attempted: number
  records_succeeded: number
  error_message: string | null
  detail?: Record<string, unknown> | null
  started_at: string
  completed_at: string | null
}

function lastLogForKind(logs: SyncLogRow[], kind: string): SyncLogRow | undefined {
  return logs.find((l) => l.sync_kind === kind)
}

function syncStatusBadgeClass(status: string): string {
  switch (status) {
    case "synced":
      return "border-[color:var(--status-success)]/50 bg-[color:var(--status-success)]/10 text-emerald-950 dark:text-emerald-100"
    case "pending":
      return "border-border bg-muted text-muted-foreground"
    case "failed":
    case "error":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "stale":
      return "border-amber-500/45 bg-amber-500/10 text-amber-950 dark:text-amber-100"
    default:
      return "border-border bg-card"
  }
}

function QuickBooksIntegrationPageInner() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [oauthEnv, setOauthEnv] = useState(false)
  const [integration, setIntegration] = useState<IntegrationRow | null>(null)
  const [logs, setLogs] = useState<SyncLogRow[]>([])
  const [mappingCounts, setMappingCounts] = useState<Record<string, number>>({})
  const [syncStatusByEntity, setSyncStatusByEntity] = useState<Record<string, Record<string, number>>>({})
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [autoSyncBusy, setAutoSyncBusy] = useState(false)

  const load = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) {
      setIntegration(null)
      setLogs([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/integrations/quickbooks`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as {
        oauthEnvironmentConfigured?: boolean
        integration?: IntegrationRow | null
        recentSyncLogs?: SyncLogRow[]
        mappingCounts?: Record<string, number>
        syncStatusByEntity?: Record<string, Record<string, number>>
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error ?? res.statusText)
      }
      setOauthEnv(Boolean(body.oauthEnvironmentConfigured))
      setIntegration(body.integration ?? null)
      setLogs(body.recentSyncLogs ?? [])
      setMappingCounts(body.mappingCounts ?? {})
      setSyncStatusByEntity(body.syncStatusByEntity ?? {})
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load QuickBooks status",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgStatus, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const connected = searchParams.get("qbo_connected")
    const err = searchParams.get("qbo_error")
    if (connected === "1") {
      toast({ title: "QuickBooks connected", description: "Run a sync when you are ready." })
      window.history.replaceState({}, "", "/settings/integrations/quickbooks")
    }
    if (err) {
      toast({
        variant: "destructive",
        title: "QuickBooks connection failed",
        description: decodeURIComponent(err).slice(0, 280),
      })
      window.history.replaceState({}, "", "/settings/integrations/quickbooks")
    }
  }, [searchParams, toast])

  async function disconnect() {
    if (!organizationId) return
    if (!window.confirm("Disconnect QuickBooks for this workspace? OAuth tokens will be removed.")) return
    setActionBusy("disconnect")
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/integrations/quickbooks`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const j = (await res.json()) as { error?: string }
        throw new Error(j.error ?? res.statusText)
      }
      toast({ title: "Disconnected QuickBooks" })
      await load()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Disconnect failed",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setActionBusy(null)
    }
  }

  async function runExportSync(kind: "customers" | "catalog_items" | "invoices" | "full_initial") {
    if (!organizationId) return
    setActionBusy(`sync:${kind}`)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/integrations/quickbooks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        },
      )
      const j = (await res.json()) as {
        ok?: boolean
        error?: string
        recordsSucceeded?: number
        recordsAttempted?: number
        errorMessage?: string | null
        status?: string
      }
      if (!res.ok) throw new Error(j.error ?? res.statusText)
      const okMsg =
        typeof j.recordsSucceeded === "number" && typeof j.recordsAttempted === "number"
          ? `Synced ${j.recordsSucceeded} of ${j.recordsAttempted} records (${j.status ?? "done"}).`
          : "Sync finished."
      toast({
        title: "QuickBooks export",
        description: j.errorMessage ? `${okMsg} ${j.errorMessage}` : okMsg,
        variant: j.status === "failed" ? "destructive" : "default",
      })
      await load()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setActionBusy(null)
    }
  }

  async function setAutoSyncInvoices(enabled: boolean) {
    if (!organizationId) return
    setAutoSyncBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/integrations/quickbooks`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sync_settings: { auto_sync_invoices: enabled } }),
        },
      )
      const j = (await res.json()) as { error?: string; sync_settings?: { auto_sync_invoices?: boolean } }
      if (!res.ok) throw new Error(j.error ?? res.statusText)
      setIntegration((prev) =>
        prev
          ? {
              ...prev,
              sync_settings: {
                ...(prev.sync_settings ?? {}),
                auto_sync_invoices: j.sync_settings?.auto_sync_invoices ?? enabled,
              },
            }
          : prev,
      )
      toast({
        title: enabled ? "Auto-sync enabled" : "Auto-sync disabled",
        description:
          enabled ? "Saving an invoice will push updates to QuickBooks in the background." : undefined,
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not update settings",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setAutoSyncBusy(false)
    }
  }

  const connected = integration?.connection_status === "connected"
  const autoSyncOn = Boolean(integration?.sync_settings?.auto_sync_invoices)

  const entityLabels: Record<string, string> = {
    customer: "Customers",
    catalog_item: "Catalog",
    invoice: "Invoices",
    payment: "Payments",
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 -ml-2" asChild>
          <Link href="/settings/integrations">
            <ArrowLeft className="w-4 h-4" />
            Integrations
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold"
              style={{ background: "#2ca01c" }}
            >
              QB
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">QuickBooks Online</h1>
              <p className="text-sm text-muted-foreground">
                Export customers, catalog items, and invoices to QuickBooks Online.
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 shrink-0" asChild>
          <a
            href="https://developer.intuit.com/app/developer/qbo/docs/develop"
            target="_blank"
            rel="noopener noreferrer"
          >
            Intuit docs <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      </div>

      {!oauthEnv ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">QuickBooks OAuth is not configured on this server.</p>
            <p className="text-xs mt-1 opacity-90">
              Set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI, and
              INTEGRATION_OAUTH_STATE_SECRET in the deployment environment.
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>
            OAuth uses Intuit&apos;s hosted consent screen. Tokens stay on the server — they are not exposed to the
            browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading status…
            </div>
          ) : orgStatus !== "ready" || !organizationId ? (
            <p className="text-sm text-muted-foreground">Select an organization to manage QuickBooks.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                    connected
                      ? "ds-badge-success border-[color:var(--status-success)]/40"
                      : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {connected ? "Connected" : "Not connected"}
                </span>
                {integration?.realm_id ? (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Realm ID: {integration.realm_id}
                  </span>
                ) : null}
                {integration?.sync_health ? (
                  <span className="text-[11px] text-muted-foreground capitalize">
                    Health: {integration.sync_health}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {!connected && oauthEnv ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={actionBusy !== null}
                    onClick={() => {
                      window.location.href = `/api/integrations/quickbooks/authorize?organizationId=${encodeURIComponent(organizationId)}`
                    }}
                  >
                    <Plug className="w-3.5 h-3.5" />
                    Connect QuickBooks
                  </Button>
                ) : null}
                {connected ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      disabled={actionBusy !== null}
                      onClick={() => void disconnect()}
                    >
                      {actionBusy === "disconnect" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unplug className="w-3.5 h-3.5" />
                      )}
                      Disconnect
                    </Button>
                  </>
                ) : null}
              </div>

              {connected ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border p-3 bg-muted/15">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-sync-invoices" className="text-sm font-medium cursor-pointer">
                      Auto-sync invoices to QuickBooks
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, saving an invoice queues a background export (service role only).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {autoSyncBusy ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
                    <Switch
                      id="auto-sync-invoices"
                      checked={autoSyncOn}
                      disabled={autoSyncBusy || actionBusy !== null}
                      onCheckedChange={(v) => void setAutoSyncInvoices(v)}
                    />
                  </div>
                </div>
              ) : null}

              {integration?.last_sync_error ? (
                <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                  {integration.last_sync_error}
                </p>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border border-border rounded-lg p-3 bg-muted/20">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Last successful sync
                  </p>
                  <p className="font-medium tabular-nums">
                    {integration?.last_successful_sync_at
                      ? new Date(integration.last_successful_sync_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Last sync attempt
                  </p>
                  <p className="font-medium tabular-nums">
                    {integration?.last_sync_attempt_at
                      ? new Date(integration.last_sync_attempt_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {connected && !loading ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Export to QuickBooks</CardTitle>
            <CardDescription>
              Run targeted exports or a full run (customers → catalog → invoices). Partial failures are logged; other
              records still sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={actionBusy !== null}
                onClick={() => void runExportSync("customers")}
              >
                {actionBusy === "sync:customers" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sync customers
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={actionBusy !== null}
                onClick={() => void runExportSync("catalog_items")}
              >
                {actionBusy === "sync:catalog_items" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sync catalog
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={actionBusy !== null}
                onClick={() => void runExportSync("invoices")}
              >
                {actionBusy === "sync:invoices" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sync invoices
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={actionBusy !== null}
                onClick={() => void runExportSync("full_initial")}
              >
                {actionBusy === "sync:full_initial" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Full sync
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs border border-border rounded-lg p-3 bg-muted/10">
              {(
                [
                  ["customers", "Customers"],
                  ["catalog_items", "Catalog"],
                  ["invoices", "Invoices"],
                ] as const
              ).map(([kind, label]) => {
                const last = lastLogForKind(logs, kind)
                return (
                  <div key={kind}>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
                    <p className="font-medium tabular-nums">
                      {last?.completed_at ? new Date(last.completed_at).toLocaleString() : "—"}
                    </p>
                    {last ? (
                      <p className="text-muted-foreground tabular-nums">
                        {last.records_succeeded}/{last.records_attempted} ok · {last.status}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">No run yet</p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mapped records</CardTitle>
          <CardDescription>
            QuickBooks entity IDs stored per Equipify record. Badges reflect last sync state (stale = changed in
            Equipify since the last successful push).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.keys(mappingCounts).length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">No mappings yet — run an export after connecting.</p>
          ) : (
            <ul className="space-y-3">
              {Object.entries(mappingCounts).map(([entityType, total]) => {
                const breakdown = syncStatusByEntity[entityType] ?? {}
                const label = entityLabels[entityType] ?? entityType
                return (
                  <li key={entityType} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">Total mapped: {total}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(breakdown).map(([st, n]) => (
                        <span
                          key={st}
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                            syncStatusBadgeClass(st),
                          )}
                        >
                          {st}: {n}
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent sync activity</CardTitle>
          <CardDescription>Status, record counts, and top errors from each run.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">No sync runs recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => {
                const errs = (log.detail?.errors ?? []) as Array<{ message?: string }>
                const topErr = errs.find((e) => e?.message)?.message
                return (
                  <li
                    key={log.id}
                    className="rounded-lg border border-border px-3 py-2 text-xs flex flex-col gap-1"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium capitalize">{log.sync_kind.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{log.status}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {log.records_succeeded}/{log.records_attempted} records
                      </span>
                      <span className="text-muted-foreground ml-auto tabular-nums">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                      {log.status === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[color:var(--status-success)] shrink-0" />
                      ) : null}
                    </div>
                    {log.error_message ? (
                      <p className="text-destructive">{log.error_message}</p>
                    ) : null}
                    {topErr ? (
                      <p className="text-muted-foreground border-t border-border pt-1 mt-0.5">
                        First row error: {topErr}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function QuickBooksIntegrationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      }
    >
      <QuickBooksIntegrationPageInner />
    </Suspense>
  )
}
