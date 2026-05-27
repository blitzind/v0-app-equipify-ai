"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthProspectSearchProviderHealthSnapshot } from "@/lib/growth/prospect-search/prospect-search-provider-health-types"
import { GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-estimation-types"

function uptimeTone(state: string): "healthy" | "attention" | "blocked" | "neutral" {
  if (state === "available") return "healthy"
  if (state === "disabled") return "blocked"
  return "attention"
}

export function GrowthProspectSearchProviderHealthDashboard() {
  const [snapshot, setSnapshot] = useState<GrowthProspectSearchProviderHealthSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/prospect-search/provider-health", {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: GrowthProspectSearchProviderHealthSnapshot
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
        const res = await fetch("/api/platform/growth/prospect-search/provider-health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        })
        const json = (await res.json()) as {
          ok?: boolean
          message?: string
          snapshot?: GrowthProspectSearchProviderHealthSnapshot
        }
        setActionMessage(json.message ?? (json.ok ? "Done." : "Action failed."))
        if (json.snapshot) setSnapshot(json.snapshot)
        else if (action !== "toggle_provider") await load()
        else await load()
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
        Loading provider health…
      </div>
    )
  }

  return (
    <div
      className="space-y-4"
      data-qa-marker={GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER}
    >
      {actionMessage ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{actionMessage}</p>
      ) : null}

      <GrowthEngineCard title="Provider status" icon={<Activity className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {snapshot?.provider_status.map((row) => (
            <div key={row.provider_type} className="rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{row.provider_name}</p>
                <GrowthBadge tone={uptimeTone(row.uptime_state)}>{row.uptime_state}</GrowthBadge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Key present: {String(row.configured)} · Runtime:{" "}
                {row.runtime_enabled ? "enabled" : "disabled"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy != null}
                  onClick={() =>
                    void runAction("test_provider", { provider_name: row.provider_type })
                  }
                >
                  Test provider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy != null || row.env_disabled}
                  onClick={() =>
                    void runAction("toggle_provider", {
                      provider_name: row.provider_type,
                      enabled: !row.runtime_enabled,
                    })
                  }
                >
                  {row.runtime_enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Env health">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            label="GOOGLE_PLACES_API_KEY"
            value={snapshot?.env_health.google_places_key_present ? "present" : "missing"}
          />
          <StatTile
            label="SERPAPI / SERP_API_KEY"
            value={snapshot?.env_health.serp_key_present ? "present" : "missing"}
          />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Provider metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Requests today" value={String(snapshot?.metrics.requests_today ?? 0)} />
          <StatTile label="Quota failures" value={String(snapshot?.metrics.quota_failures_today ?? 0)} />
          <StatTile
            label="Avg latency"
            value={
              snapshot?.metrics.average_latency_ms != null
                ? `${snapshot.metrics.average_latency_ms}ms`
                : "—"
            }
          />
          <StatTile
            label="Cache hit rate"
            value={
              snapshot?.metrics.cache_hit_rate != null
                ? `${snapshot.metrics.cache_hit_rate}%`
                : "—"
            }
          />
          <StatTile label="Raw results" value={String(snapshot?.metrics.raw_results_returned_today ?? 0)} />
          <StatTile
            label="Normalized"
            value={String(snapshot?.metrics.normalized_results_today ?? 0)}
          />
          <StatTile label="Filtered" value={String(snapshot?.metrics.filtered_results_today ?? 0)} />
          <StatTile
            label="Persist failures"
            value={String(snapshot?.metrics.persist_failures_today ?? 0)}
          />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Recent discovery activity">
        {snapshot?.recent_activity.length ? (
          <ul className="space-y-2 text-xs">
            {snapshot.recent_activity.map((row) => (
              <li key={row.id} className="rounded-md border border-border/60 px-2 py-1.5">
                <p className="font-medium">{row.query || "(empty query)"}</p>
                <p className="text-muted-foreground">
                  {row.provider_names.join(", ") || "no providers"} · {row.candidate_count} results ·
                  expansion={row.query_expansion_count}
                  {row.relaxed_retry ? " · relaxed retry" : ""}
                  {row.fixture_fallback ? " · fixture fallback" : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No discovery runs recorded today.</p>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Diagnostics">
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
            onClick={() => void runAction("clear_cache")}
          >
            Clear provider cache
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy != null}
            onClick={() => void runAction("rerun_diagnostics")}
          >
            <RefreshCw className="mr-1 size-3.5" />
            Re-run diagnostics
          </Button>
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </GrowthEngineCard>
    </div>
  )
}
