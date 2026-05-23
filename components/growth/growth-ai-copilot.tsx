"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Check, Copy, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import type {
  GrowthAiCopilotGeneration,
  GrowthAiCopilotGenerationType,
} from "@/lib/growth/ai-copilot-types"
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

export function GrowthAiCopilot({ lead }: GrowthAiCopilotProps) {
  const [generations, setGenerations] = useState<GrowthAiCopilotGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
  }, [load])

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

  const latestDraft = generations.find((entry) => entry.status === "draft")
  const collapsedSummary = latestDraft
    ? `${latestDraft.generationType.replace(/_/g, " ")} · draft`
    : generations[0]
      ? `${generations[0].generationType.replace(/_/g, " ")} · ${generations[0].status}`
      : "No drafts"

  return (
    <GrowthCollapsibleEngineCard
      title="AI Copilot"
      icon={<Bot className="size-4" />}
      headerAside={collapsedSummary}
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
                        {entry.generatedSubject ? (
                          <p className="font-medium">Subject: {entry.generatedSubject}</p>
                        ) : null}
                        <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                          {entry.generatedContent}
                        </pre>
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
