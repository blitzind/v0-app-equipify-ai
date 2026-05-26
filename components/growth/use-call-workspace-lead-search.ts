"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  CallWorkspaceLeadSearchDiagnostics,
  CallWorkspaceLeadSearchResult,
} from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { resolveCallWorkspaceAttachLeadId } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import { normalizeDialPhoneDigits } from "@/lib/growth/native-dialer/native-dialer-workspace-ui"

function parseSearchResponse(data: {
  ok?: boolean
  results?: CallWorkspaceLeadSearchResult[]
  leads?: CallWorkspaceLeadSearchResult[]
  entities?: CallWorkspaceLeadSearchResult[]
  diagnostics?: CallWorkspaceLeadSearchDiagnostics
  message?: string
}): CallWorkspaceLeadSearchResult[] {
  return data.results ?? data.leads ?? data.entities ?? []
}

export function useCallWorkspaceLeadSearch(input: {
  nativeSessionId?: string | null
  leadContextAttached?: boolean
  onLeadAttached?: (leadId: string, session?: NativeCallWorkspaceSessionPublicView) => void
  onEntitySelected?: (hit: CallWorkspaceLeadSearchResult) => void
  autoAttachDelayMs?: number
}) {
  const {
    nativeSessionId,
    leadContextAttached = false,
    onLeadAttached,
    onEntitySelected,
    autoAttachDelayMs = 700,
  } = input

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<CallWorkspaceLeadSearchResult[]>([])
  const [searchDiagnostics, setSearchDiagnostics] = useState<CallWorkspaceLeadSearchDiagnostics | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const autoAttachRef = useRef<string | null>(null)
  const searchRequestIdRef = useRef(0)

  const attachLead = useCallback(
    async (leadId: string) => {
      if (!nativeSessionId) return false
      setAttachingId(leadId)
      setAttachError(null)
      try {
        const res = await fetch(`/api/platform/growth/calls/sessions/${nativeSessionId}/attach-lead`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          session?: NativeCallWorkspaceSessionPublicView
          message?: string
        }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not attach lead.")
        onLeadAttached?.(leadId, data.session)
        setSearchQuery("")
        setSearchResults([])
        setSearchDiagnostics(null)
        return true
      } catch (e) {
        setAttachError(e instanceof Error ? e.message : "Attach failed.")
        return false
      } finally {
        setAttachingId(null)
      }
    },
    [nativeSessionId, onLeadAttached],
  )

  const selectHit = useCallback(
    async (hit: CallWorkspaceLeadSearchResult) => {
      onEntitySelected?.(hit)
      const attachId = resolveCallWorkspaceAttachLeadId(hit)
      if (attachId && nativeSessionId && !leadContextAttached) {
        await attachLead(attachId)
      }
    },
    [attachLead, leadContextAttached, nativeSessionId, onEntitySelected],
  )

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSearchResults([])
      setSearchDiagnostics(null)
      setSearchError(null)
      return
    }

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId
    const url = `/api/platform/growth/calls/workspace/leads/search?q=${encodeURIComponent(trimmed)}`

    setSearching(true)
    setSearchError(null)

    if (process.env.NODE_ENV !== "production") {
      console.info("[native-dialer-lead-search] request", { query: trimmed, url })
    }

    try {
      const res = await fetch(url, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        results?: CallWorkspaceLeadSearchResult[]
        leads?: CallWorkspaceLeadSearchResult[]
        entities?: CallWorkspaceLeadSearchResult[]
        diagnostics?: CallWorkspaceLeadSearchDiagnostics
        message?: string
      }

      if (searchRequestIdRef.current !== requestId) return

      const results = parseSearchResponse(data)
      const first = results[0]

      if (process.env.NODE_ENV !== "production") {
        console.info("[native-dialer-lead-search] response", {
          query: trimmed,
          status: res.status,
          ok: data.ok,
          resultCount: results.length,
          firstDisplay: first?.displayName ?? null,
          firstCompany: first?.companyName ?? null,
          firstSource: first?.source ?? null,
        })
      }

      if (!res.ok || data.ok === false) {
        throw new Error(data.message ?? "Search failed.")
      }

      setSearchResults(results)
      setSearchDiagnostics(data.diagnostics ?? null)
      if (data.diagnostics) {
        console.info("[native-dialer-lead-search]", data.diagnostics)
      }
    } catch (e) {
      if (searchRequestIdRef.current !== requestId) return
      setSearchResults([])
      setSearchDiagnostics(null)
      setSearchError(e instanceof Error ? e.message : "Search failed. Try again.")
    } finally {
      if (searchRequestIdRef.current === requestId) {
        setSearching(false)
      }
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => void runSearch(searchQuery), 300)
    return () => window.clearTimeout(id)
  }, [searchQuery, runSearch])

  useEffect(() => {
    const autoId = searchDiagnostics?.autoSelectedLeadId
    if (!autoId || !nativeSessionId || leadContextAttached || searchResults.length === 0) return
    if (autoAttachRef.current === autoId) return

    const timer = window.setTimeout(() => {
      if (autoAttachRef.current === autoId) return
      autoAttachRef.current = autoId
      void attachLead(autoId)
    }, autoAttachDelayMs)

    return () => window.clearTimeout(timer)
  }, [
    searchDiagnostics?.autoSelectedLeadId,
    searchResults.length,
    nativeSessionId,
    leadContextAttached,
    attachLead,
    autoAttachDelayMs,
  ])

  const showEmpty =
    searchQuery.trim().length >= 2 && !searching && !searchError && searchResults.length === 0 && !attachError

  const createProspectHref = `/admin/growth/leads?${new URLSearchParams({
    ...(searchQuery.trim() ? { companyName: searchQuery.trim() } : {}),
  }).toString()}`

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchDiagnostics,
    searching,
    searchError,
    attachingId,
    attachError,
    showEmpty,
    createProspectHref,
    selectHit,
    attachLead,
    applyPhoneFromHit: (hit: CallWorkspaceLeadSearchResult) => {
      const digits = normalizeDialPhoneDigits(hit.phone ?? hit.contactPhone ?? "")
      return digits
    },
  }
}
