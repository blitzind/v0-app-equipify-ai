"use client"

import { Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { formatDisplayPhone } from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type { CallWorkspaceLeadSearchResult } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { resolveCallWorkspaceAttachLeadId } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"

export function CallWorkspaceLeadSearchResultRow({
  hit,
  attaching,
  onSelect,
}: {
  hit: CallWorkspaceLeadSearchResult
  attaching: boolean
  onSelect: () => void
}) {
  const attachable = Boolean(resolveCallWorkspaceAttachLeadId(hit))

  return (
    <li>
      <button
        type="button"
        data-qa-action="call-workspace-lead-search-result"
        disabled={attaching}
        onClick={onSelect}
        className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 text-xs">
          <span className="col-span-2 truncate text-sm font-medium">{hit.displayName}</span>
          <span className="truncate text-muted-foreground">{hit.companyName}</span>
          <GrowthBadge label={hit.source.replace(/_/g, " ")} tone="neutral" />
          <span className="truncate text-muted-foreground">{hit.email ?? hit.contactEmail ?? "—"}</span>
          <span className="col-span-2 truncate text-muted-foreground">
            {hit.phone ?? hit.contactPhone ? formatDisplayPhone(hit.phone ?? hit.contactPhone ?? "") : "—"}
          </span>
          {!attachable ? (
            <span className="col-span-2 text-[10px] text-muted-foreground">Dial only — no Growth lead to attach yet</span>
          ) : null}
        </div>
      </button>
    </li>
  )
}

export function CallWorkspaceLeadSearchResultsPanel({
  searching,
  searchError,
  searchResults,
  showEmpty,
  attachingId,
  autoSelectedLeadId,
  attachError,
  createProspectHref,
  onSelect,
}: {
  searching: boolean
  searchError: string | null
  searchResults: CallWorkspaceLeadSearchResult[]
  showEmpty: boolean
  attachingId: string | null
  autoSelectedLeadId: string | null
  attachError: string | null
  createProspectHref: string
  onSelect: (hit: CallWorkspaceLeadSearchResult) => void
}) {
  return (
    <>
      {searching ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Searching Growth leads, prospects, contacts, accounts…
        </p>
      ) : null}
      {searchResults.length > 0 ? (
        <div
          className="rounded-lg border border-border/60 dark:border-white/10"
          data-qa-action="call-workspace-lead-search-results"
        >
          <div className="grid grid-cols-2 gap-2 border-b border-border/60 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:border-white/10">
            <span>Name / Company</span>
            <span className="text-right">Email / Phone</span>
          </div>
          <ul className="max-h-56 overflow-auto p-1">
            {searchResults.map((hit) => (
              <CallWorkspaceLeadSearchResultRow
                key={`${hit.source}:${hit.id}`}
                hit={hit}
                attaching={attachingId === (resolveCallWorkspaceAttachLeadId(hit) ?? hit.id)}
                onSelect={() => onSelect(hit)}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {searchError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {searchError === "Search failed." ? "Search failed. Try again." : searchError}
        </p>
      ) : null}
      {showEmpty ? (
        <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center dark:border-white/10">
          <p className="text-sm font-medium">No matching lead found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a partial company name, contact name, email, or normalized phone.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
            <Link href={createProspectHref}>Create Prospect</Link>
          </Button>
        </div>
      ) : null}
      {autoSelectedLeadId ? (
        <p className="text-xs text-muted-foreground">Auto-attaching high-confidence match…</p>
      ) : null}
      {attachError ? <p className="text-xs text-destructive">{attachError}</p> : null}
    </>
  )
}
