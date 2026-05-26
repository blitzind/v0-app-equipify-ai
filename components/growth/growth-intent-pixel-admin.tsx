"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  Check,
  Copy,
  Loader2,
  Radar,
  RefreshCw,
  Save,
  Shield,
  Plus,
  Inbox,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
  GROWTH_INTENT_PIXEL_LIVE_QA_MARKER,
  GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
  GROWTH_INTENT_PIXEL_TRACKING_MODES,
  type GrowthIntentPixelAdminDiagnostics,
  type GrowthIntentPixelAdminSite,
  type GrowthIntentPixelAdminStreamEvent,
  type GrowthIntentPixelProcessRecentResult,
  type GrowthIntentPixelTrackingMode,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import {
  buildIntentPixelScriptSnippet,
  trackingModeLabel,
} from "@/lib/growth/intent-pixel/intent-pixel-site-config"
import { GROWTH_INTENT_PIXEL_PRIVACY_NOTE } from "@/lib/growth/intent-pixel/pii-policy"
import { GrowthLiveVisitorMonitor } from "@/components/growth/intent-pixel-monitor/growth-live-visitor-monitor"
import { cn } from "@/lib/utils"

const INSTALL_STATUS_LABELS = {
  schema_missing: "Schema not applied",
  offline: "Tracking disabled",
  idle: "Installed — no events (24h)",
  receiving: "Receiving events",
} as const

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function GrowthIntentPixelAdmin() {
  const [sites, setSites] = useState<GrowthIntentPixelAdminSite[]>([])
  const [selectedKey, setSelectedKey] = useState<string>("equipify-sandbox")
  const [diagnostics, setDiagnostics] = useState<GrowthIntentPixelAdminDiagnostics | null>(null)
  const [events, setEvents] = useState<GrowthIntentPixelAdminStreamEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null)
  const [processingIntent, setProcessingIntent] = useState(false)
  const [lastHandoff, setLastHandoff] = useState<GrowthIntentPixelProcessRecentResult | null>(null)

  const [siteName, setSiteName] = useState("")
  const [domainsText, setDomainsText] = useState("")
  const [trackingMode, setTrackingMode] = useState<GrowthIntentPixelTrackingMode>("consent_gated")
  const [newSiteKey, setNewSiteKey] = useState("")

  const selected = useMemo(
    () => sites.find((s) => s.site_key === selectedKey) ?? null,
    [sites, selectedKey],
  )

  const scriptSnippet = useMemo(() => {
    if (selected?.script_snippet) return selected.script_snippet
    if (typeof window !== "undefined" && selectedKey) {
      return buildIntentPixelScriptSnippet(window.location.origin, selectedKey).script_snippet
    }
    return ""
  }, [selected, selectedKey])

  const loadAll = useCallback(async (siteKey: string) => {
    setLoading(true)
    try {
      const [sitesRes, diagRes, eventsRes] = await Promise.all([
        fetch("/api/platform/growth/intent-pixel/sites", { cache: "no-store" }),
        fetch(
          `/api/platform/growth/intent-pixel/diagnostics?site_key=${encodeURIComponent(siteKey)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/platform/growth/intent-pixel/events/recent?site_key=${encodeURIComponent(siteKey)}&limit=50`,
          { cache: "no-store" },
        ),
      ])

      const sitesData = (await sitesRes.json().catch(() => ({}))) as {
        ok?: boolean
        schema_ready?: boolean
        sites?: GrowthIntentPixelAdminSite[]
      }
      if (sitesRes.ok && sitesData.ok) {
        if (typeof sitesData.schema_ready === "boolean") setSchemaReady(sitesData.schema_ready)
        setSites(sitesData.sites ?? [])
        if ((sitesData.sites ?? []).length > 0 && !sitesData.sites?.some((s) => s.site_key === siteKey)) {
          setSelectedKey(sitesData.sites![0]!.site_key)
        }
      }

      const diagData = (await diagRes.json().catch(() => ({}))) as {
        ok?: boolean
        diagnostics?: GrowthIntentPixelAdminDiagnostics
      }
      if (diagRes.ok && diagData.ok) setDiagnostics(diagData.diagnostics ?? null)

      const eventsData = (await eventsRes.json().catch(() => ({}))) as {
        ok?: boolean
        stream?: { events?: GrowthIntentPixelAdminStreamEvent[] }
      }
      if (eventsRes.ok && eventsData.ok) setEvents(eventsData.stream?.events ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll(selectedKey)
  }, [selectedKey, loadAll])

  useEffect(() => {
    if (!schemaReady) return
    const timer = window.setInterval(() => {
      void loadAll(selectedKey)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [schemaReady, selectedKey, loadAll])

  useEffect(() => {
    if (!selected) return
    setSiteName(selected.site_name)
    setDomainsText(selected.domain_allowlist.join("\n"))
    setTrackingMode(selected.tracking_mode)
  }, [selected])

  async function saveSite() {
    if (!selected) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/platform/growth/intent-pixel/sites/${encodeURIComponent(selected.site_key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_name: siteName,
            domain_allowlist: domainsText.split(/[\n,]+/).map((d) => d.trim()).filter(Boolean),
            tracking_mode: trackingMode,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        setMessage(data.message ?? "Could not save site.")
        return
      }
      setMessage("Site settings saved.")
      await loadAll(selected.site_key)
    } finally {
      setSaving(false)
    }
  }

  async function createSite() {
    const key = newSiteKey.trim().toLowerCase()
    if (!key) {
      setMessage("Enter a site key for the new site.")
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/intent-pixel/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_key: key,
          site_name: siteName || key,
          domain_allowlist: domainsText.split(/[\n,]+/).map((d) => d.trim()).filter(Boolean),
          tracking_mode: trackingMode,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; site?: GrowthIntentPixelAdminSite }
      if (!res.ok || !data.ok) {
        setMessage(data.message ?? "Could not create site.")
        return
      }
      setMessage("Site created.")
      setNewSiteKey("")
      if (data.site) setSelectedKey(data.site.site_key)
      await loadAll(data.site?.site_key ?? key)
    } finally {
      setSaving(false)
    }
  }

  async function copySnippet() {
    if (!scriptSnippet) return
    await navigator.clipboard.writeText(scriptSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function processRecentIntent() {
    setProcessingIntent(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/intent-pixel/process-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_key: selectedKey, limit: 25 }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: GrowthIntentPixelProcessRecentResult
        message?: string
      }
      if (!res.ok || !data.result) {
        setMessage(data.message ?? "Could not process recent intent.")
        return
      }
      setLastHandoff(data.result)
      setMessage(
        `Processed ${data.result.bridged_count} session(s): ${data.result.ingested_count} added to Lead Inbox, ${data.result.duplicate_count} duplicate(s), ${data.result.skipped_count} skipped.`,
      )
      await loadAll(selectedKey)
    } finally {
      setProcessingIntent(false)
    }
  }

  const schemaReadyResolved = diagnostics?.schema_ready ?? schemaReady ?? false
  const installLabel = diagnostics
    ? INSTALL_STATUS_LABELS[diagnostics.install_status]
    : "—"

  return (
    <div className="flex flex-col gap-6">
      <p className="font-mono text-xs text-muted-foreground">
        {GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER} · {GROWTH_INTENT_PIXEL_LIVE_QA_MARKER}
      </p>

      <section
        className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          schemaReadyResolved
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900",
        )}
      >
        <p className="font-semibold">
          Schema: {schemaReadyResolved ? "Ready" : "Not applied"}
        </p>
        {!schemaReadyResolved ? (
          <p className="mt-1 font-mono text-xs">
            Apply migration {GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION} in Supabase before sites, events, or Lead Inbox handoff will work.
          </p>
        ) : (
          <p className="mt-1 text-xs">
            Intent Pixel tables are available. Install the snippet on an allowed domain and use consent modes as configured.
          </p>
        )}
      </section>

      {message ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <GrowthLiveVisitorMonitor siteKey={selectedKey} schemaReady={schemaReadyResolved} />

      {/* Site setup */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Radar className="size-5 text-violet-600" />
            <h2 className="text-lg font-semibold">Site setup</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              {sites.length === 0 ? (
                <option value={selectedKey}>{selectedKey}</option>
              ) : (
                sites.map((s) => (
                  <option key={s.site_key} value={s.site_key}>
                    {s.site_key}
                  </option>
                ))
              )}
            </select>
            <Button variant="outline" size="sm" onClick={() => void loadAll(selectedKey)} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="intent-site-name">Site name</Label>
              <Input
                id="intent-site-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="intent-domains">Allowed domains (one per line)</Label>
              <textarea
                id="intent-domains"
                className="mt-1 flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="intent-tracking-mode">Tracking mode</Label>
              <select
                id="intent-tracking-mode"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={trackingMode}
                onChange={(e) => setTrackingMode(e.target.value as GrowthIntentPixelTrackingMode)}
              >
                {GROWTH_INTENT_PIXEL_TRACKING_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {trackingModeLabel(mode)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveSite()} disabled={saving || !selected}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Save site
              </Button>
            </div>
            <div className="rounded-lg border border-dashed border-border p-3">
              <Label htmlFor="intent-new-site-key">Create new site</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="intent-new-site-key"
                  placeholder="my-site-key"
                  value={newSiteKey}
                  onChange={(e) => setNewSiteKey(e.target.value)}
                  className="font-mono"
                />
                <Button variant="secondary" onClick={() => void createSite()} disabled={saving}>
                  <Plus className="mr-1 size-4" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Site key</p>
              <p className="font-mono text-sm">{selected?.site_key ?? selectedKey}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Install status</p>
              <Badge variant={diagnostics?.install_status === "receiving" ? "default" : "secondary"}>
                {installLabel}
              </Badge>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Script install snippet</p>
              <pre className="max-h-28 overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs">
                {scriptSnippet || "Select or create a site to view the install snippet."}
              </pre>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void copySnippet()} disabled={!scriptSnippet}>
                {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
                {copied ? "Copied" : "Copy script"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Live diagnostics */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Activity className="size-5 text-sky-600" />
          <h2 className="text-lg font-semibold">Live diagnostics (24h)</h2>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Sessions" value={diagnostics?.session_count_24h ?? "—"} />
          <StatCard label="Pageviews" value={diagnostics?.pageview_count_24h ?? "—"} />
          <StatCard label="Conversions" value={diagnostics?.conversion_count_24h ?? "—"} />
          <StatCard label="Identified contacts" value={diagnostics?.identified_contact_count_24h ?? "—"} />
          <StatCard label="Consent denied sessions" value={diagnostics?.consent_denied_sessions_24h ?? "—"} />
          <StatCard label="Consent unknown sessions" value={diagnostics?.consent_unknown_sessions_24h ?? "—"} />
          <StatCard label="Consent granted sessions" value={diagnostics?.consent_granted_sessions_24h ?? "—"} />
          <StatCard
            label="Last event"
            value={
              diagnostics?.last_event_at
                ? new Date(diagnostics.last_event_at).toLocaleString()
                : "None"
            }
          />
        </div>
        {schemaReadyResolved ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            <Button
              size="sm"
              onClick={() => void processRecentIntent()}
              disabled={processingIntent || !schemaReadyResolved}
            >
              {processingIntent ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Inbox className="mr-2 size-4" />
              )}
              Process recent intent
            </Button>
            <p className="text-xs text-muted-foreground">
              Runs Intent → Lead Bridge on recent sessions and creates Lead Inbox rows when eligible. Does not auto-run Lead Engine or send outreach.
            </p>
            {lastHandoff && lastHandoff.inbox_ids.length > 0 ? (
              <p className="w-full text-xs text-muted-foreground">
                Latest handoff: {lastHandoff.ingested_count} inbox row(s). Review at{" "}
                <a href="/admin/growth/leads" className="font-medium text-violet-700 underline">
                  Lead Inbox
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : (
          <p className="border-t border-border px-5 py-3 text-sm text-amber-700">
            Apply migration {GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION} before events will persist.
          </p>
        )}
      </section>

      {/* Event stream */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Event stream</h2>
          <p className="text-sm text-muted-foreground">
            Recent pageviews and conversions. Visitor keys only — no name, email, phone, or LinkedIn in this view.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Visitor</th>
                <th className="px-4 py-2">Path / conversion</th>
                <th className="px-4 py-2">Referrer</th>
                <th className="px-4 py-2">UTM</th>
                <th className="px-4 py-2">Consent</th>
                <th className="px-4 py-2">Visitor type</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No recent events for this site."}
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={`${ev.kind}-${ev.id}`} className="border-b border-border/60">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {new Date(ev.captured_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{ev.kind}</Badge>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-2 font-mono text-xs" title={ev.visitor_key}>
                      {ev.visitor_key.slice(0, 12)}…
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2" title={ev.page_path || ev.page_url}>
                      {ev.kind === "conversion"
                        ? `${ev.conversion_type ?? "custom"}${ev.conversion_label ? `: ${ev.conversion_label}` : ""}`
                        : ev.page_path || ev.page_url}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-2 text-xs text-muted-foreground">
                      {ev.referrer ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {[ev.utm_source, ev.utm_medium, ev.utm_campaign].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs",
                          ev.tracking_mode === "full"
                            ? "bg-emerald-100 text-emerald-800"
                            : ev.tracking_mode === "essential_only"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-slate-100 text-slate-700",
                        )}
                      >
                        {ev.consent_status} · {ev.tracking_mode}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={ev.visitor_type === "identified" ? "default" : "secondary"}>
                        {ev.visitor_type}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Privacy guardrails */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Shield className="size-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Privacy guardrails</h2>
        </div>
        <ul className="list-disc space-y-2 px-8 py-5 text-sm text-muted-foreground">
          <li>Anonymous visitors are never shown with name, email, phone, or LinkedIn in admin diagnostics or the event stream.</li>
          <li>PII is stored only when submitted through explicit capture sources: form, booking, chat, login, or lead capture.</li>
          <li>Third-party enrichment is not enabled. The enrichment capture source is reserved for future compliant sources.</li>
          <li>No outbound actions or Lead Engine auto-run from intent pixel events.</li>
        </ul>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{GROWTH_INTENT_PIXEL_PRIVACY_NOTE}</p>
      </section>
    </div>
  )
}
