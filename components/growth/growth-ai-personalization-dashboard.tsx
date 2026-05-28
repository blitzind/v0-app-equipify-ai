"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER,
  GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
  GROWTH_AI_PERSONALIZATION_QA_MARKER,
  personalizationSourceLabel,
  personalizationStatusLabel,
  type GrowthAiPersonalizationDashboard,
  type GrowthPersonalizationGenerationView,
} from "@/lib/growth/personalization/personalization-types"

type TabKey = "generations" | "evidence" | "risk" | "feedback" | "performance"

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

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthAiPersonalizationDashboard
  message?: string
}

export function GrowthAiPersonalizationDashboardView() {
  const [tab, setTab] = useState<TabKey>("generations")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthAiPersonalizationDashboard | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<GrowthPersonalizationGenerationView | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [leadIdInput, setLeadIdInput] = useState("")
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load personalization dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadGeneration = useCallback(async (generationId: string) => {
    setActionId(`load:${generationId}`)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/personalization/generations/${generationId}`, { cache: "no-store" })
      const payload = (await response.json()) as { ok?: boolean; generation?: GrowthPersonalizationGenerationView; message?: string }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Could not load generation.")
      }
      setSelected(payload.generation)
      setSelectedId(generationId)
      setEditSubject(payload.generation.subject)
      setEditBody(payload.generation.body)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load generation.")
    } finally {
      setActionId(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function generateDraft() {
    if (!leadIdInput.trim()) return
    setActionId("generate")
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/personalization/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: leadIdInput.trim() }),
      })
      const payload = (await response.json()) as { ok?: boolean; generation?: GrowthPersonalizationGenerationView; message?: string }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Generation failed.")
      }
      await load()
      await loadGeneration(payload.generation.id)
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
      const payload = (await response.json()) as { ok?: boolean; generation?: GrowthPersonalizationGenerationView; message?: string }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Edit failed.")
      }
      setSelected(payload.generation)
      await load()
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
      const payload = (await response.json()) as { ok?: boolean; generation?: GrowthPersonalizationGenerationView; message?: string }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Approval failed.")
      }
      setSelected(payload.generation)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.")
    } finally {
      setActionId(null)
    }
  }

  async function rejectGeneration() {
    if (!selectedId) return
    setActionId("reject")
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/personalization/generations/${selectedId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected during human review." }),
      })
      const payload = (await response.json()) as { ok?: boolean; generation?: GrowthPersonalizationGenerationView; message?: string }
      if (!response.ok || !payload.ok || !payload.generation) {
        throw new Error(payload.message ?? "Reject failed.")
      }
      setSelected(payload.generation)
      await load()
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
    { key: "evidence", label: "Evidence" },
    { key: "risk", label: "Risk Events" },
    { key: "feedback", label: "Feedback" },
    { key: "performance", label: "Performance" },
  ]

  return (
    <div
      className="flex min-w-0 flex-col gap-5"
      data-qa={GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER}
    >
      <GrowthEngineCard title="AI Prospect Personalization" icon={<Sparkles className="size-4" />}>
        <p className="mb-4 text-xs text-muted-foreground">{GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE}</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_AI_PERSONALIZATION_QA_MARKER} tone="neutral" />
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/copilot/content-library">Content Library</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/intelligence/relationship-memory">Relationship Memory</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/sequences/execution">Sequence Execution</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/settings/governance">Governance</Link>
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

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Lead ID (generate draft)</label>
            <Input value={leadIdInput} onChange={(e) => setLeadIdInput(e.target.value)} placeholder="Lead UUID" />
          </div>
          <Button size="sm" onClick={() => void generateDraft()} disabled={actionId === "generate" || !leadIdInput.trim()}>
            {actionId === "generate" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
            Generate personalization
          </Button>
        </div>
      </GrowthEngineCard>

      {dashboard?.topSources.length ? (
        <GrowthEngineCard title="Top Personalization Sources">
          <ul className="space-y-2">
            {dashboard.topSources.map((entry) => (
              <li key={entry.source} className="flex items-center justify-between text-sm">
                <span>{personalizationSourceLabel(entry.source)}</span>
                <GrowthBadge label={String(entry.count)} tone="neutral" />
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
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
          {tab === "generations" ? (
            <GrowthEngineCard title="Generations">
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
                          <div className="flex flex-wrap gap-1">
                            <GrowthBadge label={personalizationStatusLabel(generation.status)} tone={STATUS_TONE[generation.status] ?? "neutral"} />
                            <GrowthBadge label={generation.riskLevel} tone={RISK_TONE[generation.riskLevel] ?? "neutral"} />
                          </div>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{generation.subject}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Evidence {generation.evidenceCoverageScore}% · Score {generation.personalizationScore} · {formatWhen(generation.createdAt)}
                        </p>
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <GrowthBadge label={personalizationSourceLabel(entry.sourceType)} tone="neutral" />
                        <GrowthBadge label={entry.confidence} tone="medium" />
                      </div>
                      <p className="mt-1 font-medium">{entry.claimKey.replace(/_/g, " ")}</p>
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{entry.title}</span>
                        <GrowthBadge label={entry.severity} tone={RISK_TONE[entry.severity] ?? "attention"} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatWhen(entry.recordedAt)}</p>
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <GrowthBadge label={entry.feedbackType.replace(/_/g, " ")} tone="neutral" />
                        <span className="text-xs text-muted-foreground">{formatWhen(entry.recordedAt)}</span>
                      </div>
                      <p className="mt-1">{entry.notes || "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.actorEmail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          ) : null}

          {tab === "performance" ? (
            <GrowthEngineCard title="Performance Attribution">
              {!dashboard?.performanceSnapshots.length ? (
                <p className="text-sm text-muted-foreground">No performance snapshots yet. Approve generations to seed attribution.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {dashboard.performanceSnapshots.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <GrowthBadge label={personalizationSourceLabel(entry.sourceType)} tone="neutral" />
                        <GrowthBadge label={`${entry.attributionScore}%`} tone="healthy" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatWhen(entry.recordedAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          ) : null}
        </div>

        <GrowthEngineCard title="Preview & Review">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a generation to preview evidence, edit before approve, and review risk warnings.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge label={personalizationStatusLabel(selected.status)} tone={STATUS_TONE[selected.status] ?? "neutral"} />
                <GrowthBadge label={`Risk: ${selected.riskLevel}`} tone={RISK_TONE[selected.riskLevel] ?? "neutral"} />
                {selected.requiresHumanReview ? <GrowthBadge label="Human review required" tone="attention" /> : null}
              </div>

              {selected.blockedReason ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  Blocked: {selected.blockedReason}
                </div>
              ) : null}

              {selected.riskEvents.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk warnings</p>
                  {selected.riskEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      <span className="font-medium">{event.title}</span> — {event.description}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Subject</label>
                <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} disabled={selected.status === "blocked" || selected.status === "approved"} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Body (edit before approve)</label>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={8}
                  disabled={selected.status === "blocked" || selected.status === "approved"}
                />
              </div>

              {selected.sourceSummary.length ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Personalization sources</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.sourceSummary.map((source) => (
                      <GrowthBadge key={source} label={personalizationSourceLabel(source)} tone="neutral" />
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence side panel</p>
                {!selected.evidence.length ? (
                  <p className="text-xs text-muted-foreground">No evidence attached.</p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
                    {selected.evidence.map((entry) => (
                      <li key={entry.id} className="rounded border border-border/60 px-2 py-1.5">
                        <span className="font-medium">{entry.claimKey}</span>
                        <p className="text-muted-foreground">{entry.evidenceSnippet}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected.status === "draft" ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void saveEdits()} disabled={actionId === "edit"}>
                    Save edits
                  </Button>
                  <Button size="sm" onClick={() => void approveGeneration()} disabled={actionId === "approve"}>
                    Approve (human confirmed)
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void rejectGeneration()} disabled={actionId === "reject"}>
                    Reject
                  </Button>
                </div>
              ) : null}

              {selected.status === "approved" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  Approved content merge preview — attach generation ID to sequence execution jobs. AI output is never auto-sent.
                </div>
              ) : null}
            </div>
          )}
        </GrowthEngineCard>
      </div>
    </div>
  )
}
