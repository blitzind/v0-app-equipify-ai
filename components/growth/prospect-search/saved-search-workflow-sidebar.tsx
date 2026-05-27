"use client"

import Link from "next/link"
import { Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  formatSavedSearchCountDelta,
  formatSavedSearchRefreshedAt,
  GROWTH_SAVED_SEARCH_WORKFLOW_LINKS,
  GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER,
  type GrowthProspectSearchSavedSearchWithWorkflow,
} from "@/lib/growth/prospect-search/saved-search-workflows"
import { cn } from "@/lib/utils"

export function SavedSearchWorkflowSidebar({
  savedSearches,
  activeSavedSearchId,
  refreshing,
  onRestore,
  onRefreshCounts,
  onDelete,
}: {
  savedSearches: GrowthProspectSearchSavedSearchWithWorkflow[]
  activeSavedSearchId: string | null
  refreshing?: boolean
  onRestore: (id: string) => void
  onRefreshCounts: (id?: string) => void
  onDelete: (id: string) => void
}) {
  if (savedSearches.length === 0) return null

  return (
    <div
      className="rounded-xl border border-border/70 bg-muted/20 p-3"
      data-qa-marker={GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved workflows</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => onRefreshCounts()}
          disabled={refreshing}
          aria-label="Refresh saved search counts"
        >
          {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </Button>
      </div>

      <ul className="space-y-2">
        {savedSearches.map((saved) => {
          const delta = formatSavedSearchCountDelta(saved.workflow.countDelta)
          const active = activeSavedSearchId === saved.id

          return (
            <li key={saved.id}>
              <div
                className={cn(
                  "rounded-lg border px-2.5 py-2 transition-colors",
                  active ? "border-violet-300 bg-violet-50/70" : "border-border/60 bg-background/80 hover:border-violet-200",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onRestore(saved.id)}
                  >
                    <p className="truncate text-sm font-medium">{saved.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        {saved.workflow.resultCount != null
                          ? `${saved.workflow.resultCount.toLocaleString()} results`
                          : "— results"}
                      </span>
                      {delta ? (
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            saved.workflow.countDelta! > 0 ? "text-emerald-700" : "text-rose-700",
                          )}
                        >
                          {delta}
                        </span>
                      ) : null}
                      <span>· {formatSavedSearchRefreshedAt(saved.workflow.lastRefreshedAt)}</span>
                      {saved.workflow.ownerLabel ? <span>· {saved.workflow.ownerLabel}</span> : null}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => onRefreshCounts(saved.id)}
                      disabled={refreshing}
                      aria-label={`Refresh count for ${saved.name}`}
                    >
                      <RefreshCw className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-rose-700"
                      onClick={() => onDelete(saved.id)}
                      aria-label={`Delete ${saved.name}`}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  <WorkflowLink href={GROWTH_SAVED_SEARCH_WORKFLOW_LINKS.leadInbox} label="Inbox" />
                  <WorkflowLink href={GROWTH_SAVED_SEARCH_WORKFLOW_LINKS.leadEngine} label="Research" />
                  <WorkflowLink href={GROWTH_SAVED_SEARCH_WORKFLOW_LINKS.unifiedInbox} label="Replies" />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function WorkflowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-violet-200 hover:text-foreground"
    >
      {label}
    </Link>
  )
}
