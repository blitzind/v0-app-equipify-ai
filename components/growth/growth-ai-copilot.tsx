"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GrowthAvaOperatorWorkspaceReview } from "@/components/growth/growth-ava-operator-workspace-review"
import { GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  formatOperatorGenerationTypeLabel,
  formatOperatorWorkspaceReviewIntro,
  resolvePrimaryOperatorReviewGeneration,
  summarizeOperatorWorkspaceHeader,
} from "@/lib/growth/aios/operator-experience/growth-ava-operator-workspace-3a"
import type {
  GrowthAiCopilotGeneration,
  GrowthAiCopilotGenerationType,
} from "@/lib/growth/ai-copilot-types"
import type { GrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-types"
import { growthAvaPanelTitle } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthSenderProfilesDashboardPayload } from "@/lib/growth/signatures/signature-types"

type GrowthAiCopilotProps = {
  lead: GrowthLead
}

const EMAIL_TYPES: Array<{ type: GrowthAiCopilotGenerationType; label: string }> = [
  { type: "cold_email", label: "Recommended Email" },
  { type: "follow_up_email", label: "Follow-up Email" },
  { type: "reengagement_email", label: "Re-engagement Email" },
  { type: "executive_email", label: "Executive Email" },
  { type: "breakup_email", label: "Closing Email" },
]

const CALL_TYPES: Array<{ type: GrowthAiCopilotGenerationType; label: string }> = [
  { type: "call_opening", label: "Call Opening" },
  { type: "call_objection_response", label: "Objection Response" },
  { type: "call_risk_brief", label: "Call Brief" },
  { type: "call_summary", label: "Call Summary" },
]

export function GrowthAiCopilot({ lead }: GrowthAiCopilotProps) {
  const { teammate } = useAiTeammateIdentity()
  const [generations, setGenerations] = useState<GrowthAiCopilotGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queueItems, setQueueItems] = useState<GrowthOutreachQueueItem[]>([])
  const [senderProfiles, setSenderProfiles] = useState<GrowthSenderProfilesDashboardPayload["profiles"]>([])
  const [selectedSenderAccountId, setSelectedSenderAccountId] = useState<string>("__default__")
  const [prepareOpen, setPrepareOpen] = useState(false)
  const [previousOpen, setPreviousOpen] = useState(false)

  const primaryGeneration = useMemo(
    () => resolvePrimaryOperatorReviewGeneration(generations),
    [generations],
  )

  const previousGenerations = useMemo(
    () => generations.filter((entry) => entry.id !== primaryGeneration?.id).slice(0, 4),
    [generations, primaryGeneration?.id],
  )

  const loadQueueItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/platform/growth/outreach/queue?leadId=${lead.id}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: GrowthOutreachQueueItem[] }
      if (!res.ok || !data.items) return
      setQueueItems(data.items)
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
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load Ava recommendations.")
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
    void fetch("/api/platform/growth/sender-profiles/dashboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { dashboard?: GrowthSenderProfilesDashboardPayload }) => {
        setSenderProfiles(data.dashboard?.profiles ?? [])
      })
      .catch(() => undefined)
  }, [load, loadQueueItems])

  async function generate(generationType: GrowthAiCopilotGenerationType) {
    setGenerating(generationType)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/copilot/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationType,
          ...(selectedSenderAccountId && selectedSenderAccountId !== "__default__"
            ? { senderAccountId: selectedSenderAccountId }
            : {}),
        }),
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
      const created = (await createRes.json().catch(() => ({}))) as {
        ok?: boolean
        item?: GrowthOutreachQueueItem
        error?: string
        message?: string
      }
      if (createRes.status === 410 || created.error === "adapter_outbound_cutover_disabled") {
        throw new Error(
          created.message ??
            "Outbound sending is not enabled yet. Your approval is saved for when sending resumes.",
        )
      }
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
    return queueItems.find((item) => item.generationId === generationId) ?? null
  }

  return (
    <GrowthCollapsibleEngineCard
      id="growth-ai-copilot"
      title={growthAvaPanelTitle(teammate)}
      icon={<Bot className="size-4" />}
      headerAside={
        <span className="text-xs text-muted-foreground">{summarizeOperatorWorkspaceHeader(generations)}</span>
      }
      defaultOpen
      persistKey={GROWTH_DRAWER_CARD_KEYS.aiCopilot}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{formatOperatorWorkspaceReviewIntro(teammate)}</p>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading Ava&apos;s recommendation…
          </div>
        ) : primaryGeneration ? (
          <GrowthAvaOperatorWorkspaceReview
            lead={lead}
            teammate={teammate}
            generation={primaryGeneration}
            acting={actingId === primaryGeneration.id}
            queueItem={queueItemForGeneration(primaryGeneration.id)}
            onApprove={() => void approve(primaryGeneration.id)}
            onReject={() => void discard(primaryGeneration.id)}
            onQueue={
              primaryGeneration.status === "approved"
                ? () => void queueGeneration(primaryGeneration.id, false)
                : undefined
            }
            onQueueAndSend={
              primaryGeneration.status === "approved"
                ? () => void queueGeneration(primaryGeneration.id, true)
                : undefined
            }
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            Ava has not prepared a recommendation for this account yet.
          </div>
        )}

        {previousGenerations.length > 0 ? (
          <div className="rounded-lg border border-border/60">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              onClick={() => setPreviousOpen((value) => !value)}
            >
              {previousOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              Previous preparations ({previousGenerations.length})
            </button>
            {previousOpen ? (
              <ul className="space-y-2 border-t border-border/60 p-3">
                {previousGenerations.map((entry) => (
                  <li key={entry.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">
                      {formatOperatorGenerationTypeLabel(entry.generationType)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.generatedSubject?.trim() || "No subject"} ·{" "}
                      {entry.status === "draft"
                        ? "Ready for your review"
                        : entry.status === "approved"
                          ? "Approved"
                          : "Declined"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-lg border border-border/60">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
            onClick={() => setPrepareOpen((value) => !value)}
          >
            {prepareOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            Ask Ava to prepare another message
          </button>
          {prepareOpen ? (
            <div className="space-y-4 border-t border-border/60 p-3">
              {senderProfiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Write as</p>
                  <Select value={selectedSenderAccountId} onValueChange={setSelectedSenderAccountId}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Default sender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Default sender</SelectItem>
                      {senderProfiles.map((row) => (
                        <SelectItem key={row.profile.id} value={row.profile.sender_account_id}>
                          {row.profile.display_name}
                          {row.profile.title ? ` — ${row.profile.title}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
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
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reply</p>
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
                  Reply Draft
                </Button>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Call prep</p>
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
            </div>
          ) : null}
        </div>
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
