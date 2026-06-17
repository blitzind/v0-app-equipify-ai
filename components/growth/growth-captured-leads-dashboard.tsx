"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MailCheck,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_CAPTURED_LEAD_FILTERS,
  type GrowthCapturedLeadAction,
  type GrowthCapturedLeadFilter,
  type GrowthCapturedLeadRow,
} from "@/lib/growth/captured-leads/captured-lead-types"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

const FILTER_LABELS: Record<GrowthCapturedLeadFilter, string> = {
  all: "All",
  needs_review: "Needs review",
  has_verified_email: "Verified email",
  needs_contact_discovery: "Needs discovery",
  linkedin_captured: "LinkedIn",
  website_captured: "Website",
  company_only: "Company-only",
}

function formatWhen(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function StatusChip({ label, tone }: { label: string; tone: "neutral" | "good" | "warn" | "bad" }) {
  const classes =
    tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : tone === "bad"
          ? "bg-red-50 text-red-800 border-red-200"
          : "bg-slate-50 text-slate-700 border-slate-200"
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes}`}>{label}</span>
}

function enrichmentTone(status: GrowthCapturedLeadRow["enrichment_status"]): "neutral" | "good" | "warn" | "bad" {
  if (status === "completed") return "good"
  if (status === "queued" || status === "running") return "warn"
  if (status === "failed") return "bad"
  return "neutral"
}

function verificationTone(status: GrowthCapturedLeadRow["verification_status"]): "neutral" | "good" | "warn" | "bad" {
  if (status === "verified") return "good"
  if (status === "invalid" || status === "blocked") return "bad"
  if (status === "unknown") return "warn"
  return "neutral"
}

export function GrowthCapturedLeadsDashboard() {
  const pathname = usePathname()
  const [filter, setFilter] = useState<GrowthCapturedLeadFilter>("needs_review")
  const [rows, setRows] = useState<GrowthCapturedLeadRow[]>([])
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/captured-leads?filter=${filter}`, { cache: "no-store" })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        rows?: GrowthCapturedLeadRow[]
        filter_counts?: Record<string, number>
        message?: string
        error?: string
      } | null
      if (!res.ok || !data?.ok || !data.rows) {
        throw new Error(data?.message ?? data?.error ?? "Could not load recently captured leads.")
      }
      setRows(data.rows)
      setFilterCounts(data.filter_counts ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load recently captured leads.")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(leadId: string, action: GrowthCapturedLeadAction) {
    setActing(`${leadId}:${action}`)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/captured-leads/${leadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        result?: { message?: string; workspace_href?: string | null; row?: GrowthCapturedLeadRow }
        message?: string
      } | null

      if (!res.ok || !data?.result) {
        throw new Error(data?.result?.message ?? data?.message ?? "Action failed.")
      }

      setMessage(data.result.message ?? "Action completed.")
      if (data.result.row) {
        setRows((prev) => prev.map((row) => (row.lead_id === leadId ? data.result!.row! : row)))
      } else {
        await load()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActing(null)
    }
  }

  const summary = useMemo(() => {
    const needsReview = filterCounts.needs_review ?? rows.filter((r) => r.review_status === "needs_review").length
    return { total: filterCounts.all ?? rows.length, needsReview }
  }, [filterCounts, rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {summary.total} captured · {summary.needsReview} need review
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {GROWTH_CAPTURED_LEAD_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === key
                ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {FILTER_LABELS[key]}
            {filterCounts[key] != null ? ` (${filterCounts[key]})` : ""}
          </button>
        ))}
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading recently captured leads…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No captured leads match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Captured</th>
                <th className="px-3 py-2">Company / Contact</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Reach</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Next action</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = acting?.startsWith(`${row.lead_id}:`) ?? false
                return (
                  <tr key={row.lead_id} className="border-b border-border/70 align-top last:border-b-0">
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {formatWhen(row.captured_at)}
                      <div className="mt-1">
                        <StatusChip
                          label={row.review_status === "reviewed" ? "Reviewed" : "Needs review"}
                          tone={row.review_status === "reviewed" ? "good" : "warn"}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">{row.company_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.contact_name ?? "Company-only prospect"}
                        {row.capture_type === "company_only" ? " · company-only" : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div className="font-medium capitalize">{row.source_platform ?? row.source_kind}</div>
                      <div className="text-muted-foreground capitalize">{row.source_kind.replace("_", " ")}</div>
                      {row.source_url ? (
                        <a
                          href={row.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-indigo-600 hover:underline"
                        >
                          Source <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      <div>{row.contact_email ?? "—"}</div>
                      <div>{row.contact_phone ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusChip label={`Enrichment: ${row.enrichment_status}`} tone={enrichmentTone(row.enrichment_status)} />
                        <StatusChip label={`Email: ${row.verification_status}`} tone={verificationTone(row.verification_status)} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {row.next_best_action_label ?? row.next_best_action ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[220px] flex-wrap gap-1">
                        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                          <Link href={growthFeaturePath(pathname, `leads/${row.lead_id}`)}>Open</Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={busy || row.review_status === "reviewed"}
                          onClick={() => void runAction(row.lead_id, "mark_reviewed")}
                        >
                          <CheckCircle2 className="mr-1 size-3" />
                          Reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={busy || !row.contact_email}
                          onClick={() => void runAction(row.lead_id, "verify_email")}
                        >
                          <MailCheck className="mr-1 size-3" />
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={busy}
                          onClick={() => void runAction(row.lead_id, "queue_contact_discovery")}
                        >
                          <Search className="mr-1 size-3" />
                          Discovery
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={busy || !row.contact_phone}
                          onClick={() => void runAction(row.lead_id, "add_to_call_queue")}
                        >
                          <Phone className="mr-1 size-3" />
                          Call queue
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={busy}
                          onClick={() => void runAction(row.lead_id, "create_sequence_draft")}
                        >
                          <Sparkles className="mr-1 size-3" />
                          Seq draft
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
