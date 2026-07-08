"use client"

import {
  Activity,
  Check,
  Copy,
  Loader2,
  Plus,
  Radar,
  RefreshCw,
  Save,
  Shield,
} from "lucide-react"
import { InstallVerificationCard } from "@/components/growth/intent-pixel-monitor/install-verification-card"
import { GROWTH_INTENT_SIGNALS_SETUP_DRAWER_QA_MARKER } from "@/components/growth/intent-signals/intent-signals-ux-constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  GROWTH_INTENT_CONSENT_CATEGORIES_QA_MARKER,
  GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER,
  GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
  GROWTH_INTENT_PIXEL_TRACKING_MODES,
  type GrowthIntentPixelAdminDiagnostics,
  type GrowthIntentPixelAdminSite,
  type GrowthIntentPixelAdminStreamEvent,
  type GrowthIntentPixelTrackingMode,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import type { GrowthIntentPixelInstallVerification } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
import { trackingModeLabel } from "@/lib/growth/intent-pixel/intent-pixel-site-config"
import { GROWTH_INTENT_PIXEL_PRIVACY_NOTE } from "@/lib/growth/intent-pixel/pii-policy"
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

function ConsentBreakdownChart({
  breakdown,
}: {
  breakdown: GrowthIntentPixelAdminDiagnostics["consent_breakdown"]
}) {
  const total = breakdown.granted + breakdown.denied + breakdown.unknown
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No consent-resolved sessions in the last 24 hours.</p>
  }

  const segments = [
    { key: "Granted", value: breakdown.granted, className: "bg-emerald-500" },
    { key: "Denied", value: breakdown.denied, className: "bg-rose-500" },
    { key: "Unknown", value: breakdown.unknown, className: "bg-amber-400" },
  ]

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.key}
              className={cn(segment.className, "h-full")}
              style={{ width: `${(segment.value / total) * 100}%` }}
              title={`${segment.key}: ${segment.value}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", segment.className)} />
            <span>
              {segment.key}: <span className="font-medium tabular-nums">{segment.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function IntentSignalsSetupDrawer({
  open,
  onOpenChange,
  sites,
  selectedKey,
  onSelectedKeyChange,
  selected,
  siteName,
  onSiteNameChange,
  domainsText,
  onDomainsTextChange,
  trackingMode,
  onTrackingModeChange,
  newSiteKey,
  onNewSiteKeyChange,
  scriptSnippet,
  diagnostics,
  events,
  installVerification,
  schemaReadyResolved,
  loading,
  saving,
  copied,
  message,
  onRefresh,
  onSaveSite,
  onCreateSite,
  onCopySnippet,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sites: GrowthIntentPixelAdminSite[]
  selectedKey: string
  onSelectedKeyChange: (key: string) => void
  selected: GrowthIntentPixelAdminSite | null
  siteName: string
  onSiteNameChange: (value: string) => void
  domainsText: string
  onDomainsTextChange: (value: string) => void
  trackingMode: GrowthIntentPixelTrackingMode
  onTrackingModeChange: (mode: GrowthIntentPixelTrackingMode) => void
  newSiteKey: string
  onNewSiteKeyChange: (value: string) => void
  scriptSnippet: string
  diagnostics: GrowthIntentPixelAdminDiagnostics | null
  events: GrowthIntentPixelAdminStreamEvent[]
  installVerification: GrowthIntentPixelInstallVerification | null
  schemaReadyResolved: boolean
  loading: boolean
  saving: boolean
  copied: boolean
  message: string | null
  onRefresh: () => void
  onSaveSite: () => void
  onCreateSite: () => void
  onCopySnippet: () => void
}) {
  const installLabel = diagnostics
    ? INSTALL_STATUS_LABELS[diagnostics.install_status]
    : "—"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-lg"
        data-qa-marker={GROWTH_INTENT_SIGNALS_SETUP_DRAWER_QA_MARKER}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Radar className="size-4 text-violet-600" />
            Set up intent tracking
          </SheetTitle>
          <SheetDescription>
            Install the Intent Pixel, configure tracking rules, and review setup status.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          <section
            className={cn(
              "rounded-xl border px-5 py-4 text-sm",
              schemaReadyResolved
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <p className="font-semibold">Schema: {schemaReadyResolved ? "Ready" : "Not applied"}</p>
            {!schemaReadyResolved ? (
              <p className="mt-1 font-mono text-xs">
                Apply migration {GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION} in Supabase before sites, events, or Lead
                Inbox handoff will work.
              </p>
            ) : (
              <p className="mt-1 text-xs">
                Intent Pixel tables are available. Install the snippet on an allowed domain and use consent modes
                as configured.
              </p>
            )}
          </section>

          {message ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
          ) : null}

          <InstallVerificationCard verification={installVerification} />

          <section className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Site setup</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedKey}
                  onChange={(e) => onSelectedKeyChange(e.target.value)}
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
                <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <Label htmlFor="intent-site-name">Site name</Label>
                <Input
                  id="intent-site-name"
                  value={siteName}
                  onChange={(e) => onSiteNameChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="intent-domains">Allowed domains (one per line)</Label>
                <textarea
                  id="intent-domains"
                  className="mt-1 flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                  value={domainsText}
                  onChange={(e) => onDomainsTextChange(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="intent-tracking-mode">Tracking mode</Label>
                <select
                  id="intent-tracking-mode"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={trackingMode}
                  onChange={(e) => onTrackingModeChange(e.target.value as GrowthIntentPixelTrackingMode)}
                >
                  {GROWTH_INTENT_PIXEL_TRACKING_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {trackingModeLabel(mode)}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={onSaveSite} disabled={saving || !selected} className="w-full sm:w-auto">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Save site
              </Button>
              <div className="rounded-lg border border-dashed border-border p-3">
                <Label htmlFor="intent-new-site-key">Create new site</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="intent-new-site-key"
                    placeholder="my-site-key"
                    value={newSiteKey}
                    onChange={(e) => onNewSiteKeyChange(e.target.value)}
                    className="font-mono"
                  />
                  <Button variant="secondary" onClick={onCreateSite} disabled={saving}>
                    <Plus className="mr-1 size-4" />
                    Add
                  </Button>
                </div>
              </div>

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
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={onCopySnippet}
                  disabled={!scriptSnippet}
                >
                  {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
                  {copied ? "Copied" : "Copy script"}
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Activity className="size-4 text-sky-600" />
              <h3 className="text-sm font-semibold">Live diagnostics (24h)</h3>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
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
                  diagnostics?.last_event_at ? new Date(diagnostics.last_event_at).toLocaleString() : "None"
                }
              />
            </div>

            <div
              className="space-y-4 border-t border-border px-4 py-4"
              data-qa-marker={GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER}
            >
              <div>
                <h4 className="text-sm font-semibold">Consent &amp; tracking visibility</h4>
                <p className="text-xs text-muted-foreground">
                  First-party consent manager metrics — anonymous behavioral tracking blocked when denied or unknown.
                </p>
              </div>
              {diagnostics?.tracking_visibility_impacted ? (
                <Badge variant="destructive" className="shrink-0">
                  Tracking visibility impacted
                </Badge>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Consent acceptance %"
                  value={
                    diagnostics?.consent_acceptance_pct != null
                      ? `${diagnostics.consent_acceptance_pct}%`
                      : "—"
                  }
                />
                <StatCard
                  label="Tracking coverage %"
                  value={
                    diagnostics?.tracking_coverage_pct != null
                      ? `${diagnostics.tracking_coverage_pct}%`
                      : "—"
                  }
                />
                <StatCard
                  label="Anonymous sessions blocked"
                  value={diagnostics?.anonymous_sessions_blocked_24h ?? "—"}
                />
                <StatCard
                  label="High intent blocked by consent"
                  value={diagnostics?.high_intent_sessions_blocked_by_consent_24h ?? "—"}
                />
              </div>
              {diagnostics?.consent_breakdown ? (
                <ConsentBreakdownChart breakdown={diagnostics.consent_breakdown} />
              ) : null}
              <div
                className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
                data-qa-marker={GROWTH_INTENT_CONSENT_CATEGORIES_QA_MARKER}
              >
                <StatCard
                  label="Personalization coverage %"
                  value={
                    diagnostics?.personalization_coverage_pct != null
                      ? `${diagnostics.personalization_coverage_pct}%`
                      : "—"
                  }
                />
                <StatCard
                  label="Marketing attribution coverage %"
                  value={
                    diagnostics?.marketing_attribution_coverage_pct != null
                      ? `${diagnostics.marketing_attribution_coverage_pct}%`
                      : "—"
                  }
                />
                <StatCard
                  label="Segmented visitors %"
                  value={
                    diagnostics?.segmented_visitors_pct != null
                      ? `${diagnostics.segmented_visitors_pct}%`
                      : "—"
                  }
                />
                <StatCard
                  label="Campaign-attributed sessions %"
                  value={
                    diagnostics?.campaign_attributed_sessions_pct != null
                      ? `${diagnostics.campaign_attributed_sessions_pct}%`
                      : "—"
                  }
                />
              </div>
            </div>
            {!schemaReadyResolved ? (
              <p className="border-t border-border px-4 py-3 text-sm text-amber-700">
                Apply migration {GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION} before events will persist.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Event stream</h3>
              <p className="text-xs text-muted-foreground">
                Recent pageviews and conversions. Visitor keys only — no name, email, phone, or LinkedIn in this view.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">Visitor</th>
                    <th className="px-3 py-2">Path</th>
                    <th className="px-3 py-2">Consent</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        {loading ? "Loading…" : "No recent events for this site."}
                      </td>
                    </tr>
                  ) : (
                    events.map((ev) => (
                      <tr key={`${ev.kind}-${ev.id}`} className="border-b border-border/60">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                          {new Date(ev.captured_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{ev.kind}</Badge>
                        </td>
                        <td className="max-w-[100px] truncate px-3 py-2 font-mono text-xs" title={ev.visitor_key}>
                          {ev.visitor_key.slice(0, 12)}…
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 text-xs" title={ev.page_path || ev.page_url}>
                          {ev.kind === "conversion"
                            ? `${ev.conversion_type ?? "custom"}${ev.conversion_label ? `: ${ev.conversion_label}` : ""}`
                            : ev.page_path || ev.page_url}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {ev.consent_status} · {ev.tracking_mode}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Shield className="size-4 text-emerald-600" />
              <h3 className="text-sm font-semibold">Privacy guardrails</h3>
            </div>
            <ul className="list-disc space-y-2 px-7 py-4 text-sm text-muted-foreground">
              <li>
                Anonymous visitors are never shown with name, email, phone, or LinkedIn in admin diagnostics or the
                event stream.
              </li>
              <li>
                PII is stored only when submitted through explicit capture sources: form, booking, chat, login, or
                lead capture.
              </li>
              <li>
                Third-party enrichment is not enabled. The enrichment capture source is reserved for future compliant
                sources.
              </li>
              <li>No outbound actions or Lead Engine auto-run from intent pixel events.</li>
            </ul>
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              {GROWTH_INTENT_PIXEL_PRIVACY_NOTE}
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
