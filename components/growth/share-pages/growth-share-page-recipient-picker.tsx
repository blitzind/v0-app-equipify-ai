"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Search, UserRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { CallWorkspaceLeadSearchResult } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { resolveCallWorkspaceAttachLeadId } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"

export type GrowthSharePageRecipientSelection = {
  leadId: string
  displayName: string
  companyName: string
  email: string | null
  fitScoreLabel: string
  lastActivityLabel: string
}

function parseSearchResponse(data: {
  ok?: boolean
  results?: CallWorkspaceLeadSearchResult[]
  leads?: CallWorkspaceLeadSearchResult[]
  entities?: CallWorkspaceLeadSearchResult[]
  message?: string
}): CallWorkspaceLeadSearchResult[] {
  return data.results ?? data.leads ?? data.entities ?? []
}

export function GrowthSharePageRecipientPicker({
  value,
  onChange,
}: {
  value: GrowthSharePageRecipientSelection | null
  onChange: (selection: GrowthSharePageRecipientSelection | null) => void
}) {
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CallWorkspaceLeadSearchResult[]>([])

  const runSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setResults([])
      setError(null)
      return
    }

    setSearching(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/calls/workspace/leads/search?q=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        results?: CallWorkspaceLeadSearchResult[]
        leads?: CallWorkspaceLeadSearchResult[]
        entities?: CallWorkspaceLeadSearchResult[]
        message?: string
      }
      if (!res.ok || data.ok === false) {
        throw new Error(data.message ?? "Search failed.")
      }
      setResults(parseSearchResponse(data))
    } catch (e) {
      setResults([])
      setError(e instanceof Error ? e.message : "Search failed.")
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => void runSearch(query), 300)
    return () => window.clearTimeout(id)
  }, [query, runSearch])

  function selectHit(hit: CallWorkspaceLeadSearchResult) {
    const leadId = resolveCallWorkspaceAttachLeadId(hit)
    if (!leadId) {
      setError("Select a record with a Growth lead attached, or promote the prospect first.")
      return
    }
    onChange({
      leadId,
      displayName: hit.displayName,
      companyName: hit.companyName,
      email: hit.email ?? hit.contactEmail,
      fitScoreLabel: hit.confidence ? `${Math.round(hit.confidence * 100)}% match` : "—",
      lastActivityLabel: hit.matchedField ? `Matched on ${hit.matchedField.replace(/_/g, " ")}` : "—",
    })
    setQuery("")
    setResults([])
  }

  if (value) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{value.displayName}</p>
            <p className="text-sm text-muted-foreground">{value.companyName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{value.email ?? "No email on file"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <GrowthBadge tone="neutral" label={`Fit: ${value.fitScoreLabel}`} />
              <GrowthBadge tone="neutral" label={value.lastActivityLabel} />
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => onChange(null)}
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="share-page-recipient-search">Search lead, company, or email</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="share-page-recipient-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a name, company, or email…"
            className="pl-9"
          />
        </div>
      </div>

      {searching ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Searching…
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {results.length > 0 ? (
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border">
          {results.map((hit) => (
            <li key={`${hit.source}-${hit.id}`}>
              <button
                type="button"
                onClick={() => selectHit(hit)}
                className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/60"
              >
                <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{hit.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{hit.companyName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {hit.email ?? hit.contactEmail ?? "—"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {query.trim().length >= 2 && !searching && results.length === 0 && !error ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No matching leads found. Try a different name, company, or email address.
        </div>
      ) : null}

      {query.trim().length < 2 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          Select a recipient to personalize this share page. Search by lead name, company, or email.
        </div>
      ) : null}
    </div>
  )
}
