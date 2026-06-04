"use client"

import { useState } from "react"
import { Loader2, Play, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM,
  mergeCanonicalCompanyBackfillStats,
} from "@/lib/growth/canonical-companies/canonical-company-backfill-api"
import {
  GROWTH_CANONICAL_COMPANY_QA_MARKER,
  type GrowthCanonicalCompanyBackfillCursor,
  type GrowthCanonicalCompanyBackfillStats,
} from "@/lib/growth/canonical-companies/canonical-company-types"

type BackfillApiResponse = {
  ok?: boolean
  done?: boolean
  cursor?: GrowthCanonicalCompanyBackfillCursor | null
  mode?: string
  reason?: string
  error?: string
  message?: string
  duration_ms?: number
  warnings?: string[]
  progress?: { processed_in_chunk?: number; batch_size?: number; current_source_table?: string }
  summary?: {
    canonical_companies_existing?: number
    canonical_companies_after?: number
    merge_groups_by_domain?: number
    skipped_already_linked?: number
    would_create_new?: number
    processed_in_chunk?: number
    batch_size?: number
  }
  stats?: GrowthCanonicalCompanyBackfillStats
}

export function GrowthCanonicalCompanyBackfillPanel() {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BackfillApiResponse | null>(null)
  const [chunkLabel, setChunkLabel] = useState<string | null>(null)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  async function runBackfillChunks(mode: "dry_run" | "apply") {
    setRunning(true)
    setError(null)
    setChunkLabel(null)

    let cursor: GrowthCanonicalCompanyBackfillCursor | null = null
    let cumulative: GrowthCanonicalCompanyBackfillStats | null = null
    let chunks = 0

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

        setChunkLabel(
          `Chunk ${chunks}: ${data.progress?.processed_in_chunk ?? 0} rows · ${data.progress?.current_source_table ?? ""}${data.done ? " · complete" : ""}`,
        )

        if (data.done) {
          setResult({
            ...data,
            stats: cumulative,
            done: true,
          })
          break
        }

        cursor = data.cursor ?? null
        if (!cursor) {
          throw new Error("Backfill incomplete but no cursor returned.")
        }
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
      if (cumulative) {
        setResult({ ok: true, mode, stats: cumulative, done: false })
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <GrowthEngineCard title="Canonical companies (7.2A)">
      <div className="space-y-4" data-qa-marker={GROWTH_CANONICAL_COMPANY_QA_MARKER}>
        <p className="text-sm text-muted-foreground">
          Link staging company candidates to <code className="text-xs">growth.companies</code>. Runs in
          batches of 40 per request (resume-safe). Re-run apply after a timeout to continue from lineage +
          linked staging rows.
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
              {result.done ? <GrowthBadge label="done" tone="healthy" /> : <GrowthBadge label="partial" tone="attention" />}
            </div>
            {result.stats ? (
              <p>
                Processed {result.stats.sources.real_world_company_candidates.rows_processed} RW ·{" "}
                {result.stats.sources.external_company_candidates.rows_processed} external · after{" "}
                {result.stats.canonical_companies_after} companies · would create{" "}
                {result.stats.sources.real_world_company_candidates.would_create_new +
                  result.stats.sources.external_company_candidates.would_create_new +
                  result.stats.sources.discovery_candidates.would_create_new}
              </p>
            ) : null}
            {result.warnings?.length ? (
              <ul className="list-disc pl-5 text-amber-800 dark:text-amber-200">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </GrowthEngineCard>
  )
}
