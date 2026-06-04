"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthCompanyIntelligenceOperatorStatus } from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"
import type { GrowthCompanyIntelligenceRunDetail } from "@/lib/growth/company-intelligence/company-intelligence-types"

type GrowthCompanyIntelligenceOperatorCardProps = {
  companyId: string
  compact?: boolean
  triggerSource?: "manual" | "browser_extension"
}

function discoveryStatusLabel(
  status: GrowthCompanyIntelligenceOperatorStatus["discovery_status"],
): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "running":
      return "Running"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    default:
      return "None"
  }
}

function discoveryStatusTone(
  status: GrowthCompanyIntelligenceOperatorStatus["discovery_status"],
): "healthy" | "attention" | "neutral" {
  if (status === "completed") return "healthy"
  if (status === "failed") return "attention"
  if (status === "pending" || status === "running") return "attention"
  return "neutral"
}

export function GrowthCompanyIntelligenceOperatorCard({
  companyId,
  compact = false,
  triggerSource = "manual",
}: GrowthCompanyIntelligenceOperatorCardProps) {
  const [status, setStatus] = useState<GrowthCompanyIntelligenceOperatorStatus | null>(null)
  const [detail, setDetail] = useState<GrowthCompanyIntelligenceRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [enqueueing, setEnqueueing] = useState(false)
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/company-intelligence/operator-status?company_id=${encodeURIComponent(companyId)}`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        status?: GrowthCompanyIntelligenceOperatorStatus
        message?: string
      }
      if (!res.ok || !data.ok || !data.status) {
        throw new Error(data.message ?? "Could not load company intelligence status.")
      }
      setStatus(data.status)
    } catch (e) {
      setStatus(null)
      setError(e instanceof Error ? e.message : "Could not load company intelligence status.")
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function enqueueDiscovery() {
    setEnqueueing(true)
    setError(null)
    setMessage(null)
    setDetail(null)
    try {
      const res = await fetch("/api/platform/growth/company-intelligence/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          promote_on_complete: true,
          trigger_source: triggerSource,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        enqueued?: boolean
        reason?: string | null
        message?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Could not queue company intelligence.")
      }
      setMessage(
        data.enqueued
          ? "Company intelligence queued. Results update when the worker completes."
          : data.reason === "verified_intelligence_exists"
            ? "Verified intelligence snapshots already on file."
            : data.reason === "active_job_exists"
              ? "Discovery already queued or running."
              : "Discovery was not queued.",
      )
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not queue company intelligence.")
    } finally {
      setEnqueueing(false)
    }
  }

  async function loadEvidence() {
    if (!status?.last_run_id) return
    setLoadingEvidence(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/company-intelligence/runs/${status.last_run_id}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        detail?: GrowthCompanyIntelligenceRunDetail
        message?: string
      }
      if (!res.ok || !data.ok || !data.detail) {
        throw new Error(data.message ?? "Could not load evidence.")
      }
      setDetail(data.detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load evidence.")
    } finally {
      setLoadingEvidence(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Loading company intelligence…
      </div>
    )
  }

  if (!status) {
    return error ? <p className="text-xs text-destructive">{error}</p> : null
  }

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-border/80 bg-muted/20 px-3 py-2 space-y-2"
          : "rounded-xl border border-border bg-muted/15 p-4 space-y-3"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Building2 className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Company intelligence</span>
        <GrowthBadge
          label={discoveryStatusLabel(status.discovery_status)}
          tone={discoveryStatusTone(status.discovery_status)}
        />
      </div>

      <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline">Snapshots: </dt>
          <dd className="inline font-medium text-foreground">
            {status.snapshot_count}
            {status.has_verified_intelligence ? " (verified)" : ""}
          </dd>
        </div>
        <div>
          <dt className="inline">Evidence: </dt>
          <dd className="inline font-medium text-foreground">{status.evidence_count}</dd>
        </div>
        <div>
          <dt className="inline">Last run: </dt>
          <dd className="inline font-medium text-foreground">
            {status.latest_promoted_count} promoted / {status.latest_verified_count} verified
          </dd>
        </div>
        <div>
          <dt className="inline">Categories: </dt>
          <dd className="inline font-medium text-foreground">
            {status.categories_present.length ? status.categories_present.join(", ") : "—"}
          </dd>
        </div>
      </dl>

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={enqueueing || !status.can_discover}
          onClick={() => void enqueueDiscovery()}
        >
          {enqueueing ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          Collect intelligence
        </Button>
        {status.can_view_evidence ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={loadingEvidence}
            onClick={() => void loadEvidence()}
          >
            {loadingEvidence ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
            View evidence
          </Button>
        ) : null}
      </div>

      {detail && detail.evidence.length > 0 ? (
        <ul className="max-h-32 space-y-1 overflow-y-auto font-mono text-[10px] text-muted-foreground">
          {detail.evidence.slice(0, 12).map((row) => (
            <li key={row.id}>
              [{row.evidence_type}] {row.intelligence_category}/{row.intelligence_key}:{" "}
              {row.evidence_text.slice(0, 100)}
              {row.source_url ? ` (${row.source_url})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
