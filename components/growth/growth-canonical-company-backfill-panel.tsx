"use client"

import { useState } from "react"
import { Loader2, Play, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM } from "@/lib/growth/canonical-companies/canonical-company-backfill-api"
import { GROWTH_CANONICAL_COMPANY_QA_MARKER } from "@/lib/growth/canonical-companies/canonical-company-types"

type BackfillApiResponse = {
  ok?: boolean
  mode?: string
  reason?: string
  error?: string
  message?: string
  duration_ms?: number
  warnings?: string[]
  summary?: {
    canonical_companies_existing?: number
    canonical_companies_after?: number
    merge_groups_by_domain?: number
    skipped_already_linked?: number
    would_create_new?: number
  }
  stats?: Record<string, unknown>
}

export function GrowthCanonicalCompanyBackfillPanel() {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BackfillApiResponse | null>(null)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  async function runBackfill(mode: "dry_run" | "apply") {
    setRunning(true)
    setError(null)
    try {
      const body =
        mode === "apply"
          ? { mode, confirm: GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM }
          : { mode: "dry_run" }

      const res = await fetch("/api/platform/growth/canonical-companies/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as BackfillApiResponse
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.reason ?? data.error ?? "Backfill request failed.")
      }
      setResult(data)
      if (mode === "apply") {
        setShowApplyConfirm(false)
        setConfirmText("")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backfill request failed.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <GrowthEngineCard title="Canonical companies (7.2A)">
      <div
        className="space-y-4"
        data-qa-marker={GROWTH_CANONICAL_COMPANY_QA_MARKER}
      >
        <p className="text-sm text-muted-foreground">
          Link staging company candidates to <code className="text-xs">growth.companies</code> via the
          production backfill engine. Dry run reports stats only; apply writes canonical rows and lineage.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={running}
            onClick={() => void runBackfill("dry_run")}
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
              onClick={() => void runBackfill("apply")}
            >
              Confirm apply
            </Button>
          </div>
        ) : null}

        {result?.ok ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              <GrowthBadge label={result.mode ?? "unknown"} tone={result.mode === "apply" ? "attention" : "neutral"} />
              {typeof result.duration_ms === "number" ? (
                <GrowthBadge label={`${result.duration_ms} ms`} tone="neutral" />
              ) : null}
            </div>
            {result.summary ? (
              <p>
                Existing {result.summary.canonical_companies_existing ?? 0} → after{" "}
                {result.summary.canonical_companies_after ?? 0} · merge groups{" "}
                {result.summary.merge_groups_by_domain ?? 0} · skipped linked{" "}
                {result.summary.skipped_already_linked ?? 0} · would create{" "}
                {result.summary.would_create_new ?? 0}
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
