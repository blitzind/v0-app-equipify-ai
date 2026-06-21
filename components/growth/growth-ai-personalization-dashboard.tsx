"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthPersonalizationLeadPicker } from "@/components/growth/personalization/growth-personalization-lead-picker"
import { GrowthPersonalizationEvaluationPanel } from "@/components/growth/personalization/growth-personalization-evaluation-panel"
import { GrowthPersonalizationOperatorFeedbackPanel } from "@/components/growth/personalization/growth-personalization-operator-feedback-panel"
import { GrowthPersonalizationRegenerationFeedbackPanel } from "@/components/growth/personalization/growth-personalization-regeneration-feedback-panel"
import {
  GrowthPersonalizationVersionCompare,
  GrowthPersonalizationVersionHistory,
} from "@/components/growth/personalization/growth-personalization-version-history"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  assignGenerationVersionNumbers,
  buildGrowthPersonalizationWorkspaceHref,
  readLastPersonalizationLeadId,
  regenerationFeedbackLabel,
  type GrowthPersonalizationRecentLeadSelection,
} from "@/lib/growth/personalization/personalization-generation-ux"
import {
  GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER,
  GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
  GROWTH_AI_PERSONALIZATION_QA_MARKER,
  GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER,
  GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER,
  personalizationSourceLabel,
  personalizationStatusLabel,
  type GrowthAiPersonalizationDashboard,
  type GrowthPersonalizationGeneration,
  type GrowthPersonalizationGenerationView,
  type GrowthPersonalizationIndustryPlaybookDiagnostics,
  type GrowthPersonalizationRegenerationFeedbackCategory,
} from "@/lib/growth/personalization/personalization-types"
import type { GrowthPersonalizationEvaluationReport } from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"

type TabKey = "generations" | "evidence" | "risk" | "feedback" | "performance" | "evaluation"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  rejected: "neutral",
  sent: "healthy",
  archived: "neutral",
  blocked: "blocked",
}

const RISK_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  low: "healthy",
  medium: "attention",
  high: "critical",
  critical: "blocked",
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function IndustryPlaybookDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: GrowthPersonalizationIndustryPlaybookDiagnostics
}) {
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-sky-950">
      <p className="font-medium uppercase tracking-wide">Industry playbook (industry-level, not company-verified)</p>
      <p className="mt-1">
        Industry Playbook: {diagnostics.playbookDisplayName ?? diagnostics.resolvedIndustryLabel ?? "—"}
      </p>
      <p className="mt-1">Confidence: {diagnostics.resolverConfidence}%</p>
      {diagnostics.matchedSignals.length ? (
        <p className="mt-1">Matched: {diagnostics.matchedSignals.join(", ")}</p>
      ) : null}
      <p className="mt-1">Playbook evidence count: {diagnostics.playbookEvidenceCount}</p>
    </div>
  )
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthAiPersonalizationDashboard
  message?: string
}

export function GrowthAiPersonalizationDashboardView({
  initialLeadId = null,
  initialGenerationId = null,
}: {
  initialLeadId?: string | null
  initialGenerationId?: string | null
}) {
  const [tab, setTab] = useState<TabKey>("generations")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthAiPersonalizationDashboard | null>(null)
  const [selectedLead, setSelectedLead] = useState<GrowthPersonalizationRecentLeadSelection | null>(null)
  const [leadVersions, setLeadVersions] = useState<GrowthPersonalizationGeneration[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<GrowthPersonalizationGenerationView | null>(null)
  const [compareId, setCompareId] = useState<string | null>(null)
  const [compareGeneration, setCompareGeneration] = useState<GrowthPersonalizationGenerationView | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")
  const [showRegenerationFeedback, setShowRegenerationFeedback] = useState(false)
  const [evaluationReport, setEvaluationReport] = useState<GrowthPersonalizationEvaluationReport | null>(null)
  const [evaluationLoading, setEvaluationLoading] = useState(false)

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
      setCompareGeneration(selected)
      return
    }
    void fetch(`/api/platform/growth/personalization/generations/${compareId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { generation?: GrowthPersonalizationGenerationView }
        setCompareGeneration(payload.generation ?? null)
      })
      .catch(() => setCompareGeneration(null))
  }, [compareId, selected, selectedId])

  const versionEntries = useMemo(() => assignGenerationVersionNumbers(leadVersions), [leadVersions])

  async function handleLeadSelect(selection: GrowthPersonalizationRecentLeadSelection) {
    setSelectedLead(selection)
    setCompareId(null)
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

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading AI personalization…
      </div>
    )
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "generations", label: "Generations" },
    { key: "evaluation", label: "Evaluation" },
    { key: "evidence", label: "Evidence" },
    { key: "risk", label: "Risk Events" },
    { key: "feedback", label: "Feedback" },
    { key: "performance", label: "Performance" },
  ]

  const compareLeft = selected
  const compareRight =
    compareId && compareId !== selectedId
      ? compareGeneration
      : compareId === selectedId
        ? null
        : compareGeneration

  return (
    <div
      className="flex min-w-0 flex-col gap-5"
      data-qa={GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER}
      data-ux-marker={GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER}
    >
      <GrowthEngineCard title="AI Prospect Personalization" icon={<Sparkles className="size-4" />}>
        <p className="mb-4 text-xs text-muted-foreground">{GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE}</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_AI_PERSONALIZATION_QA_MARKER} tone="neutral" />
          <GrowthBadge label={GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER} tone="neutral" />
          <GrowthBadge label={GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER} tone="neutral" />
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/copilot/content-library">Content Library</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/intelligence/relationship-memory">Relationship Memory</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1 size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Generated Personalizations" value={dashboard?.generatedPersonalizations ?? 0} />
          <StatTile label="Approval Queue" value={dashboard?.approvalQueue ?? 0} />
          <StatTile label="High Risk Generations" value={dashboard?.highRiskGenerations ?? 0} />
          <StatTile label="Evidence Coverage" value={`${dashboard?.evidenceCoverage ?? 0}%`} />
          <StatTile label="Performance Attribution" value={`${dashboard?.performanceAttribution ?? 0}%`} />
          <StatTile label="Top Sources" value={dashboard?.topSources.length ?? 0} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
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
              {actionId === "generate" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
              Generate Draft
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
      </GrowthEngineCard>

      {selectedLead ? (
        <GrowthPersonalizationVersionHistory
          companyLabel={selectedLead.companyName}
          versions={versionEntries}
          selectedId={selectedId}
          compareId={compareId}
          onSelect={(generationId) => void loadGeneration(generationId)}
          onToggleCompare={(generationId) =>
            setCompareId((current) => (current === generationId ? null : generationId))
          }
        />
      ) : null}

      {compareLeft && compareRight ? (
        <GrowthPersonalizationVersionCompare left={compareLeft} right={compareRight} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <Button key={entry.key} variant={tab === entry.key ? "default" : "outline"} size="sm" onClick={() => setTab(entry.key)}>
            {entry.label}
          </Button>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {tab === "evaluation" ? (
            evaluationLoading && !evaluationReport ? (
              <GrowthEngineCard title="Evaluation">
                <p className="text-sm text-muted-foreground">Loading evaluation metrics…</p>
              </GrowthEngineCard>
            ) : evaluationReport ? (
              <GrowthPersonalizationEvaluationPanel report={evaluationReport} />
            ) : (
              <GrowthEngineCard title="Evaluation">
                <p className="text-sm text-muted-foreground">Evaluation report unavailable.</p>
              </GrowthEngineCard>
            )
          ) : null}

          {tab === "generations" ? (
            <GrowthEngineCard title="Recent Generations">
              {!dashboard?.generations.length ? (
                <p className="text-sm text-muted-foreground">No personalization generations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {dashboard.generations.map((generation) => (
                    <li key={generation.id}>
                      <button
                        type="button"
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                          selectedId === generation.id ? "border-violet-400 bg-violet-50/50" : "border-border/60 hover:bg-muted/40"
                        }`}
                        onClick={() => void loadGeneration(generation.id)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{generation.leadLabel}</span>
                          <GrowthBadge label={personalizationStatusLabel(generation.status)} tone={STATUS_TONE[generation.status] ?? "neutral"} />
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{generation.subject}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          ) : null}

          {tab === "evidence" ? (
            <GrowthEngineCard title="Evidence">
              {!dashboard?.recentEvidence.length ? (
                <p className="text-sm text-muted-foreground">No evidence snippets recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {dashboard.recentEvidence.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                      <GrowthBadge label={personalizationSourceLabel(entry.sourceType)} tone="neutral" />
                      <p className="mt-1 text-xs text-muted-foreground">{entry.evidenceSnippet}</p>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          ) : null}

          {tab === "risk" ? (
            <GrowthEngineCard title="Risk Events">
              {!dashboard?.recentRiskEvents.length ? (
                <p className="text-sm text-muted-foreground">No risk events recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {dashboard.recentRiskEvents.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                      <span className="font-medium">{entry.title}</span>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          ) : null}

          {tab === "feedback" ? (
            <GrowthEngineCard title="Feedback">
              {!dashboard?.recentFeedback.length ? (
                <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {dashboard.recentFeedback.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                      <GrowthBadge label={entry.feedbackType.replace(/_/g, " ")} tone="neutral" />
                      <p className="mt-1">{entry.notes || "—"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          ) : null}

          {tab === "performance" ? (
            <GrowthEngineCard title="Performance Attribution">
              {!dashboard?.performanceSnapshots.length ? (
                <p className="text-sm text-muted-foreground">No performance snapshots yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {dashboard.performanceSnapshots.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                      <GrowthBadge label={personalizationSourceLabel(entry.sourceType)} tone="neutral" />
                      <GrowthBadge label={`${entry.attributionScore}%`} tone="healthy" />
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          ) : null}
        </div>

        <GrowthEngineCard title="Preview & Review">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Search for a lead or company, then generate a draft to review evidence and approve.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge label={personalizationStatusLabel(selected.status)} tone={STATUS_TONE[selected.status] ?? "neutral"} />
                <GrowthBadge label={`Risk: ${selected.riskLevel}`} tone={RISK_TONE[selected.riskLevel] ?? "neutral"} />
              </div>

              {selected.operatorMetadata?.regeneration_feedback ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                  Regeneration feedback:{" "}
                  {regenerationFeedbackLabel(selected.operatorMetadata.regeneration_feedback.category)}
                  {selected.operatorMetadata.regeneration_feedback.customNotes
                    ? ` — ${selected.operatorMetadata.regeneration_feedback.customNotes}`
                    : ""}
                </div>
              ) : null}

              {selected.blockedReason ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  Blocked: {selected.blockedReason}
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Subject</label>
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  disabled={selected.status === "blocked" || selected.status === "approved"}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Body</label>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={8}
                  disabled={selected.status === "blocked" || selected.status === "approved"}
                />
              </div>

              {selected.industryPlaybookDiagnostics ? (
                <IndustryPlaybookDiagnosticsPanel diagnostics={selected.industryPlaybookDiagnostics} />
              ) : null}

              <GrowthPersonalizationOperatorFeedbackPanel
                generationId={selected.id}
                disabled={Boolean(actionId)}
                onSubmitted={() => void loadEvaluation()}
              />

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
                  {selected.evidence.map((entry) => (
                    <li key={entry.id} className="rounded border border-border/60 px-2 py-1.5">
                      <span className="font-medium">{entry.claimKey}</span>
                      <p className="text-muted-foreground">{entry.evidenceSnippet}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {selected.status === "draft" ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void saveEdits()} disabled={actionId === "edit"}>
                    Save edits
                  </Button>
                  <Button size="sm" onClick={() => void approveGeneration()} disabled={actionId === "approve"}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void rejectGeneration()} disabled={actionId === "reject"}>
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void generateDraft({ priorGenerationId: selectedId })}
                    disabled={actionId === "generate"}
                  >
                    Regenerate
                  </Button>
                </div>
              ) : null}

              {selected.status === "rejected" ? (
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
                </div>
              ) : null}

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

              {selected.status === "approved" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  Approved — attach this generation to sequence execution when ready. AI output is never auto-sent.
                </div>
              ) : null}
            </div>
          )}
        </GrowthEngineCard>
      </div>
    </div>
  )
}
