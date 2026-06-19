"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutTemplate, Loader2, Plus, RefreshCw } from "lucide-react"
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
import {
  growthFeaturePath,
  resolveGrowthFeatureBasePath,
} from "@/lib/growth/navigation/growth-workspace-base-path"

type ListResponse = {
  ok: boolean
  items: GrowthSharePageListItem[]
  total: number
  requires_human_review: boolean
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

export function saveSharePageTokens(
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

export function GrowthSharePagesManagePanel({
  basePath,
}: {
  /** Workspace: /growth/share-pages/manage · Admin: /admin/growth/share-pages/manage */
  basePath?: string
} = {}) {
  const pathname = usePathname()
  const featureBasePath = resolveGrowthFeatureBasePath(pathname)
  const manageBasePath = basePath ?? `${featureBasePath}/share-pages/manage`
  const templatesPath = growthFeaturePath(pathname, "share-pages/templates")
  const createPath = `${manageBasePath}/new`
  const [items, setItems] = useState<GrowthSharePageListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [channelFilter, setChannelFilter] = useState<string>("")
  const [search, setSearch] = useState("")

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

  return (
    <GrowthEngineCard title="Share Pages" data-qa-marker={GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER}>
      <p className="mb-4 text-xs text-muted-foreground">
        Human-approved personalized pages — passive delivery only. No outreach sends, enrollments, or autonomous
        scheduling.{" "}
        <Link href={templatesPath} className="font-medium text-primary underline-offset-4 hover:underline">
          <LayoutTemplate className="mr-1 inline size-3.5" />
          Manage reusable templates
        </Link>
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
        <Button size="sm" asChild>
          <Link href={createPath}>
            <Plus className="mr-1 h-4 w-4" />
            Create share page
          </Link>
        </Button>
      </div>

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
                    <GrowthBadge tone={statusTone(item.status)}>
                      {GROWTH_SHARE_PAGE_STATUS_LABELS[item.status]}
                    </GrowthBadge>
                  </td>
                  <td className="py-2 pr-3 capitalize">{item.sourceChannel}</td>
                  <td className="py-2 pr-3">{item.viewCount}</td>
                  <td className="py-2 pr-3">{item.ctaClickCount}</td>
                  <td className="py-2 pr-3">{item.bookingCompletedCount}</td>
                  <td className="py-2 pr-3">{formatWhen(item.lastViewedAt)}</td>
                  <td className="py-2 pr-3">{formatWhen(item.createdAt)}</td>
                  <td className="py-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`${featureBasePath}/share-pages/${item.id}`}>Open</Link>
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
