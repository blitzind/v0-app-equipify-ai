"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GlobalSearchGroup } from "@/lib/global-search/run-global-search"
import {
  GROWTH_WORKSPACE_SEARCH_EMPTY_HINT,
  GROWTH_WORKSPACE_SEARCH_PLACEHOLDER,
  GROWTH_WORKSPACE_SEARCH_QA_MARKER,
} from "@/lib/workspace/growth-workspace-search-categories"
import { runGrowthWorkspaceSearchClient } from "@/lib/workspace/run-growth-workspace-search-client"
import {
  GlobalSearchPanel,
  WORKSPACE_SEARCH_DEBOUNCE_MS,
} from "@/components/workspace/global-search-panel"
import {
  WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_CORE,
  WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_GROWTH,
} from "@/lib/workspace/workspace-search-interactions"

export const WORKSPACE_SEARCH_QA_MARKER = "workspace-search-v1" as const

type WorkspaceSearchCoreProps = {
  workspace: "core"
  organizationId: string | null
  orgReady: boolean
}

type WorkspaceSearchGrowthProps = {
  workspace: "growth"
}

export type WorkspaceSearchProps = WorkspaceSearchCoreProps | WorkspaceSearchGrowthProps

export function WorkspaceSearch(props: WorkspaceSearchProps) {
  if (props.workspace === "core") {
    return <WorkspaceSearchCore organizationId={props.organizationId} orgReady={props.orgReady} />
  }
  return <WorkspaceSearchGrowth />
}

function WorkspaceSearchCore({ organizationId, orgReady }: Omit<WorkspaceSearchCoreProps, "workspace">) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const runSearch = useCallback(
    async (q: string) => {
      if (!organizationId || !orgReady || q.trim().length < 2) {
        setGroups([])
        setFetchError(null)
        setLoading(false)
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setFetchError(null)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/global-search?q=${encodeURIComponent(q)}`,
          { signal: ac.signal, cache: "no-store" },
        )
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          groups?: GlobalSearchGroup[]
          message?: string
        }
        if (!res.ok) {
          setGroups([])
          setFetchError(body.message ?? "Search failed.")
          return
        }
        setGroups(body.groups ?? [])
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return
        setGroups([])
        setFetchError("Search failed.")
      } finally {
        setLoading(false)
      }
    },
    [organizationId, orgReady],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setGroups([])
      setFetchError(null)
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query)
    }, WORKSPACE_SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const disabled = !organizationId || !orgReady

  return (
    <GlobalSearchPanel
      disabled={disabled}
      disabledPlaceholder={
        organizationId ? "Loading workspace…" : "Select a workspace to search"
      }
      placeholder="Search customers, equipment, work orders…"
      emptyHint="Try a customer name, equipment code, work order #, or invoice number."
      groups={groups}
      loading={loading}
      fetchError={fetchError}
      query={query}
      onQueryChange={setQuery}
      onRetry={() => void runSearch(query.trim())}
      qaMarker={WORKSPACE_SEARCH_QA_MARKER}
      keyboardShortcutEnabled={WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_CORE}
    />
  )
}

function WorkspaceSearchGrowth() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setGroups([])
      setFetchError(null)
      setLoading(false)
      return
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setFetchError(null)
    try {
      const nextGroups = await runGrowthWorkspaceSearchClient(q, ac.signal)
      setGroups(nextGroups)
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return
      setGroups([])
      setFetchError("Search failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setGroups([])
      setFetchError(null)
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query)
    }, WORKSPACE_SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return (
    <GlobalSearchPanel
      placeholder={GROWTH_WORKSPACE_SEARCH_PLACEHOLDER}
      emptyHint={GROWTH_WORKSPACE_SEARCH_EMPTY_HINT}
      groups={groups}
      loading={loading}
      fetchError={fetchError}
      query={query}
      onQueryChange={setQuery}
      onRetry={() => void runSearch(query.trim())}
      qaMarker={GROWTH_WORKSPACE_SEARCH_QA_MARKER}
      keyboardShortcutEnabled={WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_GROWTH}
    />
  )
}
