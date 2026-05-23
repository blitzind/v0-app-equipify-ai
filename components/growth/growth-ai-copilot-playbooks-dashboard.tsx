"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, RefreshCw, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthAiCopilotPlaybookApprovedRule,
  GrowthAiCopilotPlaybookDraftRule,
  GrowthAiCopilotPlaybookSource,
} from "@/lib/growth/ai-copilot-playbook-types"

type PlaybooksPayload = {
  sources: GrowthAiCopilotPlaybookSource[]
  draftRules: GrowthAiCopilotPlaybookDraftRule[]
  approvedRules: GrowthAiCopilotPlaybookApprovedRule[]
  effectiveness: Array<{ outcome: string; count: number; avgInfluence: number; avgEffectiveness: number }>
}

export function GrowthAiCopilotPlaybooksDashboard() {
  const [payload, setPayload] = useState<PlaybooksPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [rawContent, setRawContent] = useState("")
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

  async function createSource() {
    setActing("create")
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/platform/growth/copilot/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sourceKind: "pasted_notes",
          rawContent: rawContent.trim(),
          trainerProfile: trainerName.trim() ? { name: trainerName.trim() } : undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create source.")
      setTitle("")
      setRawContent("")
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatTile label="Sources" value={String(payload?.sources.length ?? 0)} />
          <StatTile label="Review queue" value={String(payload?.draftRules.length ?? 0)} />
          <StatTile label="Active rules" value={String(activeRules.length)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1 size-3.5" />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/copilot">Back to Copilot</Link>
          </Button>
        </div>
      </div>

      <GrowthEngineCard title="Add training source">
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Yurp cold email principles" />
          </div>
          <div className="space-y-1">
            <Label>Trainer name (optional)</Label>
            <Input value={trainerName} onChange={(event) => setTrainerName(event.target.value)} placeholder="Trainer profile" />
          </div>
          <div className="space-y-1">
            <Label>Transcript / notes</Label>
            <textarea
              className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={rawContent}
              onChange={(event) => setRawContent(event.target.value)}
              placeholder="Paste transcript or training notes. AI extracts principles — not verbatim storage in approved rules."
            />
          </div>
          <Button type="button" disabled={acting === "create" || title.trim().length < 3 || rawContent.trim().length < 20} onClick={() => void createSource()}>
            {acting === "create" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Add source
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Sources">
        {payload?.sources.length ? (
          <ul className="space-y-2">
            {payload.sources.map((source) => (
              <li key={source.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{source.title}</p>
                  <p className="text-muted-foreground capitalize">{source.sourceKind.replace(/_/g, " ")}</p>
                  {source.trainerProfile.name ? (
                    <p className="text-xs text-muted-foreground">Trainer: {source.trainerProfile.name}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={source.status} tone={source.status === "extracted" ? "healthy" : "neutral"} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={acting === `extract:${source.id}` || !source.rawContent}
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
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No sources yet.</p>
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
              <li key={rule.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
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
                <Button type="button" size="sm" variant="ghost" disabled={acting === `disable:${rule.id}`} onClick={() => void disableRule(rule.id)}>
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
