"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthLeadInboxCard } from "@/components/growth/lead-operator/growth-lead-inbox-card"
import {
  GROWTH_LEAD_INBOX_SORT_MODES,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
  type GrowthLeadInboxDashboardSectionPayload,
  type GrowthLeadInboxSortMode,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { cn } from "@/lib/utils"

const SORT_LABELS: Record<GrowthLeadInboxSortMode, string> = {
  priority: "Priority",
  intent: "Intent",
  confidence: "Confidence",
  recent_activity: "Recent activity",
}

export function GrowthLeadInboxDashboard() {
  const [sort, setSort] = useState<GrowthLeadInboxSortMode>("priority")
  const [sections, setSections] = useState<GrowthLeadInboxDashboardSectionPayload[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/lead-inbox?sort=${sort}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        sections?: GrowthLeadInboxDashboardSectionPayload[]
        total?: number
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not load lead inbox.")
      }
      setSections(data.sections ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load lead inbox.")
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROWTH_LEAD_INBOX_SORT_MODES.map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={sort === mode ? "default" : "outline"}
              onClick={() => setSort(mode)}
            >
              {SORT_LABELS[mode]}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/growth/leads/lead-engine">
              <Workflow className="mr-2 size-4" />
              Lead Engine tools
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/growth/leads/crm">CRM leads</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground">{GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER}</p>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading lead inbox…
        </div>
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">
            {total} candidate{total === 1 ? "" : "s"} — operator workflow only, no autonomous outreach.
          </p>
          {sections.map((section) => (
            <section key={section.id} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">{section.label}</h2>
                <span className="text-sm text-muted-foreground">{section.items.length}</span>
              </div>
              {section.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  No leads in this queue.
                </p>
              ) : (
                <div
                  className={cn(
                    "grid gap-3",
                    section.id === "archived" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3",
                  )}
                >
                  {section.items.map((card) => (
                    <GrowthLeadInboxCard key={card.id} card={card} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
