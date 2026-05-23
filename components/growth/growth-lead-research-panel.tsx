"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { GrowthLeadResearchHistory } from "@/components/growth/growth-lead-research-history"
import { GrowthLeadResearchRunCard } from "@/components/growth/growth-lead-research-run-card"
import { GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { growthLeadResearchErrorMessage } from "@/lib/growth/research-error-messages"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthLeadResearchBundle, GrowthLeadResearchRun } from "@/lib/growth/research-types"

type GrowthLeadResearchPanelProps = {
  lead: GrowthLead
  onLeadUpdated?: (patch: Partial<GrowthLead>) => void
  onLatestRunChange?: (run: GrowthLeadResearchRun | null) => void
  id?: string
}

type ResearchApiPayload = GrowthLeadResearchBundle & {
  ok?: boolean
  message?: string
  error?: string
  run?: GrowthLeadResearchRun | null
  leadStatus?: GrowthLead["status"]
  leadScore?: number | null
  lead?: GrowthLead | null
  cached?: boolean
}

function mergeRunIntoBundle(
  prev: GrowthLeadResearchBundle | null,
  leadId: string,
  run: GrowthLeadResearchRun,
): GrowthLeadResearchBundle {
  const runs = prev?.runs ?? []
  const withoutDuplicate = runs.filter((item) => item.id !== run.id)
  const nextRuns = [run, ...withoutDuplicate]

  return {
    leadId,
    runs: nextRuns,
    latestRun: run.status === "succeeded" || run.status === "partial" ? run : (prev?.latestRun ?? null),
    manualNotes: prev?.manualNotes ?? null,
  }
}

function pickDisplayRun(bundle: GrowthLeadResearchBundle | null): GrowthLeadResearchRun | null {
  if (!bundle) return null
  if (bundle.latestRun) return bundle.latestRun
  return bundle.runs.find((run) => run.status === "failed" || run.status === "partial") ?? null
}

export function GrowthLeadResearchPanel({ lead, onLeadUpdated, onLatestRunChange, id }: GrowthLeadResearchPanelProps) {
  const [bundle, setBundle] = useState<GrowthLeadResearchBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cacheNotice, setCacheNotice] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState("")
  const [notesOpen, setNotesOpen] = useState(false)

  const loadResearch = useCallback(
    async (options?: { clearError?: boolean; silent?: boolean }) => {
      if (options?.clearError !== false) setError(null)
      if (!options?.silent) setLoading(true)

      try {
        const res = await fetch(`/api/platform/growth/leads/${lead.id}/research`, { cache: "no-store" })
        const data = (await res.json().catch(() => ({}))) as ResearchApiPayload
        if (!res.ok || !data.ok) {
          throw new Error(growthLeadResearchErrorMessage(data))
        }

        const nextBundle = {
          leadId: data.leadId,
          latestRun: data.latestRun ?? null,
          runs: data.runs ?? [],
          manualNotes: data.manualNotes ?? null,
        }
        setBundle(nextBundle)
        onLatestRunChange?.(nextBundle.latestRun ?? pickDisplayRun(nextBundle))
        setNotesDraft(data.manualNotes?.body ?? "")
      } catch (e) {
        if (!options?.silent) {
          setError(e instanceof Error ? e.message : "Could not load research.")
        }
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [lead.id, onLatestRunChange],
  )

  useEffect(() => {
    void loadResearch()
  }, [loadResearch])

  async function generateResearch(regenerate = false) {
    setGenerating(true)
    setError(null)
    setCacheNotice(null)

    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      })
      const data = (await res.json().catch(() => ({}))) as ResearchApiPayload

      if (!res.ok || !data.ok) {
        setError(growthLeadResearchErrorMessage(data))
        if (data.run) {
          setBundle((prev) => {
            const merged = mergeRunIntoBundle(prev, lead.id, data.run!)
            onLatestRunChange?.(merged.latestRun ?? data.run ?? null)
            return merged
          })
        }
        await loadResearch({ clearError: false, silent: true })
        return
      }

      if (!data.run) {
        setError("Research completed but no run payload was returned.")
        await loadResearch({ clearError: false, silent: true })
        return
      }

      if (data.cached) {
        setCacheNotice("Returned cached research from the last 30 days — no new AI run.")
      }

      setBundle((prev) => {
        const merged = mergeRunIntoBundle(prev, lead.id, data.run!)
        onLatestRunChange?.(merged.latestRun ?? data.run ?? null)
        return merged
      })
      if (data.lead) {
        onLeadUpdated?.(data.lead)
      } else {
        onLeadUpdated?.({
          status: data.leadStatus,
          score: data.leadScore ?? null,
        })
      }
      await loadResearch({ clearError: false, silent: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research generation failed.")
    } finally {
      setGenerating(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/research/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: notesDraft }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        manualNotes?: GrowthLeadResearchBundle["manualNotes"]
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(growthLeadResearchErrorMessage(data))
      }
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              manualNotes: data.manualNotes ?? { body: notesDraft, updatedAt: new Date().toISOString(), updatedBy: null },
            }
          : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save notes.")
    } finally {
      setSavingNotes(false)
    }
  }

  const displayRun = pickDisplayRun(bundle)
  const latestUsableRun = bundle?.latestRun ?? null
  const runningRun = bundle?.runs.find((run) => run.status === "running") ?? null
  const summaryText = displayRun?.result?.companySummary

  return (
    <GrowthCollapsibleEngineCard id={id} title="Research" icon={<Sparkles className="size-4" />}>
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading research…
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Internal AI research only — human review required. Not verified; nothing is sent to prospects.
          </p>

          {summaryText ? (
            <div className="rounded-lg border border-border/80 bg-muted/15 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current summary</p>
              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap line-clamp-6">{summaryText}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void generateResearch(Boolean(latestUsableRun))} disabled={generating}>
              {generating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              {latestUsableRun ? "Regenerate Research" : "Generate Research"}
            </Button>
          </div>

          {cacheNotice ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">{cacheNotice}</div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {runningRun ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Research run in progress…
            </div>
          ) : null}

          {displayRun ? (
            <GrowthLeadResearchRunCard
              run={displayRun}
              title={
                displayRun.status === "succeeded" || displayRun.status === "partial"
                  ? latestUsableRun?.id === displayRun.id && cacheNotice
                    ? "Cached research"
                    : displayRun.status === "partial"
                      ? "Partial research"
                      : "Latest research"
                  : `${displayRun.status.replace(/_/g, " ")} research run`
              }
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No research yet. Generate research from the lead fields on file.
            </div>
          )}

          <div className="rounded-lg border border-border/80 bg-muted/10">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
              onClick={() => setNotesOpen((value) => !value)}
            >
              {notesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              Manual research notes
            </button>
            {notesOpen ? (
              <div className="space-y-3 border-t border-border px-4 py-3">
                <Label htmlFor="growth-manual-notes" className="sr-only">
                  Manual research notes
                </Label>
                <Textarea
                  id="growth-manual-notes"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={4}
                  placeholder="Analyst notes, call prep, verification checklist…"
                />
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => void saveNotes()} disabled={savingNotes}>
                    {savingNotes ? "Saving…" : "Save Notes"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {bundle ? (
            <GrowthLeadResearchHistory runs={bundle.runs} latestRunId={displayRun?.id ?? null} />
          ) : null}
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
