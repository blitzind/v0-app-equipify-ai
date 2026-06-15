"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Copy, ExternalLink, Loader2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import {
  GROWTH_SHARE_PAGE_SOURCE_CHANNELS,
  GROWTH_SHARE_PAGE_STATUSES,
  GROWTH_SHARE_PAGE_STATUS_LABELS,
} from "@/lib/growth/share-pages/share-page-types"
import {
  GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
  type GrowthSharePageListItem,
} from "@/lib/growth/share-pages/share-page-operator-types"

type ListResponse = {
  ok: boolean
  items: GrowthSharePageListItem[]
  total: number
  requires_human_review: boolean
}

type CreateForm = {
  leadId: string
  companyId: string
  campaignId: string
  enrollmentId: string
  sequenceExecutionJobId: string
  sourceChannel: (typeof GROWTH_SHARE_PAGE_SOURCE_CHANNELS)[number]
  bookingPageId: string
}

const DEFAULT_CREATE: CreateForm = {
  leadId: "",
  companyId: "",
  campaignId: "",
  enrollmentId: "",
  sequenceExecutionJobId: "",
  sourceChannel: "manual",
  bookingPageId: "",
}

function statusTone(status: GrowthSharePageListItem["status"]) {
  switch (status) {
    case "published":
      return "healthy" as const
    case "pending_review":
    case "draft":
      return "attention" as const
    case "revoked":
    case "archived":
    case "expired":
      return "critical" as const
    default:
      return "neutral" as const
  }
}

function formatWhen(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function saveSharePageTokens(
  sharePageId: string,
  tokens: { publicToken?: string; previewToken?: string },
): void {
  if (typeof window === "undefined") return
  try {
    const raw = window.sessionStorage.getItem("growth-share-page-tokens-v1")
    const store = raw ? (JSON.parse(raw) as Record<string, { publicToken?: string; previewToken?: string }>) : {}
    store[sharePageId] = { ...store[sharePageId], ...tokens }
    window.sessionStorage.setItem("growth-share-page-tokens-v1", JSON.stringify(store))
  } catch {
    // ignore storage failures
  }
}

export function GrowthSharePagesDashboard() {
  const [items, setItems] = useState<GrowthSharePageListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [channelFilter, setChannelFilter] = useState<string>("")
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(DEFAULT_CREATE)
  const [createMessage, setCreateMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (channelFilter) params.set("source_channel", channelFilter)
      if (search.trim()) params.set("search", search.trim())
      params.set("limit", "50")

      const res = await fetch(`/api/platform/growth/share-pages?${params.toString()}`)
      const data = (await res.json()) as ListResponse & { message?: string }
      if (!res.ok) {
        setError(data.message ?? "Failed to load share pages")
        setItems([])
        setTotal(0)
        return
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError("Share pages unavailable")
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [channelFilter, search, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!createForm.leadId.trim()) {
      setCreateMessage("Lead ID is required.")
      return
    }

    setCreating(true)
    setCreateMessage(null)
    try {
      const body: Record<string, unknown> = {
        lead_id: createForm.leadId.trim(),
        source_channel: createForm.sourceChannel,
        build_context: true,
      }
      if (createForm.companyId.trim()) body.company_id = createForm.companyId.trim()
      if (createForm.campaignId.trim()) body.campaign_id = createForm.campaignId.trim()
      if (createForm.enrollmentId.trim()) body.enrollment_id = createForm.enrollmentId.trim()
      if (createForm.sequenceExecutionJobId.trim()) {
        body.sequence_execution_job_id = createForm.sequenceExecutionJobId.trim()
      }
      if (createForm.bookingPageId.trim()) body.booking_page_id = createForm.bookingPageId.trim()

      const res = await fetch("/api/platform/growth/share-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        ok?: boolean
        page?: { id: string }
        publicToken?: string
        previewToken?: string
        message?: string
      }
      if (!res.ok || !data.page?.id) {
        setCreateMessage(data.message ?? "Create failed")
        return
      }

      saveSharePageTokens(data.page.id, {
        publicToken: data.publicToken,
        previewToken: data.previewToken,
      })
      setCreateMessage("Share page created (pending review). Opening detail…")
      window.location.href = `/admin/growth/share-pages/${data.page.id}`
    } catch {
      setCreateMessage("Create request failed")
    } finally {
      setCreating(false)
    }
  }

  return (
    <GrowthEngineCard title="Share Pages" data-qa-marker={GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER}>
      <p className="mb-4 text-xs text-muted-foreground">
        Human-approved personalized pages — passive delivery only. No outreach sends, enrollments, or autonomous
        scheduling.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <select
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All</option>
            {GROWTH_SHARE_PAGE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {GROWTH_SHARE_PAGE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Source channel</Label>
          <select
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value)}
          >
            <option value="">All</option>
            {GROWTH_SHARE_PAGE_SOURCE_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[220px] flex-1">
          <Label className="text-xs">Lead / company search</Label>
          <Input
            className="mt-1"
            placeholder="Search contact, company, email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
          Refresh
        </Button>
        <Button size="sm" onClick={() => setShowCreate((value) => !value)}>
          <Plus className="mr-1 h-4 w-4" />
          Create share page
        </Button>
      </div>

      {showCreate ? (
        <form onSubmit={(event) => void handleCreate(event)} className="mb-6 rounded-lg border border-border p-4">
          <h3 className="mb-3 text-sm font-medium">Manual create (pending review)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">Lead ID *</Label>
              <Input
                className="mt-1"
                value={createForm.leadId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, leadId: event.target.value }))}
                placeholder="UUID"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Company ID</Label>
              <Input
                className="mt-1"
                value={createForm.companyId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, companyId: event.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Campaign ID</Label>
              <Input
                className="mt-1"
                value={createForm.campaignId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, campaignId: event.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Enrollment ID</Label>
              <Input
                className="mt-1"
                value={createForm.enrollmentId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, enrollmentId: event.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Sequence execution job ID</Label>
              <Input
                className="mt-1"
                value={createForm.sequenceExecutionJobId}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, sequenceExecutionJobId: event.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Booking page ID</Label>
              <Input
                className="mt-1"
                value={createForm.bookingPageId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, bookingPageId: event.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Source channel</Label>
              <select
                className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={createForm.sourceChannel}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    sourceChannel: event.target.value as CreateForm["sourceChannel"],
                  }))
                }
              >
                {GROWTH_SHARE_PAGE_SOURCE_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Uses buildGrowthSharePageContext() for personalization. Default status: pending review — not auto-published.
          </p>
          {createMessage ? <p className="mt-2 text-xs text-amber-700">{createMessage}</p> : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Create draft
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mb-3 text-xs text-muted-foreground">{total} share page(s)</div>

      <GrowthEnginePanelResilience
        loading={loading && items.length === 0}
        error={error}
        isEmpty={!loading && items.length === 0}
        emptyKind="no_data"
        onRetry={() => void load()}
      />

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pr-3">Lead</th>
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Channel</th>
                <th className="py-2 pr-3">Views</th>
                <th className="py-2 pr-3">CTA clicks</th>
                <th className="py-2 pr-3">Bookings</th>
                <th className="py-2 pr-3">Last viewed</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">{item.leadLabel}</td>
                  <td className="py-2 pr-3">{item.companyName}</td>
                  <td className="py-2 pr-3">
                    <GrowthBadge tone={statusTone(item.status)}>{GROWTH_SHARE_PAGE_STATUS_LABELS[item.status]}</GrowthBadge>
                  </td>
                  <td className="py-2 pr-3 capitalize">{item.sourceChannel}</td>
                  <td className="py-2 pr-3">{item.viewCount}</td>
                  <td className="py-2 pr-3">{item.ctaClickCount}</td>
                  <td className="py-2 pr-3">{item.bookingCompletedCount}</td>
                  <td className="py-2 pr-3">{formatWhen(item.lastViewedAt)}</td>
                  <td className="py-2 pr-3">{formatWhen(item.createdAt)}</td>
                  <td className="py-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/growth/share-pages/${item.id}`}>Open</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}

export { saveSharePageTokens }

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
