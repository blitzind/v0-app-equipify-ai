"use client"

import { useCallback, useEffect, useState } from "react"
import { ExternalLink, Loader2, Mail, MailSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthEmailDiscoveryOperatorStatus } from "@/lib/growth/email-discovery/email-discovery-runtime-types"
import type { GrowthEmailDiscoveryRunDetail } from "@/lib/growth/email-discovery/email-discovery-types"

type GrowthEmailDiscoveryOperatorCardProps = {
  companyId: string
  personId: string
  personLabel?: string
  compact?: boolean
  triggerSource?: "manual" | "browser_extension"
}

function discoveryStatusLabel(status: GrowthEmailDiscoveryOperatorStatus["discovery_status"]): string {
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
  status: GrowthEmailDiscoveryOperatorStatus["discovery_status"],
): "healthy" | "attention" | "neutral" {
  if (status === "completed") return "healthy"
  if (status === "failed") return "attention"
  if (status === "pending" || status === "running") return "attention"
  return "neutral"
}

export function GrowthEmailDiscoveryOperatorCard({
  companyId,
  personId,
  personLabel,
  compact = false,
  triggerSource = "manual",
}: GrowthEmailDiscoveryOperatorCardProps) {
  const [status, setStatus] = useState<GrowthEmailDiscoveryOperatorStatus | null>(null)
  const [detail, setDetail] = useState<GrowthEmailDiscoveryRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [enqueueing, setEnqueueing] = useState(false)
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ company_id: companyId, person_id: personId })
      const res = await fetch(`/api/platform/growth/email-discovery/operator-status?${params}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        status?: GrowthEmailDiscoveryOperatorStatus
        message?: string
      }
      if (!res.ok || !data.ok || !data.status) {
        throw new Error(data.message ?? "Could not load email discovery status.")
      }
      setStatus(data.status)
    } catch (e) {
      setStatus(null)
      setError(e instanceof Error ? e.message : "Could not load email discovery status.")
    } finally {
      setLoading(false)
    }
  }, [companyId, personId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function enqueueDiscovery() {
    setEnqueueing(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/email-discovery/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          person_id: personId,
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
        throw new Error(data.message ?? "Could not queue email discovery.")
      }
      setMessage(
        data.enqueued
          ? "Email discovery queued. Results update when the worker completes."
          : data.reason === "verified_email_exists"
            ? "Verified email already on file."
            : data.reason === "active_job_exists"
              ? "Discovery already queued or running."
              : "Discovery was not queued.",
      )
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not queue email discovery.")
    } finally {
      setEnqueueing(false)
    }
  }

  async function loadEvidence() {
    if (!status?.last_run_id) return
    setLoadingEvidence(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/email-discovery/runs/${status.last_run_id}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        detail?: GrowthEmailDiscoveryRunDetail
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
        Loading email discovery…
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
        <Mail className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">
          {personLabel ? `Email — ${personLabel}` : "Email discovery"}
        </span>
        <GrowthBadge
          label={discoveryStatusLabel(status.discovery_status)}
          tone={discoveryStatusTone(status.discovery_status)}
        />
      </div>

      <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline">Verified email: </dt>
          <dd className="inline font-medium text-foreground">
            {status.has_verified_email ? status.verified_email : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline">Evidence: </dt>
          <dd className="inline font-medium text-foreground">{status.evidence_count}</dd>
        </div>
        <div>
          <dt className="inline">Last run: </dt>
          <dd className="inline font-medium text-foreground">
            {status.last_run_at ? new Date(status.last_run_at).toLocaleString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline">Run status: </dt>
          <dd className="inline font-medium text-foreground">{status.last_run_status ?? "—"}</dd>
        </div>
      </dl>

      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {status.can_discover ? (
          <Button size="sm" variant="outline" disabled={enqueueing} onClick={() => void enqueueDiscovery()}>
            {enqueueing ? <Loader2 className="mr-1 size-3 animate-spin" /> : <MailSearch className="mr-1 size-3" />}
            Discover Email
          </Button>
        ) : null}
        {status.can_view_evidence ? (
          <Button size="sm" variant="ghost" disabled={loadingEvidence} onClick={() => void loadEvidence()}>
            {loadingEvidence ? <Loader2 className="mr-1 size-3 animate-spin" /> : <ExternalLink className="mr-1 size-3" />}
            View Evidence
          </Button>
        ) : null}
      </div>

      {detail ? (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-2 text-xs space-y-2">
          {(detail.candidates ?? []).slice(0, 8).map((c) => (
            <div key={c.id} className="border-b border-border/60 pb-2 last:border-0">
              <p className="font-medium text-foreground">{c.email}</p>
              <p className="text-muted-foreground">
                {c.source} · {c.verification_status} · evidence {c.evidence?.length ?? 0}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
