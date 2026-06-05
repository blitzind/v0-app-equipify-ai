"use client"

import { Eye } from "lucide-react"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import type { ProspectSearchWorkspaceExecutionPreview } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_EXECUTION_PREVIEW_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

export function ProspectSearchWorkspaceExecutionPreviewCard({
  preview,
  className,
}: {
  preview: ProspectSearchWorkspaceExecutionPreview | null
  className?: string
}) {
  if (!preview || preview.selected_account_count === 0) {
    return (
      <section
        className={className}
        data-qa-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER}
        data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER}
        data-workspace-execution-preview="v1"
      >
        <h4 className="text-sm font-semibold text-slate-950">
          {PROSPECT_SEARCH_WORKSPACE_EXECUTION_PREVIEW_TITLE}
        </h4>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Select accounts and a research queue to preview PS-C planner output. No jobs are enqueued.
        </p>
      </section>
    )
  }

  return (
    <section
      className={className}
      data-qa-marker={preview.qa_marker}
      data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER}
      data-workspace-execution-preview="v1"
    >
      <div className="flex items-center gap-2">
        <Eye className="size-4 text-slate-800" />
        <h4 className="text-sm font-semibold text-slate-950">
          {PROSPECT_SEARCH_WORKSPACE_EXECUTION_PREVIEW_TITLE}
        </h4>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{preview.planner_note}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["Accounts", preview.affected_account_count],
            ["Contacts", preview.affected_contact_count],
            ["Canonical companies", preview.affected_canonical_company_count],
            ["Canonical persons", preview.affected_canonical_person_count],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-slate-100 bg-white/80 px-2 py-1.5 text-xs"
          >
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="font-semibold tabular-nums text-slate-950">{value}</p>
          </div>
        ))}
      </div>
      {preview.recommended_action_kinds.length > 0 ? (
        <p className="mt-2 text-xs text-slate-800">
          <span className="font-medium">Recommended kinds: </span>
          {preview.recommended_action_kinds.join(", ")}
        </p>
      ) : null}
      <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
        {preview.accounts.map((account) => (
          <li
            key={account.company_key}
            className="rounded-md border border-slate-100 bg-white/80 px-2 py-1.5"
          >
            <p className="font-medium text-slate-950">{account.company_name}</p>
            {account.recommended_action_kinds.length > 0 ? (
              <p className="text-[10px] text-slate-700">
                Actions: {account.recommended_action_kinds.join(", ")}
              </p>
            ) : null}
            {account.blocked_reasons.length > 0 ? (
              <p className="text-[10px] text-amber-800">
                Blocked: {account.blocked_reasons.join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
