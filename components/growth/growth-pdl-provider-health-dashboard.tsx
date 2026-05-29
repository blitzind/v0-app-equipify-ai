"use client"

import { useCallback, useEffect, useState } from "react"
import { FlaskConical, Loader2, RefreshCw, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthPdlProviderHealthSnapshot,
  GrowthPdlTestLookupResult,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-health-types"
import { GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER } from "@/lib/growth/contact-discovery/contact-discovery-provider-health-types"

function uptimeTone(state: string): "healthy" | "attention" | "blocked" | "neutral" {
  if (state === "available") return "healthy"
  if (state === "disabled") return "blocked"
  return "attention"
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function GrowthPdlProviderHealthDashboard() {
  const [snapshot, setSnapshot] = useState<GrowthPdlProviderHealthSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [domain, setDomain] = useState("")
  const [testResult, setTestResult] = useState<GrowthPdlTestLookupResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/contact-discovery/provider-health", {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: GrowthPdlProviderHealthSnapshot
      }
      if (json.ok && json.snapshot) setSnapshot(json.snapshot)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      setBusy(action)
      setActionMessage(null)
      try {
        const res = await fetch("/api/platform/growth/contact-discovery/provider-health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        })
        const json = (await res.json()) as {
          ok?: boolean
          message?: string
          snapshot?: GrowthPdlProviderHealthSnapshot
          result?: GrowthPdlTestLookupResult
        }
        setActionMessage(json.message ?? json.result?.message ?? (json.ok ? "Done." : "Action failed."))
        if (json.snapshot) setSnapshot(json.snapshot)
        if (json.result) setTestResult(json.result)
        else if (action !== "test_pdl_lookup") await load()
      } finally {
        setBusy(null)
      }
    },
    [load],
  )

  if (loading && !snapshot) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading PDL provider health…
      </div>
    )
  }

  return (
    <div className="space-y-4" data-qa-marker={GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER}>
      {actionMessage ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{actionMessage}</p>
      ) : null}

      <GrowthEngineCard title="Contact Discovery — People Data Labs" icon={<Users className="size-4" />}>
        <div className="rounded-lg border border-border/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{snapshot?.provider_name ?? "people_data_labs"}</p>
              <p className="text-xs text-muted-foreground">
                Acquisition provider only — internal discovery runs first; Equipify ranking applies after merge.
              </p>
            </div>
            {snapshot ? (
              <GrowthBadge tone={uptimeTone(snapshot.uptime_state)}>{snapshot.uptime_state}</GrowthBadge>
            ) : null}
          </div>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="PDL env health">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="API key configured"
            value={snapshot?.env_health.api_key_configured ? "yes" : "no"}
          />
          <StatTile
            label="Endpoint mode"
            value={snapshot?.env_health.api_endpoint_mode ?? "—"}
          />
          <StatTile
            label="Sandbox mode"
            value={snapshot?.env_health.sandbox_mode ? "enabled" : "disabled"}
          />
          <StatTile
            label="Kill switch"
            value={snapshot?.env_health.env_disabled ? "disabled" : "off"}
          />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Last request">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Last request" value={formatTimestamp(snapshot?.runtime.last_request_at)} />
          <StatTile label="Last status" value={snapshot?.runtime.last_status ?? "—"} />
          <StatTile
            label="Latency"
            value={
              snapshot?.runtime.last_latency_ms != null
                ? `${snapshot.runtime.last_latency_ms}ms`
                : "—"
            }
          />
          <StatTile
            label="Cache hit"
            value={
              snapshot?.runtime.last_cache_hit == null
                ? "n/a"
                : snapshot.runtime.last_cache_hit
                  ? "yes"
                  : "no"
            }
          />
          <StatTile
            label="Contacts returned"
            value={String(snapshot?.runtime.last_contacts_returned ?? 0)}
          />
          <StatTile
            label="Contacts persisted"
            value={String(snapshot?.runtime.last_contacts_persisted ?? 0)}
          />
          <StatTile label="Last success" value={formatTimestamp(snapshot?.runtime.last_success_at)} />
          <StatTile label="Last failure" value={formatTimestamp(snapshot?.runtime.last_failure_at)} />
        </div>
        {snapshot?.runtime.last_skipped_reason ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Last skipped: {snapshot.runtime.last_skipped_reason}
          </p>
        ) : null}
        {snapshot?.runtime.last_failure_reason ? (
          <p className="mt-1 text-xs text-amber-900">
            Last failure: {snapshot.runtime.last_failure_reason}
          </p>
        ) : null}
        {snapshot?.runtime.last_query_summary ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Query: {snapshot.runtime.last_query_summary}
          </p>
        ) : null}
      </GrowthEngineCard>

      <GrowthEngineCard title="PDL metrics (today)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Requests" value={String(snapshot?.metrics.requests_today ?? 0)} />
          <StatTile label="Successes" value={String(snapshot?.metrics.successes_today ?? 0)} />
          <StatTile label="Failures" value={String(snapshot?.metrics.failures_today ?? 0)} />
          <StatTile label="Skipped" value={String(snapshot?.metrics.skipped_today ?? 0)} />
          <StatTile
            label="Contacts returned"
            value={String(snapshot?.metrics.contacts_returned_today ?? 0)}
          />
          <StatTile
            label="Contacts persisted"
            value={String(snapshot?.metrics.contacts_persisted_today ?? 0)}
          />
          <StatTile
            label="Rate limited"
            value={String(snapshot?.metrics.rate_limited_today ?? 0)}
          />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Run PDL test lookup" icon={<FlaskConical className="size-4" />}>
        <p className="mb-3 text-xs text-muted-foreground">
          Safe admin test — sandbox by default, normalized preview only, no persistence, no outreach enqueue.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="pdl-test-company">
              Company name
            </label>
            <Input
              id="pdl-test-company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Acme Medical Service"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="pdl-test-domain">
              Domain (optional)
            </label>
            <Input
              id="pdl-test-domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="acmemedical.example"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy != null || (!companyName.trim() && !domain.trim())}
            onClick={() =>
              void runAction("test_pdl_lookup", {
                company_name: companyName,
                domain: domain || null,
                sandbox: true,
              })
            }
          >
            Run PDL test lookup
          </Button>
        </div>

        {testResult ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border/70 p-3 text-xs">
            <p className="font-medium">
              {testResult.ok ? "Preview ready" : "No preview contacts"} · {testResult.latency_ms}ms ·{" "}
              {testResult.sandbox ? "sandbox" : "live"}
            </p>
            {testResult.preview_contacts.length > 0 ? (
              <ul className="space-y-2">
                {testResult.preview_contacts.map((row) => (
                  <li key={`${row.full_name}-${row.email ?? row.phone ?? row.title}`} className="rounded border border-border/60 px-2 py-1.5">
                    <p className="font-medium">{row.full_name}</p>
                    <p className="text-muted-foreground">
                      {[row.title, row.email, row.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="text-muted-foreground">{row.verification_hint}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {testResult.diagnostics.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                {testResult.diagnostics.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </GrowthEngineCard>

      <GrowthEngineCard title="PDL diagnostics">
        {snapshot?.diagnostics.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {snapshot.diagnostics.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active diagnostics.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy != null}
            onClick={() => void runAction("rerun_diagnostics")}
          >
            <RefreshCw className="mr-1 size-3.5" />
            Reset runtime diagnostics
          </Button>
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </GrowthEngineCard>
    </div>
  )
}
