"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, RefreshCw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GrowthAcquisitionRunPauseButton,
} from "@/components/growth/growth-acquisition-runs-dashboard"
import { GrowthManualContactFormDialog } from "@/components/growth/growth-manual-contact-form-dialog"
import type {
  GrowthBulkAcquisitionArtifactView,
  GrowthBulkAcquisitionCompanyArtifact,
  GrowthBulkAcquisitionContactArtifact,
  GrowthBulkAcquisitionLeadArtifact,
  GrowthBulkAcquisitionRun,
  GrowthBulkAcquisitionTickLogEntry,
} from "@/lib/growth/acquisition/acquisition-types"
import { formatProviderOutcomeSummary } from "@/lib/growth/contact-discovery/contact-discovery-provider-outcomes"
import { phaseLabel, statusLabel } from "@/lib/growth/acquisition/acquisition-types"

const ARTIFACT_TABS: Array<{ id: GrowthBulkAcquisitionArtifactView; label: string }> = [
  { id: "companies", label: "Companies" },
  { id: "contacts", label: "Contacts" },
  { id: "verified", label: "Verified emails" },
  { id: "leads", label: "Leads created" },
]

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatMs(value: number): string {
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

export function GrowthAcquisitionRunDetail({ runId }: { runId: string }) {
  const [run, setRun] = useState<GrowthBulkAcquisitionRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [ticking, setTicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [artifactView, setArtifactView] = useState<GrowthBulkAcquisitionArtifactView>("companies")
  const [artifactsLoading, setArtifactsLoading] = useState(false)
  const [companies, setCompanies] = useState<GrowthBulkAcquisitionCompanyArtifact[]>([])
  const [contacts, setContacts] = useState<GrowthBulkAcquisitionContactArtifact[]>([])
  const [verified, setVerified] = useState<GrowthBulkAcquisitionContactArtifact[]>([])
  const [leads, setLeads] = useState<GrowthBulkAcquisitionLeadArtifact[]>([])
  const [manualContactOpen, setManualContactOpen] = useState(false)

  const loadRun = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/acquisition/runs/${runId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        run?: GrowthBulkAcquisitionRun
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.run) {
        throw new Error(data.message ?? data.error ?? "Could not load acquisition run.")
      }
      setRun(data.run)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load acquisition run.")
    } finally {
      setLoading(false)
    }
  }, [runId])

  const loadArtifacts = useCallback(
    async (view: GrowthBulkAcquisitionArtifactView) => {
      setArtifactsLoading(true)
      try {
        const res = await fetch(
          `/api/platform/growth/acquisition/runs/${runId}/artifacts?view=${view}&limit=50`,
          { cache: "no-store" },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          items?: unknown[]
          message?: string
          error?: string
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? data.error ?? "Could not load artifacts.")
        }
        const items = data.items ?? []
        if (view === "companies") setCompanies(items as GrowthBulkAcquisitionCompanyArtifact[])
        if (view === "contacts") setContacts(items as GrowthBulkAcquisitionContactArtifact[])
        if (view === "verified") setVerified(items as GrowthBulkAcquisitionContactArtifact[])
        if (view === "leads") setLeads(items as GrowthBulkAcquisitionLeadArtifact[])
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load artifacts.")
      } finally {
        setArtifactsLoading(false)
      }
    },
    [runId],
  )

  useEffect(() => {
    void loadRun()
  }, [loadRun])

  useEffect(() => {
    void loadArtifacts(artifactView)
  }, [artifactView, loadArtifacts])

  async function handleTick() {
    setTicking(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/acquisition/runs/${runId}/tick`, { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        run?: GrowthBulkAcquisitionRun
        tick_actions?: string[]
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.run) {
        throw new Error(data.message ?? data.error ?? "Tick failed.")
      }
      setRun(data.run)
      await loadArtifacts(artifactView)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tick failed.")
    } finally {
      setTicking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading run…
      </div>
    )
  }

  if (!run) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error ?? "Acquisition run not found."}</p>
        <Button variant="outline" asChild>
          <Link href="/admin/growth/acquisition">
            <ArrowLeft className="mr-2 size-4" />
            Back to runs
          </Link>
        </Button>
      </div>
    )
  }

  const { stats, metrics } = run.state
  const state = run.state
  const geoTile =
    state.geo_tiles[state.geo_tile_index] ??
    state.search_inputs.location ??
    run.location ??
    "—"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/growth/acquisition">
            <ArrowLeft className="mr-2 size-4" />
            All runs
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setManualContactOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add contact manually
          </Button>
          <GrowthAcquisitionRunPauseButton run={run} onUpdated={setRun} />
          <Button variant="outline" onClick={() => void loadRun()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
          <Button onClick={() => void handleTick()} disabled={ticking || run.state.paused || run.state.phase === "done"}>
            {ticking ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
            Run tick
          </Button>
        </div>
      </div>

      <GrowthEngineCard title={run.query}>
        <div className="flex flex-wrap items-center gap-2">
          {run.state.paused ? <GrowthBadge tone="stalled">Paused</GrowthBadge> : null}
          <GrowthBadge tone="medium">{statusLabel(run.status)}</GrowthBadge>
          <GrowthBadge tone="high">{phaseLabel(run.state.phase)}</GrowthBadge>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>Industry: {run.industry ?? "—"}</p>
          <p>Location: {run.location ?? "—"}</p>
          <p>Current geo tile: {geoTile}</p>
          <p>Geo progress: {state.geo_tile_index + 1} / {Math.max(state.geo_tiles.length, 1)}</p>
          <p>Target companies: {state.target_company_count ?? "None"}</p>
          <p>Last tick: {formatWhen(state.last_tick_at)}</p>
          <p>Child discovery runs: {state.child_run_ids.length}</p>
          <p>Queries executed: {state.executed_query_keys.length}</p>
        </div>
        {state.last_error ? (
          <div className="mt-3 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <p>Last error: {state.last_error}</p>
            {state.last_error_diagnostics ? (
              <p className="text-xs text-destructive/90">
                Action: {state.last_error_diagnostics.action ?? "—"}
                {state.last_error_diagnostics.companyId
                  ? ` · Company: ${state.last_error_diagnostics.companyId}`
                  : ""}
                {state.last_error_diagnostics.contactId
                  ? ` · Contact: ${state.last_error_diagnostics.contactId}`
                  : ""}
              </p>
            ) : null}
            {state.last_error_stack ? (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-destructive/20 bg-background/80 p-2 text-xs text-foreground">
                {state.last_error_stack}
              </pre>
            ) : null}
          </div>
        ) : null}
      </GrowthEngineCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Companies discovered" value={stats.companies_discovered} />
        <StatTile label="Companies processed" value={stats.companies_contacts_processed} />
        <StatTile label="Contacts discovered" value={metrics.contacts_discovered} />
        <StatTile label="Emails verified" value={metrics.emails_verified} />
        <StatTile label="Leads created" value={stats.leads_created} />
        <StatTile label="Duplicates linked" value={stats.leads_linked_duplicate} />
        <StatTile label="Verification failures" value={metrics.verification_failures} />
        <StatTile label="Provider errors" value={metrics.provider_errors} />
      </div>

      <GrowthEngineCard title="Throughput metrics">
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <span>Ticks completed: {metrics.ticks_completed}</span>
          <span>Last tick duration: {formatMs(metrics.last_tick_duration_ms)}</span>
          <span>Total tick time: {formatMs(metrics.total_tick_duration_ms)}</span>
          <span>Emails attempted: {metrics.emails_verification_attempted}</span>
          <span>Contacts synced: {stats.company_contacts_synced}</span>
          <span>Leads suppressed: {stats.leads_suppressed}</span>
          <span>Leads skipped: {stats.leads_skipped}</span>
          <span>Lead errors: {stats.leads_error}</span>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Recent tick activity">
        {state.recent_ticks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ticks recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {state.recent_ticks.map((entry: GrowthBulkAcquisitionTickLogEntry) => (
              <div key={`${entry.at}-${entry.phase}`} className="rounded-md border border-border/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{formatWhen(entry.at)}</span>
                  <span>{phaseLabel(entry.phase)} · {formatMs(entry.duration_ms)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">
                  {entry.actions.length > 0 ? entry.actions.join(" · ") : "No actions recorded"}
                </p>
                {entry.error_stack ? (
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                    {entry.error_action ? `${entry.error_action}\n` : ""}
                    {entry.error_stack}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <GrowthEngineCard title="Run artifacts">
        <div className="mb-4 flex flex-wrap gap-2">
          {ARTIFACT_TABS.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant={artifactView === tab.id ? "default" : "outline"}
              onClick={() => setArtifactView(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {artifactsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading {artifactView}…
          </div>
        ) : artifactView === "companies" ? (
          <CompaniesArtifactTable companies={companies} />
        ) : artifactView === "contacts" ? (
          <ArtifactTable
            empty="No contacts discovered yet."
            rows={contacts.map((row) => ({
              key: row.id,
              primary: row.full_name || row.email || "Unknown contact",
              secondary: `${row.company_name}${row.title ? ` · ${row.title}` : ""}`,
              meta: row.email ? `${row.email} (${row.email_status})` : "No email",
            }))}
          />
        ) : artifactView === "verified" ? (
          <ArtifactTable
            empty="No verified emails yet."
            rows={verified.map((row) => ({
              key: row.id,
              primary: row.email ?? row.full_name,
              secondary: row.company_name,
              meta: row.verified_by_provider ? "Provider verified" : "Verified",
            }))}
          />
        ) : (
          <ArtifactTable
            empty="No leads promoted yet."
            rows={leads.map((row) => ({
              key: row.lead_id,
              primary: row.full_name || row.email || "Lead",
              secondary: row.company_name,
              meta: row.email ?? "—",
              leadHref: `/admin/growth/leads/${row.lead_id}`,
            }))}
          />
        )}
      </GrowthEngineCard>

      <GrowthManualContactFormDialog
        open={manualContactOpen}
        onOpenChange={setManualContactOpen}
        acquisitionRunId={runId}
        onSuccess={() => {
          void loadArtifacts("leads")
        }}
      />
    </div>
  )
}

function CompaniesArtifactTable({
  companies,
}: {
  companies: GrowthBulkAcquisitionCompanyArtifact[]
}) {
  if (companies.length === 0) {
    return <p className="text-sm text-muted-foreground">No companies discovered yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-2">Company</th>
            <th className="px-2 py-2">Location</th>
            <th className="px-2 py-2">Contact discovery</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((row) => (
            <tr key={row.id} className="border-b border-border/40 align-top">
              <td className="px-2 py-2 font-medium text-foreground">
                {row.website ? (
                  <a href={row.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {row.company_name}
                  </a>
                ) : (
                  row.company_name
                )}
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {row.contacts_processed
                    ? `Processed ${formatWhen(row.contacts_processed_at)}`
                    : "Pending contact discovery"}
                </p>
              </td>
              <td className="px-2 py-2 text-muted-foreground">
                {[row.city, row.state].filter(Boolean).join(", ") || row.location || "—"}
              </td>
              <td className="px-2 py-2 text-muted-foreground">
                {!row.contacts_processed ? (
                  "—"
                ) : row.provider_outcomes.length > 0 ? (
                  <ul className="space-y-1">
                    {row.provider_outcomes.map((outcome) => (
                      <li key={`${row.id}-${outcome.provider}`} className="text-xs text-foreground">
                        {formatProviderOutcomeSummary(outcome)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs">Processed — no provider outcome recorded</span>
                )}
                {row.contact_discovery_persistence_error ? (
                  <p className="mt-1 text-xs text-destructive">
                    Persistence: {row.contact_discovery_persistence_error}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ArtifactTable({
  rows,
  empty,
}: {
  empty: string
  rows: Array<{
    key: string
    primary: string
    secondary: string
    meta: string
    href?: string
    leadHref?: string
  }>
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-2">Name</th>
            <th className="px-2 py-2">Company / context</th>
            <th className="px-2 py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/40">
              <td className="px-2 py-2 font-medium text-foreground">
                {row.leadHref ? (
                  <Link href={row.leadHref} className="text-primary hover:underline">
                    {row.primary}
                  </Link>
                ) : row.href ? (
                  <a href={row.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {row.primary}
                  </a>
                ) : (
                  row.primary
                )}
              </td>
              <td className="px-2 py-2 text-muted-foreground">{row.secondary}</td>
              <td className="px-2 py-2 text-muted-foreground">{row.meta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
