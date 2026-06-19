"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Eye, LayoutTemplate, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"
import { GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES } from "@/lib/growth/share-pages/share-page-template-types"

const CATEGORY_LABELS: Record<string, string> = {
  general: "Introduction",
  outbound: "Introduction",
  follow_up: "Meeting Follow-up",
  meeting_prep: "Meeting Follow-up",
  case_study: "Proposal",
  custom: "Custom",
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ")
}

export function GrowthSharePageTemplatePicker({
  value,
  onChange,
}: {
  value: GrowthSharePageTemplate | null
  onChange: (template: GrowthSharePageTemplate | null) => void
}) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<GrowthSharePageTemplate[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/platform/growth/share-pages/templates?status=published&limit=100")
        const data = (await res.json()) as {
          ok?: boolean
          items?: GrowthSharePageTemplate[]
          message?: string
        }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load templates.")
        if (!cancelled) setTemplates(data.items ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!categoryFilter) return templates
    return templates.filter((template) => template.category === categoryFilter)
  }, [categoryFilter, templates])

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading templates…
      </p>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter("")}
          className={`rounded-full border px-3 py-1 text-xs ${!categoryFilter ? "bg-primary text-primary-foreground" : ""}`}
        >
          All
        </button>
        {GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setCategoryFilter(category)}
            className={`rounded-full border px-3 py-1 text-xs ${
              categoryFilter === category ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {categoryLabel(category)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No published templates yet.{" "}
          <Link href={growthFeaturePath(pathname, "share-pages/templates")} className="font-medium text-primary">
            Create a template
          </Link>{" "}
          to reuse page layouts.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((template) => {
            const selected = value?.id === template.id
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onChange(selected ? null : template)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{template.name}</span>
                      <GrowthBadge tone="healthy" label={categoryLabel(template.category)} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {template.description || "No description"}
                    </p>
                  </div>
                  {template.previewImageUrl ? (
                    <div
                      className="size-14 shrink-0 rounded-xl border border-border bg-cover bg-center"
                      style={{ backgroundImage: `url(${template.previewImageUrl})` }}
                      aria-hidden
                    />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30">
                      <LayoutTemplate className="size-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={growthFeaturePath(pathname, `share-pages/templates/${template.id}/preview`)}>
                      <Eye className="mr-1.5 size-3.5" />
                      Preview template
                    </Link>
                  </Button>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { categoryLabel as growthSharePageTemplateCategoryLabel }
