"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, Check, Loader2, Plus, RefreshCw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthAiCopilotPlaybookApprovedRule,
  GrowthAiCopilotPlaybookDraftRule,
  GrowthAiCopilotPlaybookSource,
  GrowthAiCopilotPlaybookSourceKind,
} from "@/lib/growth/ai-copilot-playbook-types"

type PlaybooksPayload = {
  sources: GrowthAiCopilotPlaybookSource[]
  draftRules: GrowthAiCopilotPlaybookDraftRule[]
  approvedRules: GrowthAiCopilotPlaybookApprovedRule[]
  effectiveness: Array<{ outcome: string; count: number; avgInfluence: number; avgEffectiveness: number }>
}

type SourceTypeOption = "transcript_notes" | "youtube_link" | "website_url" | "document_upload"

const SOURCE_TYPE_OPTIONS: Array<{ id: SourceTypeOption; label: string; disabled?: boolean }> = [
  { id: "transcript_notes", label: "Transcript / Notes" },
  { id: "youtube_link", label: "YouTube Link" },
  { id: "website_url", label: "Website URL" },
  { id: "document_upload", label: "Document Upload (Coming Soon)", disabled: true },
]

const WORKFLOW_STEPS = [
  "Add source material",
  "AI extracts principles",
  "Review extracted rules",
  "Approve rules",
  "Copilot uses approved playbooks",
] as const

const COPILOT_LEARNS = [
  "Email tone",
  "Objection handling",
  "Call structure",
  "CTA strategy",
  "Follow-up patterns",
  "Industry messaging",
] as const

const COPILOT_DOES_NOT_LEARN = [
  "Revenue scoring",
  "Opportunity logic",
  "NBA logic",
  "Deterministic intelligence",
] as const

function sourceTypeToKind(sourceType: SourceTypeOption): GrowthAiCopilotPlaybookSourceKind {
  if (sourceType === "youtube_link") return "youtube_link"
  if (sourceType === "website_url") return "website_url"
  return "transcript_text"
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function sourceTypeLabel(sourceKind: GrowthAiCopilotPlaybookSourceKind): string {
  if (sourceKind === "youtube_link") return "YouTube link"
  if (sourceKind === "website_url") return "Website URL"
  if (sourceKind === "transcript_text") return "Transcript / notes"
  if (sourceKind === "pasted_notes") return "Transcript / notes"
  if (sourceKind === "uploaded_document") return "Document upload"
  return sourceKind.replace(/_/g, " ")
}

function PlaybookWorkflowCard() {
  return (
    <GrowthEngineCard title="How playbook training works">
      <ol className="grid gap-3 sm:grid-cols-5">
        {WORKFLOW_STEPS.map((step, index) => (
          <li key={step} className="relative flex flex-col items-center text-center">
            <span className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-800">
              {index + 1}
            </span>
            <p className="mt-2 text-sm font-medium">{step}</p>
            {index < WORKFLOW_STEPS.length - 1 ? (
              <ArrowDown className="mt-2 size-4 text-muted-foreground sm:hidden" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-4 hidden text-center text-xs text-muted-foreground sm:block">
        Step 1 → Step 2 → Step 3 → Step 4 → Step 5
      </p>
    </GrowthEngineCard>
  )
}

function PlaybookInfoCard() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GrowthEngineCard title="What Copilot learns">
        <ul className="space-y-2 text-sm">
          {COPILOT_LEARNS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </GrowthEngineCard>
      <GrowthEngineCard title="What Copilot does NOT learn">
        <ul className="space-y-2 text-sm">
          {COPILOT_DOES_NOT_LEARN.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </GrowthEngineCard>
    </div>
  )
}

export function GrowthAiCopilotPlaybooksDashboard() {
  const [payload, setPayload] = useState<PlaybooksPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<SourceTypeOption>("transcript_notes")
  const [title, setTitle] = useState("")
  const [rawContent, setRawContent] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [trainerName, setTrainerName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/copilot/playbooks", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as PlaybooksPayload & { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load playbooks.")
      setPayload({
        sources: data.sources ?? [],
        draftRules: data.draftRules ?? [],
        approvedRules: data.approvedRules ?? [],
        effectiveness: data.effectiveness ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const canCreateSource = useMemo(() => {
    if (title.trim().length < 3) return false
    if (sourceType === "document_upload") return false
    if (sourceType === "transcript_notes") return rawContent.trim().length >= 20
    if (sourceType === "youtube_link" || sourceType === "website_url") return isValidUrl(sourceUrl)
    return false
  }, [rawContent, sourceType, sourceUrl, title])

  async function createSource() {
    setActing("create")
    setError(null)
    setSuccess(null)
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        sourceKind: sourceTypeToKind(sourceType),
        trainerProfile: trainerName.trim() ? { name: trainerName.trim() } : undefined,
      }

      if (sourceType === "transcript_notes") {
        body.rawContent = rawContent.trim()
      } else {
        body.sourceUrl = sourceUrl.trim()
      }

      const res = await fetch("/api/platform/growth/copilot/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create source.")
      setTitle("")
      setRawContent("")
      setSourceUrl("")
      setTrainerName("")
      setSuccess("Source created.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setActing(null)
    }
  }

  async function extractSource(sourceId: string) {
    setActing(`extract:${sourceId}`)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/platform/growth/copilot/playbooks/sources/${sourceId}/extract`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        draftRuleCount?: number
        conflictCount?: number
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Extraction failed.")
      setSuccess(`Extracted ${data.draftRuleCount ?? 0} draft rule(s). Conflicts: ${data.conflictCount ?? 0}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.")
    } finally {
      setActing(null)
    }
  }

  async function reviewDraft(draftId: string, action: "approve" | "reject") {
    setActing(`${action}:${draftId}`)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/platform/growth/copilot/playbooks/drafts/${draftId}/${action}`, { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Review action failed.")
      setSuccess(action === "approve" ? "Draft approved into playbook library." : "Draft rejected.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.")
    } finally {
      setActing(null)
    }
  }

  async function disableRule(ruleId: string) {
    setActing(`disable:${ruleId}`)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/copilot/playbooks/approved/${ruleId}`, { method: "PATCH" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Disable failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disable failed.")
    } finally {
      setActing(null)
    }
  }

  if (loading && !payload) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading playbook training…
      </div>
    )
  }

  const activeRules = payload?.approvedRules.filter((rule) => rule.status === "active") ?? []
  const sourceCount = payload?.sources.length ?? 0
  const draftCount = payload?.draftRules.length ?? 0
  const isEmptyPlaybookState = sourceCount === 0 && draftCount === 0 && activeRules.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatTile label="Sources" value={String(sourceCount)} />
            <StatTile label="Review queue" value={String(draftCount)} />
            <StatTile label="Active rules" value={String(activeRules.length)} />
          </div>
          {isEmptyPlaybookState ? (
            <p className="mt-2 text-sm text-muted-foreground">No approved playbooks yet.</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <PlaybookWorkflowCard />
      <PlaybookInfoCard />

      <GrowthEngineCard title="Add training source">
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="playbook-source-type">Source type</Label>
            <select
              id="playbook-source-type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as SourceTypeOption)}
            >
              {SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="playbook-source-title">Title</Label>
            <Input
              id="playbook-source-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Medical Equipment Outreach Process"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="playbook-trainer-name">Trainer name (optional)</Label>
            <Input
              id="playbook-trainer-name"
              value={trainerName}
              onChange={(event) => setTrainerName(event.target.value)}
              placeholder="Trainer profile"
            />
          </div>

          {sourceType === "transcript_notes" ? (
            <div className="space-y-1">
              <Label htmlFor="playbook-transcript">Transcript / notes</Label>
              <textarea
                id="playbook-transcript"
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={rawContent}
                onChange={(event) => setRawContent(event.target.value)}
                placeholder="Paste sales training notes, call frameworks, objection handling guidance, or communication principles."
              />
              <p className="text-xs text-muted-foreground">
                AI extracts selling principles from source material. Human approval required before rules affect generation.
              </p>
            </div>
          ) : null}

          {sourceType === "youtube_link" ? (
            <div className="space-y-1">
              <Label htmlFor="playbook-youtube-url">YouTube URL</Label>
              <Input
                id="playbook-youtube-url"
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://youtube.com/..."
              />
              <p className="text-xs text-muted-foreground">
                AI extracts selling principles from source material. Human approval required before rules affect
                generation. Approved rules store principles only — not copyrighted transcript text verbatim.
                Transcript extraction from YouTube links will be supported in a future update.
              </p>
            </div>
          ) : null}

          {sourceType === "website_url" ? (
            <div className="space-y-1">
              <Label htmlFor="playbook-website-url">Website URL</Label>
              <Input
                id="playbook-website-url"
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Extract messaging frameworks, positioning, objection handling, and communication principles.
              </p>
            </div>
          ) : null}

          {sourceType === "document_upload" ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Document upload is coming soon. Use Transcript / Notes for now.
            </p>
          ) : null}

          <Button type="button" disabled={acting === "create" || !canCreateSource} onClick={() => void createSource()}>
            {acting === "create" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Add source
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Sources">
        {payload?.sources.length ? (
          <ul className="space-y-2">
            {payload.sources.map((source) => {
              const canExtract = Boolean(source.rawContent?.trim())
              const isLinkSource = source.sourceKind === "youtube_link" || source.sourceKind === "website_url"
              return (
                <li
                  key={source.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{source.title}</p>
                    <p className="text-muted-foreground">{sourceTypeLabel(source.sourceKind)}</p>
                    {source.sourceUrl ? (
                      <p className="text-xs text-muted-foreground break-all">{source.sourceUrl}</p>
                    ) : null}
                    {source.trainerProfile.name ? (
                      <p className="text-xs text-muted-foreground">Trainer: {source.trainerProfile.name}</p>
                    ) : null}
                    {isLinkSource && !canExtract ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Link saved. Automated content extraction from this source type is coming soon.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={source.status} tone={source.status === "extracted" ? "healthy" : "neutral"} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={acting === `extract:${source.id}` || !canExtract}
                      onClick={() => void extractSource(source.id)}
                    >
                      {acting === `extract:${source.id}` ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 size-3.5" />
                      )}
                      Extract rules
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No sources yet. Add training material to begin.</p>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Review queue">
        {payload?.draftRules.length ? (
          <ul className="space-y-2">
            {payload.draftRules.map((draft) => (
              <li key={draft.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{draft.title}</p>
                    <p className="text-muted-foreground">{draft.principle}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <GrowthBadge label={draft.category} tone="neutral" />
                      <GrowthBadge label={`priority ${draft.priority}`} tone="neutral" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={acting === `approve:${draft.id}`}
                      onClick={() => void reviewDraft(draft.id, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={acting === `reject:${draft.id}`}
                      onClick={() => void reviewDraft(draft.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No draft rules awaiting review.</p>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Approved playbook library">
        {activeRules.length ? (
          <ul className="space-y-2">
            {activeRules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{rule.title}</p>
                  <p className="text-muted-foreground">{rule.principle}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <GrowthBadge label={rule.category} tone="healthy" />
                    <GrowthBadge label={`v${rule.version}`} tone="neutral" />
                    {rule.trainerProfile.name ? (
                      <GrowthBadge label={rule.trainerProfile.name} tone="neutral" />
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={acting === `disable:${rule.id}`}
                  onClick={() => void disableRule(rule.id)}
                >
                  Disable
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active approved rules.</p>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Playbook effectiveness">
        {payload?.effectiveness.length ? (
          <ul className="space-y-2 text-sm">
            {payload.effectiveness.map((entry) => (
              <li key={entry.outcome} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="capitalize">{entry.outcome.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">
                  {entry.count} events · influence {entry.avgInfluence} · effectiveness {entry.avgEffectiveness}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No effectiveness events recorded yet.</p>
        )}
      </GrowthEngineCard>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
    </div>
  )
}
