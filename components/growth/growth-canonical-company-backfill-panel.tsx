"use client"

import { useState } from "react"
import { Loader2, Play, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM,
  mergeCanonicalCompanyBackfillErrorRows,
  mergeCanonicalCompanyBackfillStats,
} from "@/lib/growth/canonical-companies/canonical-company-backfill-api"
import {
  GROWTH_CANONICAL_COMPANY_QA_MARKER,
  type GrowthCanonicalCompanyBackfillErrorRow,
  type GrowthCanonicalCompanyBackfillStats,
} from "@/lib/growth/canonical-companies/canonical-company-types"

type BackfillApiResponse = {
  ok?: boolean
  done?: boolean
  certification?: "pass" | "conditional_pass" | "fail" | null
  cursor?: unknown
  mode?: string
  reason?: string
  error?: string
  message?: string
  duration_ms?: number
  pending_total?: number
  pending_by_source?: Record<string, number>
  errors?: number
  error_rows?: GrowthCanonicalCompanyBackfillErrorRow[]
  warnings?: string[]
  verification?: { passed?: boolean; pending_total?: number }
  progress?: { processed_in_chunk?: number; batch_size?: number; current_source_table?: string }
  summary?: {
    canonical_companies_after?: number
    errors?: number
    error_row_count?: number
  }
  stats?: GrowthCanonicalCompanyBackfillStats
}

export function GrowthCanonicalCompanyBackfillPanel() {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BackfillApiResponse | null>(null)
  const [chunkLabel, setChunkLabel] = useState<string | null>(null)
  const [errorRows, setErrorRows] = useState<GrowthCanonicalCompanyBackfillErrorRow[]>([])
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  const isCertifiedDone =
    result?.done === true &&
    result.certification === "pass" &&
    (result.pending_total ?? 1) === 0 &&
    (result.verification?.passed ?? false)

  async function runBackfillChunks(mode: "dry_run" | "apply") {
    setRunning(true)
    setError(null)
    setChunkLabel(null)
    setErrorRows([])

    let cursor: unknown = null
    let cumulative: GrowthCanonicalCompanyBackfillStats | null = null
    let cumulativeErrors: GrowthCanonicalCompanyBackfillErrorRow[] = []
    let chunks = 0
    let lastResponse: BackfillApiResponse | null = null

    try {
      for (;;) {
        chunks++
        const body: Record<string, unknown> = {
          mode,
          batch_size: 40,
          cursor,
        }
        if (mode === "apply") {
          body.confirm = GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM
        }

        const res = await fetch("/api/platform/growth/canonical-companies/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as BackfillApiResponse
        if (!res.ok || !data.ok || !data.stats) {
          throw new Error(data.message ?? data.reason ?? data.error ?? "Backfill request failed.")
        }

        cumulative = cumulative
          ? mergeCanonicalCompanyBackfillStats(cumulative, data.stats)
          : data.stats
        cumulativeErrors = mergeCanonicalCompanyBackfillErrorRows(
          cumulativeErrors,
          data.error_rows ?? [],
        )
        setErrorRows(cumulativeErrors)
        lastResponse = data

        setChunkLabel(
          `Chunk ${chunks}: ${data.progress?.processed_in_chunk ?? 0} processed · pending ${data.pending_total ?? "?"} · ${data.progress?.current_source_table ?? ""}`,
        )

        if (data.done) {
          setResult({
            ...data,
            stats: cumulative,
            error_rows: cumulativeErrors,
          })
          break
        }

        cursor = data.cursor ?? null
        if (!cursor) {
          throw new Error("Backfill incomplete but no cursor returned.")
        }
      }

      if (mode === "apply" && lastResponse && !lastResponse.done) {
        setError(
          `Apply stopped with ${lastResponse.pending_total ?? "?"} unlinked staging rows remaining. Re-run apply to continue.`,
        )
      }

      if (mode === "apply") {
        setShowApplyConfirm(false)
        setConfirmText("")
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message}${cumulative ? " (partial progress saved — re-run apply to resume)" : ""}`
          : "Backfill request failed.",
      )
      if (cumulative && lastResponse) {
        setResult({
          ...lastResponse,
          ok: true,
          mode,
          stats: cumulative,
          error_rows: cumulativeErrors,
          done: false,
        })
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <GrowthEngineCard title="Canonical companies (7.2A)">
      <div className="space-y-4" data-qa-marker={GROWTH_CANONICAL_COMPANY_QA_MARKER}>
        <p className="text-sm text-muted-foreground">
          Batched, resume-safe linkage into <code className="text-xs">growth.companies</code>. DONE only when
          verification reports <code className="text-xs">pending_total = 0</code> across all staging tables.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={running}
            onClick={() => void runBackfillChunks("dry_run")}
          >
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}
            Run dry run
          </Button>
          <Button
            size="sm"
            variant={showApplyConfirm ? "secondary" : "default"}
            disabled={running}
            onClick={() => setShowApplyConfirm((v) => !v)}
          >
            <Play className="mr-2 size-4" />
            Run apply
          </Button>
        </div>

        {showApplyConfirm ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Type the confirmation string exactly to apply writes:
            </p>
            <p className="mt-1 font-mono text-xs text-amber-800 dark:text-amber-200">
              {GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM}
            </p>
            <Input
              className="mt-3 max-w-md"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Confirmation string"
              autoComplete="off"
            />
            <Button
              className="mt-3"
              size="sm"
              disabled={running || confirmText !== GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM}
              onClick={() => void runBackfillChunks("apply")}
            >
              Confirm apply
            </Button>
          </div>
        ) : null}

        {chunkLabel ? <p className="text-sm text-muted-foreground">{chunkLabel}</p> : null}

        {result?.ok ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              <GrowthBadge label={result.mode ?? "unknown"} tone={result.mode === "apply" ? "attention" : "neutral"} />
              {isCertifiedDone ? (
                <GrowthBadge label="DONE · certified" tone="healthy" />
              ) : result.done ? (
                <GrowthBadge label={`done · ${result.certification ?? "unverified"}`} tone="attention" />
              ) : (
                <GrowthBadge label="in progress" tone="attention" />
              )}
              {typeof result.pending_total === "number" ? (
                <GrowthBadge label={`pending ${result.pending_total}`} tone={result.pending_total === 0 ? "healthy" : "attention"} />
              ) : null}
              {(result.errors ?? 0) > 0 ? (
                <GrowthBadge label={`errors ${result.errors}`} tone="attention" />
              ) : null}
            </div>
            <p>
              Canonical companies in DB: {result.stats?.canonical_companies_after ?? result.summary?.canonical_companies_after ?? "—"}
              {result.pending_by_source ? (
                <>
                  {" "}
                  · RW pending {result.pending_by_source.real_world_company_candidates ?? 0} · external{" "}
                  {result.pending_by_source.external_company_candidates ?? 0} · discovery{" "}
                  {result.pending_by_source.discovery_candidates ?? 0}
                </>
              ) : null}
            </p>
            {result.warnings?.length ? (
              <ul className="list-disc pl-5 text-amber-800 dark:text-amber-200">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {errorRows.length > 0 ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">Failed rows ({errorRows.length})</p>
            <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-destructive">
              {errorRows.slice(0, 20).map((row) => (
                <li key={`${row.source_table}:${row.source_id}`}>
                  {row.source_table} {row.source_id}: {row.message}
                </li>
              ))}
            </ul>
            {errorRows.length > 20 ? (
              <p className="mt-1 text-xs text-muted-foreground">Showing first 20 errors.</p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </GrowthEngineCard>
  )
}
