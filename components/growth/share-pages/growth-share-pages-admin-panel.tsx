"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { useGrowthBreadcrumbDetail } from "@/components/growth/shell/growth-breadcrumb-context"
import {
  GrowthSharePagesManagePanel,
  saveSharePageTokens,
} from "@/components/growth/share-pages/growth-share-page-manage-panel"
import { GROWTH_SHARE_PAGE_STATUS_LABELS } from "@/lib/growth/share-pages/share-page-types"
import { GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER } from "@/lib/growth/share-pages/share-page-operator-types"

export function GrowthSharePagesDashboard() {
  return <GrowthSharePagesManagePanel basePath="/admin/growth/share-pages/manage" />
}

export { saveSharePageTokens }

function formatWhen(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      <Copy className="mr-1 h-3.5 w-3.5" />
      {copied ? "Copied" : label}
    </Button>
  )
}

export function GrowthSharePageDetailPanel({ sharePageId }: { sharePageId: string }) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<
    import("@/lib/growth/share-pages/share-page-operator-types").GrowthSharePageOperatorDetail | null
  >(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadTokensFromSession = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.sessionStorage.getItem("growth-share-page-tokens-v1")
      if (!raw) return
      const store = JSON.parse(raw) as Record<string, { publicToken?: string; previewToken?: string }>
      const entry = store[sharePageId]
      if (entry?.previewToken) setPreviewUrl(`/p-preview/${entry.previewToken}`)
      if (entry?.publicToken) setPublicUrl(`/p/${entry.publicToken}`)
    } catch {
      // ignore
    }
  }, [sharePageId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/${sharePageId}`)
      const data = (await res.json()) as {
        ok?: boolean
        detail?: import("@/lib/growth/share-pages/share-page-operator-types").GrowthSharePageOperatorDetail
        message?: string
      }
      if (!res.ok || !data.detail) {
        setError(data.message ?? "Share page not found")
        setDetail(null)
        return
      }
      setDetail(data.detail)
      loadTokensFromSession()
    } catch {
      setError("Failed to load share page")
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [loadTokensFromSession, sharePageId])

  useEffect(() => {
    void load()
  }, [load])

  useGrowthBreadcrumbDetail(detail?.page.headline, loading)

  async function runAction(action: "preview" | "approve" | "revoke" | "archive") {
    setActing(action)
    setActionMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/${sharePageId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "preview" ? { rebuild_context: true } : {}),
      })
      const data = (await res.json()) as {
        ok?: boolean
        previewUrl?: string
        previewToken?: string
        message?: string
      }
      if (!res.ok) {
        setActionMessage(data.message ?? `${action} failed`)
        return
      }
      if (action === "preview" && data.previewUrl) {
        setPreviewUrl(data.previewUrl.replace(/^https?:\/\/[^/]+/, ""))
        saveSharePageTokens(sharePageId, { previewToken: data.previewToken })
        setActionMessage("Preview link regenerated (admin-only, labeled preview).")
      } else if (action === "approve") {
        setActionMessage(data.message ?? "Share page published.")
      } else {
        setActionMessage(`Share page ${action}d.`)
      }
      await load()
    } catch {
      setActionMessage(`${action} request failed`)
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading share page…
      </div>
    )
  }

  if (error || !detail) {
    return <p className="text-sm text-destructive">{error ?? "Share page unavailable"}</p>
  }

  const page = detail.page
  const analytics = detail.analytics

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER}>
      <GrowthEngineCard title={detail.leadLabel}>
        <div className="mb-4 flex flex-wrap gap-2">
          <GrowthBadge tone="attention">{GROWTH_SHARE_PAGE_STATUS_LABELS[page.status]}</GrowthBadge>
          <GrowthBadge tone="neutral">Token prefix: {detail.tokenPrefix}…</GrowthBadge>
          <GrowthBadge tone="neutral">Channel: {page.sourceChannel}</GrowthBadge>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <div className="text-xs font-medium text-amber-900">Preview link (admin-only)</div>
            {previewUrl ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="text-xs">{previewUrl}</code>
                <CopyButton value={previewUrl} label="Copy preview" />
                <Button size="sm" variant="ghost" asChild>
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Open preview
                  </a>
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Regenerate preview to issue a one-time link.</p>
            )}
          </div>

          {page.status === "published" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="text-xs font-medium text-emerald-900">Public link (published)</div>
              {publicUrl ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="text-xs">{publicUrl}</code>
                  <CopyButton value={publicUrl} label="Copy public" />
                  <Button size="sm" variant="ghost" asChild>
                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Open public
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Public token was issued at create. Copy during create flow or check session storage on this device.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
              Public link appears after human approval (publish).
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void runAction("preview")}>
            {acting === "preview" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Regenerate preview / context
          </Button>
          {(page.status === "draft" || page.status === "pending_review") && (
            <Button size="sm" disabled={acting !== null} onClick={() => void runAction("approve")}>
              Approve / publish
            </Button>
          )}
          {page.status !== "revoked" && page.status !== "archived" ? (
            <Button size="sm" variant="destructive" disabled={acting !== null} onClick={() => void runAction("revoke")}>
              Revoke
            </Button>
          ) : null}
          {page.status !== "archived" ? (
            <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void runAction("archive")}>
              Archive
            </Button>
          ) : null}
        </div>
        {actionMessage ? <p className="mb-4 text-xs text-muted-foreground">{actionMessage}</p> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-medium">Analytics summary</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Views: {analytics?.viewCount ?? detail.engagementSummary.viewCount}</li>
              <li>Sessions: {analytics?.uniqueSessionCount ?? detail.engagementSummary.uniqueSessionCount}</li>
              <li>CTA clicks: {analytics?.engagementSummary.ctaClickCount ?? detail.engagementSummary.ctaClickCount}</li>
              <li>
                Bookings completed:{" "}
                {analytics?.engagementSummary.bookingCompletedCount ?? detail.engagementSummary.bookingCompletedCount}
              </li>
              <li>Max scroll: {detail.engagementSummary.maxScrollDepthPct}%</li>
              <li>Last activity: {formatWhen(detail.engagementSummary.lastActivityAt)}</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Audit / provenance</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Created: {formatWhen(page.createdAt)}</li>
              <li>Updated: {formatWhen(page.updatedAt)}</li>
              <li>Approved: {formatWhen(page.approvedAt)}</li>
              <li>Published: {formatWhen(page.publishedAt)}</li>
              <li>Evidence score: {page.evidenceCoverageScore ?? "—"}</li>
              <li>Sources: {(page.sourcesUsed ?? []).join(", ") || "—"}</li>
              <li>Booking page ID: {detail.bookingPageId ?? "—"}</li>
              <li>Campaign: {page.campaignId ?? "—"}</li>
              <li>Enrollment: {page.enrollmentId ?? "—"}</li>
              <li>Sequence job: {page.sequenceExecutionJobId ?? "—"}</li>
            </ul>
          </section>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Personalization snapshot">
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(detail.personalizationSnapshot, null, 2)}
        </pre>
      </GrowthEngineCard>

      <GrowthEngineCard title="CTA config">
        <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(page.ctaConfig, null, 2)}</pre>
      </GrowthEngineCard>

      <GrowthEngineCard title="Resources">
        <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(page.resources, null, 2)}</pre>
      </GrowthEngineCard>

      <GrowthEngineCard title="Event timeline">
        {detail.recentEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {detail.recentEvents.map((event) => (
              <li key={event.id} className="rounded border border-border px-2 py-1.5">
                <span className="font-medium">{event.eventType}</span> — {event.eventLabel}
                <span className="ml-2 text-muted-foreground">{formatWhen(event.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
