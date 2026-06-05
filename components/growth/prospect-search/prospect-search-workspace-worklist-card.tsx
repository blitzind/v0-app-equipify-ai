"use client"

import { ClipboardList } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import type { ProspectSearchWorkspaceWorklist } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_WORKLIST_FIELD_LABELS,
  PROSPECT_SEARCH_WORKSPACE_WORKLIST_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

function formatFieldValue(value: string | number | string[] | null): string {
  if (value == null) return "—"
  if (Array.isArray(value)) return value.join(" · ")
  return String(value)
}

export function ProspectSearchWorkspaceWorklistCard({
  worklist,
  selectedKeys,
  onToggleAccount,
  className,
}: {
  worklist: ProspectSearchWorkspaceWorklist | null
  selectedKeys: Set<string>
  onToggleAccount?: (companyKey: string, selected: boolean) => void
  className?: string
}) {
  if (!worklist || worklist.account_count === 0) return null

  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER}
      data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER}
      data-workspace-worklist="v1"
    >
      <div className="flex items-center gap-2">
        <ClipboardList className="size-4 text-slate-800" />
        <h4 className="text-sm font-semibold text-slate-950">{PROSPECT_SEARCH_WORKSPACE_WORKLIST_TITLE}</h4>
        <span className="text-xs text-muted-foreground">
          {worklist.label} · {worklist.account_count}
        </span>
      </div>
      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {worklist.rows.map((row) => {
          const checked = selectedKeys.has(row.company_key)
          return (
            <li
              key={row.company_key}
              className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs"
            >
              <div className="flex items-start gap-2">
                {onToggleAccount ? (
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      onToggleAccount(row.company_key, value === true)
                    }
                    aria-label={`Select ${row.company_name}`}
                    className="mt-0.5"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-950">{row.company_name}</p>
                  <dl className="mt-1 space-y-0.5">
                    {Object.entries(row.fields).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="shrink-0 text-[10px] text-muted-foreground">
                          {PROSPECT_SEARCH_WORKSPACE_WORKLIST_FIELD_LABELS[key] ?? key}:
                        </dt>
                        <dd className="min-w-0 text-[10px] text-slate-800">
                          {formatFieldValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
