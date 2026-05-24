"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Check, Copy, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthOutreachPersonalizationPreview } from "@/components/growth/growth-outreach-personalization-preview"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type {
  GrowthAiCopilotGeneration,
  GrowthAiCopilotGenerationType,
} from "@/lib/growth/ai-copilot-types"
import type { GrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthAiCopilotProps = {
  lead: GrowthLead
}

const EMAIL_TYPES: Array<{ type: GrowthAiCopilotGenerationType; label: string }> = [
  { type: "cold_email", label: "Suggested Email" },
  { type: "follow_up_email", label: "Suggested Follow Up" },
  { type: "reengagement_email", label: "Suggested Reengagement" },
  { type: "executive_email", label: "Executive Email" },
  { type: "breakup_email", label: "Breakup Email" },
]

const CALL_TYPES: Array<{ type: GrowthAiCopilotGenerationType; label: string }> = [
  { type: "call_opening", label: "Call Opening" },
  { type: "call_objection_response", label: "Objection Response" },
  { type: "call_risk_brief", label: "Call Risk Brief" },
  { type: "call_summary", label: "Call Summary" },
]

function statusTone(status: GrowthAiCopilotGeneration["status"]): "healthy" | "warning" | "neutral" {
  if (status === "approved") return "healthy"
  if (status === "draft") return "warning"
  return "neutral"
}

function playbookSourceAttributionLabel(attribution: Record<string, unknown>): string | null {
  const sourceTitles = attribution.sourceTitles
  if (!Array.isArray(sourceTitles) || sourceTitles.length === 0) return null
  const titles = sourceTitles.filter((title): title is string => typeof title === "string" && title.trim().length > 0)
  if (titles.length === 0) return null
  return titles.join(", ")
}

function formatGenerationTypeLabel(type: GrowthAiCopilotGenerationType): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function GrowthAiCopilot({ lead }: GrowthAiCopilotProps) {
  const [generations, setGenerations] = useState<GrowthAiCopilotGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [queueItems, setQueueItems] = useState<GrowthOutreachQueueItem[]>([])
  const [queueEventsById, setQueueEventsById] = useState<Record<string, Array<{ eventType: string; createdAt: string }>>>({})

  const loadQueueItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/platform/growth/outreach/queue?leadId=${lead.id}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: GrowthOutreachQueueItem[] }
      if (!res.ok || !data.items) return
      setQueueItems(data.items)
      const events: Record<string, Array<{ eventType: string; createdAt: string }>> = {}
      await Promise.all(
        data.items.slice(0, 5).map(async (item) => {
          const detailRes = await fetch(`/api/platform/growth/outreach/queue/${item.id}`, { cache: "no-store" })
          const detail = (await detailRes.json().catch(() => ({}))) as {
            events?: Array<{ eventType: string; createdAt: string }>
          }
          events[item.id] = detail.events ?? []
        }),
      )
      setQueueEventsById(events)
    } catch {
      // ignore queue load failures in drawer
    }
  }, [lead.id])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/copilot/generations`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        generations?: GrowthAiCopilotGeneration[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load copilot history.")
      setGenerations(data.generations ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
    void loadQueueItems()
  }, [load, loadQueueItems])

  async function generate(generationType: GrowthAiCopilotGenerationType) {
    setGenerating(generationType)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/copilot/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationType }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        generation?: GrowthAiCopilotGeneration
        message?: string
      }
      if (!res.ok || !data.ok || !data.generation) {
        throw new Error(data.message ?? "Generation failed.")
      }
      if (data.generation.id !== "ephemeral") {
        setGenerations((prev) => [data.generation!, ...prev].slice(0, 20))
        setExpandedId(data.generation.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.")
    } finally {
      setGenerating(null)
    }
  }

  async function approve(generationId: string) {
    setActingId(generationId)
    try {
      const res = await fetch(`/api/platform/growth/copilot/generations/${generationId}`, { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; generation?: GrowthAiCopilotGeneration }
      if (data.generation) {
        setGenerations((prev) => prev.map((entry) => (entry.id === generationId ? data.generation! : entry)))
      }
    } finally {
      setActingId(null)
    }
  }

  async function discard(generationId: string) {
    setActingId(generationId)
    try {
      const res = await fetch(`/api/platform/growth/copilot/generations/${generationId}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; generation?: GrowthAiCopilotGeneration }
      if (data.generation) {
        setGenerations((prev) => prev.map((entry) => (entry.id === generationId ? data.generation! : entry)))
      }
    } finally {
      setActingId(null)
    }
  }

  async function queueGeneration(generationId: string, sendNow = false) {
    setActingId(generationId)
    try {
      const createRes = await fetch("/api/platform/growth/outreach/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, generationId, channel: "email" }),
      })
      const created = (await createRes.json().catch(() => ({}))) as { ok?: boolean; item?: GrowthOutreachQueueItem }
      if (!createRes.ok || !created.item) throw new Error("Queue failed.")
      if (sendNow) {
        await fetch(`/api/platform/growth/outreach/queue/${created.item.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sendNow: true }),
        })
      }
      await loadQueueItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue failed.")
    } finally {
      setActingId(null)
    }
  }

  function queueItemForGeneration(generationId: string) {
    return queueItems.find((item) => item.generationId === generationId)
  }

  const draftCount = generations.filter((entry) => entry.status === "draft").length
  const approvedCount = generations.filter((entry) => entry.status === "approved").length
  const recent = generations[0]
  const collapsedSummary =
    generations.length === 0
      ? "No drafts"
      : draftCount > 0 || approvedCount > 0
        ? `Drafts: ${draftCount} • Approved: ${approvedCount}`
        : recent
          ? `Recent: ${formatGenerationTypeLabel(recent.generationType)}`
          : "No drafts"

  return (
    <GrowthCollapsibleEngineCard
      id="growth-ai-copilot"
      title="AI Copilot"
      icon={<Bot className="size-4" />}
      headerAside={<span className="text-xs text-muted-foreground">{collapsedSummary}</span>}
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.aiCopilot}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Advisory drafts only — human approval required. Deterministic intelligence remains authoritative. No auto-send.
        </p>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Generate email</p>
          <div className="flex flex-wrap gap-2">
            {EMAIL_TYPES.map((entry) => (
              <Button
                key={entry.type}
                type="button"
                size="sm"
                variant="outline"
                disabled={generating !== null}
                onClick={() => void generate(entry.type)}
              >
                {generating === entry.type ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 size-3.5" />
                )}
                {entry.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Generate response</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={generating !== null}
            onClick={() => void generate("response_draft")}
          >
            {generating === "response_draft" ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1 size-3.5" />
            )}
            Draft Response
          </Button>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Generate call prep</p>
          <div className="flex flex-wrap gap-2">
            {CALL_TYPES.map((entry) => (
              <Button
                key={entry.type}
                type="button"
                size="sm"
                variant="outline"
                disabled={generating !== null}
                onClick={() => void generate(entry.type)}
              >
                {generating === entry.type ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 size-3.5" />
                )}
                {entry.label}
              </Button>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">History</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : generations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No generations yet.</p>
          ) : (
            <ul className="space-y-2">
              {generations.slice(0, 5).map((entry) => {
                const expanded = expandedId === entry.id
                const sourceAttribution = playbookSourceAttributionLabel(entry.playbookAttribution)
                return (
                  <li key={entry.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium capitalize">{entry.generationType.replace(/_/g, " ")}</span>
                        <GrowthBadge label={entry.status} tone={statusTone(entry.status)} />
                        <GrowthBadge label={entry.promptVariant} tone="neutral" />
                        {entry.classification.primary ? (
                          <GrowthBadge label={String(entry.classification.primary)} tone="neutral" />
                        ) : null}
                        {entry.playbookInfluenceScore > 0 ? (
                          <GrowthBadge label={`playbook ${entry.playbookInfluenceScore}`} tone="healthy" />
                        ) : null}
                        {sourceAttribution ? (
                          <GrowthBadge label={`Influenced by: ${sourceAttribution}`} tone="neutral" />
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expanded ? null : entry.id)}
                        >
                          {expanded ? "Hide" : "View"}
                        </Button>
                        {entry.status === "approved" ? (
                          <>
                            {queueItemForGeneration(entry.id) ? (
                              <GrowthBadge
                                label={queueItemForGeneration(entry.id)!.status.replace(/_/g, " ")}
                                tone={
                                  queueItemForGeneration(entry.id)!.status === "executed"
                                    ? "healthy"
                                    : queueItemForGeneration(entry.id)!.status === "failed"
                                      ? "attention"
                                      : "warning"
                                }
                              />
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={actingId === entry.id}
                                  onClick={() => void queueGeneration(entry.id, false)}
                                >
                                  Approve + Queue
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={actingId === entry.id}
                                  onClick={() => void queueGeneration(entry.id, true)}
                                >
                                  Queue & Execute
                                </Button>
                              </>
                            )}
                          </>
                        ) : null}
                        {entry.status === "draft" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={actingId === entry.id}
                              onClick={() => void approve(entry.id)}
                            >
                              {actingId === entry.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={actingId === entry.id}
                              onClick={() => void discard(entry.id)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void navigator.clipboard.writeText(entry.generatedContent)}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    {expanded ? (
                      <div className="mt-3 space-y-2">
                        {entry.classification.personalization ? (
                          <GrowthOutreachPersonalizationPreview
                            audit={entry.classification.personalization}
                            generatedSubject={entry.generatedSubject}
                            generatedContent={entry.generatedContent}
                          />
                        ) : (
                          <>
                            {entry.generatedSubject ? (
                              <p className="font-medium">Subject: {entry.generatedSubject}</p>
                            ) : null}
                            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                              {entry.generatedContent}
                            </pre>
                          </>
                        )}
                        {entry.classification.callPrep ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50/40 p-2 text-xs">
                            <p className="font-medium">Call prep</p>
                            <pre className="mt-1 whitespace-pre-wrap">
                              {JSON.stringify(entry.classification.callPrep, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                        {entry.playbookInfluenceScore > 0 ? (
                          <div className="rounded-md border border-violet-200 bg-violet-50/40 p-2 text-xs">
                            <p className="font-medium">Playbook influence ({entry.playbookInfluenceScore})</p>
                            {sourceAttribution ? (
                              <p className="mt-1 text-muted-foreground">Influenced by: {sourceAttribution}</p>
                            ) : null}
                            {Array.isArray(entry.playbookAttribution?.ruleTitles) &&
                            entry.playbookAttribution.ruleTitles.length > 0 ? (
                              <ul className="mt-1 list-disc pl-4">
                                {(entry.playbookAttribution.ruleTitles as string[]).map((title) => (
                                  <li key={title}>{title}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-muted-foreground">Approved playbook rules influenced this draft.</p>
                            )}
                            {Array.isArray(entry.playbookAttribution?.conflicts) &&
                            (entry.playbookAttribution.conflicts as unknown[]).length > 0 ? (
                              <p className="mt-2 text-amber-800">
                                {(entry.playbookAttribution.conflicts as unknown[]).length} playbook conflict(s) detected.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
