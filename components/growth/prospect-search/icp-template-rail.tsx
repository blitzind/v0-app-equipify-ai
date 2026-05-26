"use client"

import { Plus, Sparkles } from "lucide-react"
import { PROSPECT_SEARCH_ICP_TEMPLATES } from "@/components/growth/prospect-search/prospect-search-ux-constants"
import type { ProspectSearchIcpTemplate } from "@/components/growth/prospect-search/prospect-search-ux-constants"
import { cn } from "@/lib/utils"

export function IcpTemplateRail({
  activeTemplateId,
  onSelectTemplate,
  onCreateCustom,
  savedSearches,
  lists,
  onLoadSavedSearch,
}: {
  activeTemplateId: string | null
  onSelectTemplate: (template: ProspectSearchIcpTemplate) => void
  onCreateCustom: () => void
  savedSearches: Array<{ id: string; name: string }>
  lists: Array<{ id: string; name: string; member_count: number }>
  onLoadSavedSearch: (id: string) => void
}) {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-card/80 p-4 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-600" />
          <h2 className="text-sm font-semibold">Starter ICP Templates</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Click a template to auto-fill filters — then refine and search.
        </p>
      </div>

      <ul className="space-y-2">
        {PROSPECT_SEARCH_ICP_TEMPLATES.map((tpl) => (
          <li key={tpl.id}>
            <button
              type="button"
              onClick={() => onSelectTemplate(tpl)}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                activeTemplateId === tpl.id
                  ? "border-violet-300 bg-violet-50/80 shadow-sm"
                  : "border-border hover:border-violet-200 hover:bg-muted/40",
              )}
            >
              <p className="text-sm font-medium">{tpl.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCreateCustom}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-violet-300 hover:text-foreground"
      >
        <Plus className="size-4" />
        Create Custom ICP
      </button>

      {savedSearches.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saved searches
          </h3>
          <ul className="mt-2 space-y-1">
            {savedSearches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() => onLoadSavedSearch(s.id)}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lists.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lists</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {lists.map((l) => (
              <li key={l.id} className="px-2">
                {l.name} <span className="text-xs">({l.member_count})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}
