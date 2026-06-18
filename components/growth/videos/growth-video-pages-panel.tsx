"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Archive, Copy, Eye, Loader2, Plus, Search, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthEngineHonestEmptyState } from "@/components/growth/growth-engine-honest-empty-state"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import { useGrowthVideoPages } from "@/components/growth/videos/use-growth-video-pages"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { buildGrowthVideoPublicPath } from "@/lib/growth/videos/growth-video-page-validation"
import type { GrowthVideoPageStatus } from "@/lib/growth/videos/growth-video-types"

const FILTERS: Array<{ label: string; value?: GrowthVideoPageStatus }> = [
  { label: "All" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
]

function statusTone(status: GrowthVideoPageStatus) {
  switch (status) {
    case "published":
      return "healthy" as const
    case "archived":
      return "blocked" as const
    default:
      return "neutral" as const
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function GrowthVideoPagesPanel() {
  const pathname = usePathname()
  const { items, loading, error, load } = useGrowthVideoPages()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<GrowthVideoPageStatus | undefined>(undefined)
  const [actingId, setActingId] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)

  useEffect(() => {
    void load({ status: filter, search })
  }, [filter, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false),
    )
  }, [items, search])

  async function runAction(pageId: string, action: "publish" | "archive") {
    setActingId(pageId)
    try {
      await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/${action}`, { method: "POST" })
      await load({ status: filter, search })
    } finally {
      setActingId(null)
    }
  }

  async function copyPublicLink(slug: string) {
    const path = buildGrowthVideoPublicPath(slug)
    const url = `${window.location.origin}${path}`
    await navigator.clipboard.writeText(url)
    setCopyNotice(`Copied ${path}`)
    setTimeout(() => setCopyNotice(null), 2500)
  }

  return (
    <GrowthVideoWorkspaceShell
      title="Video Pages"
      description="Share uploaded videos on branded pages with CTAs and calendar links."
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search pages"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load({ status: filter, search })
            }}
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load({ status: filter, search })}>
          Search
        </Button>
        <Button type="button" size="sm" asChild>
          <Link href={growthFeaturePath(pathname, "videos/pages/new")}>
            <Plus className="mr-1.5 size-3.5" />
            New page
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <Button
            key={entry.label}
            type="button"
            size="sm"
            variant={filter === entry.value ? "default" : "outline"}
            onClick={() => setFilter(entry.value)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {copyNotice ? <p className="text-xs text-muted-foreground">{copyNotice}</p> : null}

      <GrowthEnginePanelResilience loading={loading} error={error}>
        {filtered.length === 0 ? (
          <GrowthEngineHonestEmptyState
            title="No video pages yet"
            description="Create a branded page from an uploaded video asset."
            actionLabel="New page"
            actionHref={growthFeaturePath(pathname, "videos/pages/new")}
            icon={Upload}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((page) => (
              <div key={page.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-foreground">{page.title}</h3>
                    <p className="text-xs text-muted-foreground">{page.slug}</p>
                  </div>
                  <GrowthBadge tone={statusTone(page.status)}>{page.status}</GrowthBadge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {page.description ?? "No description"}
                </p>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  <span>Created: {formatDate(page.createdAt)}</span>
                  <span>Published: {formatDate(page.publishedAt)}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href={growthFeaturePath(pathname, `videos/pages/${page.id}`)}>
                      <Eye className="mr-1 size-3.5" />
                      Edit
                    </Link>
                  </Button>
                  {page.status === "published" ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void copyPublicLink(page.slug)}>
                      <Copy className="mr-1 size-3.5" />
                      Copy link
                    </Button>
                  ) : null}
                  {page.status === "draft" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={actingId === page.id}
                      onClick={() => void runAction(page.id, "publish")}
                    >
                      {actingId === page.id ? <Loader2 className="size-3.5 animate-spin" /> : "Publish"}
                    </Button>
                  ) : null}
                  {page.status !== "archived" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={actingId === page.id}
                      onClick={() => void runAction(page.id, "archive")}
                    >
                      <Archive className="mr-1 size-3.5" />
                      Archive
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEnginePanelResilience>
    </GrowthVideoWorkspaceShell>
  )
}
