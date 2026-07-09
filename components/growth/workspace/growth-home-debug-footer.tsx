"use client"

import { useEffect, useState } from "react"
import { GROWTH_HOME_DEBUG_SOURCE_API_PATH } from "@/lib/growth/home/growth-home-workspace-api-contract"

type DebugSourceSummary = {
  generated_at?: string
  runtime?: {
    supabase_project_ref?: string | null
    git_sha?: string | null
  }
  deployment?: {
    git_sha?: string | null
  }
  data_source?: {
    live_db?: boolean
    uses_fallback?: boolean
    integrity_mismatch?: boolean
    note?: string
  }
  home_ui_metrics?: Record<string, number>
  table_count_total?: number
}

const HOME_DEBUG_FOOTER_ENABLED = process.env.NODE_ENV !== "production"

export function GrowthHomeDebugFooter() {
  const [summary, setSummary] = useState<DebugSourceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!HOME_DEBUG_FOOTER_ENABLED) return

    let cancelled = false

    void (async () => {
      try {
        const res = await fetch(GROWTH_HOME_DEBUG_SOURCE_API_PATH, { cache: "no-store" })
        const data = (await res.json().catch(() => ({}))) as DebugSourceSummary & { error?: string }
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? `HTTP ${res.status}`)
          return
        }
        if (!cancelled) {
          setSummary(data)
          console.info("[growth/home/debug-source]", data)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load debug source.")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (!HOME_DEBUG_FOOTER_ENABLED) return null

  if (error) {
    return (
      <footer
        className="mt-8 rounded-lg border border-dashed border-amber-300/80 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-950"
        data-qa-marker="growth-home-debug-footer"
        data-debug-error={error}
      >
        Home debug source unavailable ({error})
      </footer>
    )
  }
  if (!summary) return null

  const gitSha = summary.deployment?.git_sha ?? summary.runtime?.git_sha ?? "unknown"
  const projectRef = summary.runtime?.supabase_project_ref ?? "unknown"
  const dataMode = summary.data_source?.integrity_mismatch
    ? "MISMATCH"
    : summary.data_source?.live_db
      ? "LIVE_DB"
      : summary.data_source?.uses_fallback
        ? "FALLBACK"
        : "EMPTY"

  return (
    <footer
      className="mt-8 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2 font-mono text-[11px] text-muted-foreground"
      data-qa-marker="growth-home-debug-footer"
      data-debug-project-ref={projectRef}
      data-debug-git-sha={gitSha}
      data-debug-data-mode={dataMode}
    >
      <p>
        Home debug · project <span className="text-foreground">{projectRef}</span> · sha{" "}
        <span className="text-foreground">{gitSha.slice(0, 8)}</span> · fetched{" "}
        <span className="text-foreground">{summary.generated_at ?? "unknown"}</span> · source{" "}
        <span className="text-foreground">{dataMode}</span>
        {typeof summary.table_count_total === "number" ? (
          <>
            {" "}
            · db rows <span className="text-foreground">{summary.table_count_total}</span>
          </>
        ) : null}
      </p>
      {summary.data_source?.note ? <p className="mt-1 opacity-80">{summary.data_source.note}</p> : null}
    </footer>
  )
}
