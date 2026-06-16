"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { LayoutTemplate, Loader2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthSharePageTemplateCard } from "@/components/growth/share-pages/templates/growth-share-page-template-card"
import {
  sortTemplates,
  type GrowthSharePageTemplateSortKey,
} from "@/lib/growth/share-pages/share-page-template-editor-utils"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES,
  GROWTH_SHARE_PAGE_TEMPLATE_STATUSES,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
  type GrowthSharePageTemplate,
} from "@/lib/growth/share-pages/share-page-template-types"

type ListResponse = {
  ok: boolean
  items: GrowthSharePageTemplate[]
  total: number
  message?: string
}

export function GrowthSharePageTemplateLibrary() {
  const [items, setItems] = useState<GrowthSharePageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [tagFilter, setTagFilter] = useState("")
  const [sortKey, setSortKey] = useState<GrowthSharePageTemplateSortKey>("updated_at")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (categoryFilter) params.set("category", categoryFilter)
      if (tagFilter.trim()) params.set("tag", tagFilter.trim())
      if (search.trim()) params.set("search", search.trim())
      params.set("limit", "100")

      const res = await fetch(`/api/platform/growth/share-pages/templates?${params.toString()}`)
      const data = (await res.json()) as ListResponse
      if (!res.ok) {
        setError(data.message ?? "Failed to load templates")
        setItems([])
        return
      }
      setItems(data.items ?? [])
    } catch {
      setError("Share page templates unavailable")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, search, statusFilter, tagFilter])

  useEffect(() => {
    void load()
  }, [load])

  const sortedItems = useMemo(() => sortTemplates(items, sortKey), [items, sortKey])

  const filteredItems = useMemo(() => {
    if (!tagFilter.trim()) return sortedItems
    const needle = tagFilter.trim().toLowerCase()
    return sortedItems.filter((item) => item.tags.some((tag) => tag.toLowerCase().includes(needle)))
  }, [sortedItems, tagFilter])

  async function duplicateTemplate(template: GrowthSharePageTemplate) {
    setBusyId(template.id)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${template.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${template.name} (Copy)` }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        setMessage(data.message ?? "Duplicate failed")
        return
      }
      setMessage("Template duplicated.")
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function archiveTemplate(template: GrowthSharePageTemplate) {
    setBusyId(template.id)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${template.id}`, { method: "DELETE" })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        setMessage(data.message ?? "Archive failed")
        return
      }
      setMessage(`Archived ${template.name}.`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Reusable share page layouts for future page creation. Template publish makes a layout available — it does not
            publish live share pages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/growth/share-pages/templates/new">
              <Plus className="mr-1.5 size-3.5" />
              New template
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Input placeholder="Search name or description" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {GROWTH_SHARE_PAGE_TEMPLATE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Input placeholder="Filter by tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as GrowthSharePageTemplateSortKey)}
        >
          <option value="updated_at">Sort: last modified</option>
          <option value="name">Sort: name</option>
          <option value="status">Sort: status</option>
        </select>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <GrowthEnginePanelResilience
        loading={loading}
        error={error}
        isEmpty={!loading && !error && filteredItems.length === 0}
        emptyKind="no_campaign_builders"
        emptyTitle="No templates yet"
        emptyMessage="Create a reusable share page template to standardize layout, sections, and messaging."
        onRetry={() => void load()}
      >
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading templates…
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((template) => (
              <GrowthSharePageTemplateCard
                key={template.id}
                template={template}
                busy={busyId === template.id}
                onDuplicate={(entry) => void duplicateTemplate(entry)}
                onArchive={(entry) => void archiveTemplate(entry)}
              />
            ))}
          </div>
        )}
      </GrowthEnginePanelResilience>

      {!loading && filteredItems.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <LayoutTemplate className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Templates you publish here stay in the library until instantiated.</p>
        </div>
      ) : null}
    </div>
  )
}
