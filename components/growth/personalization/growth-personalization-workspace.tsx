"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthPersonalizationDraftEditor } from "@/components/growth/personalization/growth-personalization-draft-editor"
import { GrowthPersonalizationDiagnosticsPanel } from "@/components/growth/personalization/growth-personalization-diagnostics-panel"
import { GrowthPersonalizationEvaluationPanel } from "@/components/growth/personalization/growth-personalization-evaluation-panel"
import { GrowthPersonalizationLeadPicker } from "@/components/growth/personalization/growth-personalization-lead-picker"
import { GrowthPersonalizationOperatorFeedbackPanel } from "@/components/growth/personalization/growth-personalization-operator-feedback-panel"
import { GrowthPersonalizationRegenerationFeedbackPanel } from "@/components/growth/personalization/growth-personalization-regeneration-feedback-panel"
import { GrowthPersonalizationVersionCompare } from "@/components/growth/personalization/growth-personalization-version-history"
import { GrowthPersonalizationVersionHistoryDrawer } from "@/components/growth/personalization/growth-personalization-version-history-drawer"
import { GrowthPersonalizationVersionHistorySummary } from "@/components/growth/personalization/growth-personalization-version-history-summary"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { resolvePersonalizationOriginalAiDraft } from "@/lib/growth/personalization/growth-personalization-stack-b-metadata"
import { GROWTH_PERSONALIZATION_WORKSPACE_QA_MARKER } from "@/lib/growth/personalization/personalization-generation-ux"
import {
  assignGenerationVersionNumbers,
  buildGrowthPersonalizationWorkspaceHref,
  readLastPersonalizationLeadId,
  regenerationFeedbackLabel,
  type GrowthPersonalizationRecentLeadSelection,
} from "@/lib/growth/personalization/personalization-generation-ux"
import {
  GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
  GROWTH_AI_PERSONALIZATION_QA_MARKER,
  GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER,
  GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER,
  personalizationSourceLabel,
  type GrowthAiPersonalizationDashboard,
  type GrowthPersonalizationGeneration,
  type GrowthPersonalizationGenerationView,
  type GrowthPersonalizationRegenerationFeedbackCategory,
} from "@/lib/growth/personalization/personalization-types"
import type { GrowthPersonalizationEvaluationReport } from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"

type BottomTabKey =
  | "intelligence"
  | "reasoning"
  | "sequence"
  | "quality"
  | "evaluation"
  | "evidence"
  | "feedback"
  | "performance"

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthAiPersonalizationDashboard
  message?: string
}

export function GrowthPersonalizationWorkspace({
  initialLeadId = null,
  initialGenerationId = null,
}: {
  initialLeadId?: string | null
  initialGenerationId?: string | null
}) {
  const [bottomTab, setBottomTab] = useState<BottomTabKey>("evaluation")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthAiPersonalizationDashboard | null>(null)
  const [selectedLead, setSelectedLead] = useState<GrowthPersonalizationRecentLeadSelection | null>(null)
  const [leadVersions, setLeadVersions] = useState<GrowthPersonalizationGeneration[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<GrowthPersonalizationGenerationView | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")
  const [showRegenerationFeedback, setShowRegenerationFeedback] = useState(false)
  const [evaluationReport, setEvaluationReport] = useState<GrowthPersonalizationEvaluationReport | null>(null)
  const [evaluationLoading, setEvaluationLoading] = useState(false)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [compareId, setCompareId] = useState<string | null>(null)
  const [compareGeneration, setCompareGeneration] = useState<GrowthPersonalizationGenerationView | null>(null)

  const syncWorkspaceUrl = useCallback((leadId: string | null, generationId: string | null) => {
    if (typeof window === "undefined") return
    const href = buildGrowthPersonalizationWorkspaceHref({ leadId, generationId })
    window.history.replaceState(null, "", href)
  }, [])

  const loadEvaluation = useCallback(async () => {
    setEvaluationLoading(true)
    try {
      const response = await fetch("/api/platform/growth/personalization/evaluation", { cache: "no-store" })
      const payload = (await response.json()) as {
        ok?: boolean
        report?: GrowthPersonalizationEvaluationReport
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.report) {
        throw new Error(payload.message ?? "Could not load evaluation report.")
      }
      setEvaluationReport(payload.report)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load evaluation report.")
    } finally {
      setEvaluationLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/personalization/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load personalization dashboard.")
      }
      setDashboard(payload.dashboard)
      await loadEvaluation()
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load personalization dashboard.")
    } finally {
      setLoading(false)
    }
  }, [loadEvaluation])

  const loadLeadVersions = useCallback(async (leadId: string) => {
    const response = await fetch(
      `/api/platform/growth/personalization/generations?leadId=${encodeURIComponent(leadId)}&limit=50`,
      { cache: "no-store" },
    )
    const payload = (await response.json()) as {
      ok?: boolean
      generations?: GrowthPersonalizationGeneration[]
      message?: string
    }
    if (!response.ok || !payload.ok || !payload.generations) {
      throw new Error(payload.message ?? "Could not load lead versions.")
    }
    setLeadVersions(payload.generations)
    return payload.generations
  }, [])

  const loadGeneration = useCallback(
    async (generationId: string) => {
      setActionId(`load:${generationId}`)
      setError(null)
      try {
        const response = await fetch(`/api/platform/growth/personalization/generations/${generationId}`, {
          cache: "no-store",
        })
        const payload = (await response.json()) as {
          ok?: boolean
          generation?: GrowthPersonalizationGenerationView
          message?: string
        }
        if (!response.ok || !payload.ok || !payload.generation) {
          throw new Error(payload.message ?? "Could not load generation.")
        }
        setSelected(payload.generation)
        setSelectedId(generationId)
        setEditSubject(payload.generation.subject)
        setEditBody(payload.generation.body)
        setShowRegenerationFeedback(false)
        syncWorkspaceUrl(payload.generation.leadId, generationId)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load generation.")
      } finally {
        setActionId(null)
      }
    },
    [syncWorkspaceUrl],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const bootstrapLeadId = initialLeadId ?? readLastPersonalizationLeadId()
    if (!bootstrapLeadId) return
    setSelectedLead({
      leadId: bootstrapLeadId,
      companyName: "Selected lead",
      lastSelectedAt: new Date().toISOString(),
    })
    void loadLeadVersions(bootstrapLeadId).catch(() => undefined)
    if (initialGenerationId) void loadGeneration(initialGenerationId)
  }, [initialGenerationId, initialLeadId, loadGeneration, loadLeadVersions])

  useEffect(() => {
    if (!compareId) {
      setCompareGeneration(null)
      return
    }
    if (compareId === selectedId) {
      setCompareGeneration(null)
      return
    }
    void fetch(`/api/platform/growth/personalization/generations/${compareId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; generation?: GrowthPersonalizationGenerationView }) => {
        if (payload.ok && payload.generation) setCompareGeneration(payload.generation)
      })
      .catch(() => setCompareGeneration(null))
  }, [compareId, selectedId])

  const versionEntries = useMemo(() => assignGenerationVersionNumbers(leadVersions), [leadVersions])

  const originalAiDraft = useMemo(() => {
    if (!selected) return null
    return (
      selected.originalAiDraft ??
      resolvePersonalizationOriginalAiDraft({
        metadata: null,
        subject: selected.subject,
        body: selected.body,
      })
    )
  }, [selected])

  async function handleLeadSelect(selection: GrowthPersonalizationRecentLeadSelection) {
    setSelectedLead(selection)
    syncWorkspaceUrl(selection.leadId, null)
    try {
      const versions = await loadLeadVersions(selection.leadId)
      const newest = versions[0]
      if (newest) await loadGeneration(newest.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load lead history.")
    }
  }

  async function generateDraft(input?: {
    priorGenerationId?: string | null
    regenerationFeedback?: {
      category: GrowthPersonalizationRegenerationFeedbackCategory
      customNotes?: string
    }
  }) {
    if (!selectedLead?.leadId) return
    setActionId("generate")
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/personalization/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.leadId,
          priorGenerationId: input?.priorGenerationId ?? selectedId,
          regenerationFeedback: input?.regenerationFeedback
            ? {
                category: input.regenerationFeedback.category,
                customNotes: input.regenerationFeedback.customNotes ?? null,
              }
            : null,
        }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        generation?: GrowthPersonalizationGenerationView
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Generation failed.")
      }
      await load()
      await loadLeadVersions(selectedLead.leadId)
      await loadGeneration(payload.generation.id)
      setShowRegenerationFeedback(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.")
    } finally {
      setActionId(null)
    }
  }

  async function saveEdits() {
    if (!selectedId) return
    setActionId("edit")
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/personalization/generations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        generation?: GrowthPersonalizationGenerationView
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Edit failed.")
      }
      setSelected(payload.generation)
      await load()
      if (selectedLead?.leadId) await loadLeadVersions(selectedLead.leadId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed.")
    } finally {
      setActionId(null)
    }
  }

  async function approveGeneration() {
    if (!selectedId) return
    setActionId("approve")
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/personalization/generations/${selectedId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanApprovalConfirmed: true }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        generation?: GrowthPersonalizationGenerationView
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Approval failed.")
      }
      setSelected(payload.generation)
      await load()
      if (selectedLead?.leadId) await loadLeadVersions(selectedLead.leadId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.")
    } finally {
      setActionId(null)
    }
  }

  async function rejectGeneration(feedback?: {
    category?: GrowthPersonalizationRegenerationFeedbackCategory
    customNotes?: string
  }) {
    if (!selectedId) return
    setActionId("reject")
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/personalization/generations/${selectedId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: feedback?.customNotes?.trim() || "Rejected during human review.",
          rejectionFeedback: feedback
            ? {
                category: feedback.category ?? null,
                customNotes: feedback.customNotes ?? null,
              }
            : null,
        }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        generation?: GrowthPersonalizationGenerationView
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Reject failed.")
      }
      setSelected(payload.generation)
      setShowRegenerationFeedback(true)
      await load()
      if (selectedLead?.leadId) await loadLeadVersions(selectedLead.leadId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed.")
    } finally {
      setActionId(null)
    }
  }

  const bottomTabs: Array<{ key: BottomTabKey; label: string }> = [
    { key: "intelligence", label: "Intelligence" },
    { key: "reasoning", label: "Reasoning" },
    { key: "sequence", label: "Sequence" },
    { key: "quality", label: "Quality" },
    { key: "evaluation", label: "Evaluation" },
    { key: "evidence", label: "Evidence" },
    { key: "feedback", label: "Feedback" },
    { key: "performance", label: "Performance" },
  ]

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading personalization workspace…
      </div>
    )
  }

  return (
    <div
      className="flex min-w-0 flex-col gap-3 lg:min-h-[calc(100vh-10rem)]"
      data-qa={GROWTH_PERSONALIZATION_WORKSPACE_QA_MARKER}
      data-ux-marker={GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER}
    >
      <header className="shrink-0 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Personalization Workspace</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <GrowthBadge label={GROWTH_AI_PERSONALIZATION_QA_MARKER} tone="neutral" />
            <GrowthBadge label={GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER} tone="neutral" />
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-1 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <GrowthPersonalizationLeadPicker
            selectedLeadId={selectedLead?.leadId ?? null}
            onSelect={(selection) => void handleLeadSelect(selection)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void generateDraft()}
              disabled={actionId === "generate" || !selectedLead?.leadId}
            >
              {actionId === "generate" ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1 size-3.5" />
              )}
              Generate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void generateDraft({ priorGenerationId: selectedId })}
              disabled={actionId === "generate" || !selectedLead?.leadId}
            >
              Regenerate
            </Button>
          </div>
        </div>

        {selectedLead ? (
          <GrowthPersonalizationVersionHistorySummary
            versions={versionEntries}
            selectedId={selectedId}
            disabled={Boolean(actionId)}
            onOpenHistory={() => setVersionHistoryOpen(true)}
          />
        ) : null}
      </header>

      {selected && compareGeneration && selectedId && compareId && compareId !== selectedId ? (
        <GrowthPersonalizationVersionCompare left={selected} right={compareGeneration} />
      ) : null}

      {selectedLead ? (
        <GrowthPersonalizationVersionHistoryDrawer
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
          companyLabel={selectedLead.companyName}
          versions={versionEntries}
          selectedId={selectedId}
          compareId={compareId}
          disabled={Boolean(actionId)}
          onPreview={(generationId) => void loadGeneration(generationId)}
          onCompare={(generationId) =>
            setCompareId((current) => (current === generationId ? null : generationId))
          }
          onUseVersion={(generationId) => void loadGeneration(generationId)}
          onRegenerateFrom={(generationId) => {
            void loadGeneration(generationId)
            void generateDraft({ priorGenerationId: generationId })
          }}
        />
      ) : null}

      <div className="min-h-0 flex-1">
        {selected && originalAiDraft ? (
          <GrowthPersonalizationDraftEditor
            generation={selected}
            originalAiDraft={originalAiDraft}
            editSubject={editSubject}
            editBody={editBody}
            disabled={Boolean(actionId)}
            actionId={actionId}
            onEditSubject={setEditSubject}
            onEditBody={setEditBody}
            onResetToAiDraft={() => {
              setEditSubject(originalAiDraft.subject)
              setEditBody(originalAiDraft.body)
            }}
            onSaveDraft={() => void saveEdits()}
            onApprove={() => void approveGeneration()}
            onReject={() => void rejectGeneration()}
            onRegenerate={() => void generateDraft({ priorGenerationId: selectedId })}
          />
        ) : (
          <section className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Select a lead and generate a draft to preview and review.
          </section>
        )}
      </div>

      {selected?.operatorMetadata?.regeneration_feedback ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
          Regeneration feedback:{" "}
          {regenerationFeedbackLabel(selected.operatorMetadata.regeneration_feedback.category)}
          {selected.operatorMetadata.regeneration_feedback.customNotes
            ? ` — ${selected.operatorMetadata.regeneration_feedback.customNotes}`
            : ""}
        </div>
      ) : null}

      {selected ? (
        <section className="shrink-0 space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap gap-1.5">
            {bottomTabs.map((entry) => (
              <Button
                key={entry.key}
                size="sm"
                variant={bottomTab === entry.key ? "default" : "outline"}
                className="h-8"
                onClick={() => setBottomTab(entry.key)}
              >
                {entry.label}
              </Button>
            ))}
          </div>

          <div className="max-h-[min(360px,40vh)] min-h-[120px] overflow-y-auto">
            {bottomTab === "intelligence" ||
            bottomTab === "reasoning" ||
            bottomTab === "sequence" ||
            bottomTab === "quality" ? (
              <GrowthPersonalizationDiagnosticsPanel
                stackBDiagnostics={selected.stackBDiagnostics}
                industryPlaybookDiagnostics={selected.industryPlaybookDiagnostics}
              />
            ) : null}

            {bottomTab === "evaluation" ? (
              evaluationLoading && !evaluationReport ? (
                <p className="text-sm text-muted-foreground">Loading evaluation metrics…</p>
              ) : evaluationReport ? (
                <GrowthPersonalizationEvaluationPanel report={evaluationReport} />
              ) : (
                <p className="text-sm text-muted-foreground">Evaluation report unavailable.</p>
              )
            ) : null}

            {bottomTab === "evidence" ? (
              <ul className="space-y-2 text-sm">
                {selected.evidence.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                    <span className="font-medium">{entry.claimKey}</span>
                    <p className="mt-1 text-xs text-muted-foreground">{entry.evidenceSnippet}</p>
                  </li>
                ))}
                {!selected.evidence.length ? (
                  <p className="text-sm text-muted-foreground">No evidence recorded for this generation.</p>
                ) : null}
              </ul>
            ) : null}

            {bottomTab === "feedback" ? (
              <div className="space-y-3">
                <GrowthPersonalizationOperatorFeedbackPanel
                  generationId={selected.id}
                  disabled={Boolean(actionId)}
                  onSubmitted={() => void loadEvaluation()}
                />
                {!dashboard?.recentFeedback.length ? (
                  <p className="text-sm text-muted-foreground">No workspace feedback yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {dashboard.recentFeedback.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                        {entry.notes || "—"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {bottomTab === "performance" ? (
              <ul className="space-y-2 text-sm">
                {(dashboard?.performanceSnapshots ?? []).map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                    <GrowthBadge label={personalizationSourceLabel(entry.sourceType)} tone="neutral" />
                    <GrowthBadge label={`${entry.attributionScore}%`} tone="healthy" />
                  </li>
                ))}
                {!dashboard?.performanceSnapshots.length ? (
                  <p className="text-sm text-muted-foreground">No performance snapshots yet.</p>
                ) : null}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {selected?.status === "rejected" ? (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3 text-sm text-amber-950">
          <p className="font-medium">Generation Rejected</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void generateDraft({ priorGenerationId: selectedId })} disabled={actionId === "generate"}>
              Generate New Version
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowRegenerationFeedback(true)}>
              Regenerate with Feedback
            </Button>
          </div>
          {showRegenerationFeedback ? (
            <GrowthPersonalizationRegenerationFeedbackPanel
              disabled={actionId === "generate"}
              onSubmit={(feedback) =>
                void generateDraft({
                  priorGenerationId: selectedId,
                  regenerationFeedback: feedback,
                })
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
