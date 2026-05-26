"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { LEAD_ENGINE_ORCHESTRATOR_STAGES } from "@/lib/growth/lead-engine/orchestrator/lead-engine-orchestrator"
import type { GrowthLeadEngineOrchestratorStageResult } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { useAdmin } from "@/lib/admin-store"

function CollapsibleBlock({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {title}
      </button>
      {open ? <div className="border-t border-border px-3 py-3">{children}</div> : null}
    </div>
  )
}

function EvidenceList({
  items,
}: {
  items: Array<{ claim: string; evidence: string; source: string; confidence: number | null }>
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No evidence-backed items yet.</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border bg-background p-3 text-sm">
          <p className="font-medium">{item.claim}</p>
          <p className="mt-1 text-muted-foreground">{item.evidence}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {item.source}
            {item.confidence != null ? ` · ${(item.confidence <= 1 ? item.confidence * 100 : item.confidence).toFixed(0)}%` : ""}
          </p>
        </div>
      ))}
    </div>
  )
}

function StageResultCard({ stage }: { stage: GrowthLeadEngineOrchestratorStageResult }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="font-medium">{stage.label}</p>
        <div className="flex gap-2">
          <Badge variant={stage.status === "completed" ? "default" : "secondary"}>{stage.status}</Badge>
          {stage.human_review_required ? (
            <Badge variant="outline" className="border-amber-300 text-amber-900">
              review
            </Badge>
          ) : null}
        </div>
      </div>
      {stage.evidence?.summary ? (
        <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
          {stage.evidence.summary}
        </p>
      ) : null}
      {stage.parsed ? (
        <CollapsibleBlock title="Structured output" defaultOpen>
          <EvidenceSummaryFromParsed stage={stage} />
        </CollapsibleBlock>
      ) : null}
      <CollapsibleBlock title="Technical details (expand only if needed)">
        <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-xs">
          {stage.parsed ? JSON.stringify(stage.parsed, null, 2) : stage.raw_json || "(empty)"}
        </pre>
      </CollapsibleBlock>
    </div>
  )
}

function EvidenceSummaryFromParsed({ stage }: { stage: GrowthLeadEngineOrchestratorStageResult }) {
  const parsed = stage.parsed as Record<string, unknown> | null
  if (!parsed) return <p className="text-sm text-muted-foreground">No parsed output.</p>

  const highlights: string[] = []
  if (typeof parsed.lead_score === "number") highlights.push(`Lead score: ${parsed.lead_score}`)
  if (typeof parsed.disposition === "string") highlights.push(`Verification: ${parsed.disposition}`)
  if (typeof parsed.approval_status === "string") highlights.push(`Approval: ${parsed.approval_status}`)
  if (typeof parsed.company_summary === "string") highlights.push(parsed.company_summary)
  if (typeof parsed.execution_summary === "string") highlights.push(parsed.execution_summary)
  if (typeof parsed.score_explanation === "string") highlights.push(parsed.score_explanation)
  if (typeof parsed.evidence_summary === "string") highlights.push(parsed.evidence_summary)

  if (highlights.length === 0) {
    return <p className="text-sm text-muted-foreground">Stage completed — expand technical details if needed.</p>
  }

  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
      {highlights.slice(0, 6).map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

export function GrowthLeadOperatorWorkspace({ leadId }: { leadId: string }) {
  const { sessionIdentity } = useAdmin()
  const [workspace, setWorkspace] = useState<GrowthLeadOperatorWorkspacePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/lead-inbox/${leadId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        workspace?: GrowthLeadOperatorWorkspacePayload
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.workspace) {
        throw new Error(data.message ?? data.error ?? "Could not load operator workspace.")
      }
      setWorkspace(data.workspace)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load operator workspace.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(action: string, extra?: Record<string, unknown>) {
    setActing(action)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/lead-inbox/${leadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ownerId: sessionIdentity?.authUserId, ...extra }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        workspace?: GrowthLeadOperatorWorkspacePayload
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.workspace) {
        throw new Error(data.message ?? data.error ?? `Action ${action} failed.`)
      }
      setWorkspace(data.workspace)
    } catch (e) {
      setError(e instanceof Error ? e.message : `Action ${action} failed.`)
    } finally {
      setActing(null)
    }
  }

  const handoff = workspace?.operator_handoff
  const hints = workspace?.guidance_hints
  const run = workspace?.lead_engine_run

  const stageById = useMemo(() => {
    const map = new Map<string, GrowthLeadEngineOrchestratorStageResult>()
    for (const s of run?.stage_results ?? []) map.set(s.stage_id, s)
    return map
  }, [run])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading operator workspace…
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error ?? "Workspace not found."}
      </div>
    )
  }

  const card = workspace.card

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/growth/leads">← Lead Inbox</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!!acting}
            onClick={() => void runAction("claim")}
          >
            {acting === "claim" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Claim
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!acting}
            onClick={() => void runAction("assign_owner")}
          >
            Assign owner
          </Button>
          <Button size="sm" variant="outline" disabled={!!acting} onClick={() => void runAction("approve")}>
            Approve
          </Button>
          <Button
            size="sm"
            disabled={!!acting}
            onClick={() => void runAction("run_lead_engine")}
          >
            {acting === "run_lead_engine" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            Run Lead Engine
          </Button>
          <Button size="sm" variant="outline" disabled={!!acting} onClick={() => void runAction("archive")}>
            Archive
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!acting}
            onClick={() => void runAction("mark_duplicate")}
          >
            Mark duplicate
          </Button>
          <Button size="sm" variant="ghost" disabled={!!acting} onClick={() => void load()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{card.company_name}</h1>
            {card.domain ? <p className="text-sm text-muted-foreground">{card.domain}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Score {card.lead_score ?? "—"}</Badge>
            <Badge variant="secondary">Intent {card.intent_score} ({card.intent_grade})</Badge>
            <Badge variant="outline">{card.verification_state}</Badge>
            <Badge variant="outline">{card.recommended_motion.replace(/_/g, " ")}</Badge>
            <Badge variant="outline">{card.recommended_owner.replace(/_/g, " ")}</Badge>
            <Badge variant="outline">{card.recommended_urgency.replace(/_/g, " ")}</Badge>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Status {card.status} · Pipeline {card.pipeline_status} · {card.time_since_activity_label}
        </p>
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="intent">Intent Activity</TabsTrigger>
          <TabsTrigger value="engine">Lead Engine</TabsTrigger>
          <TabsTrigger value="guidance">Operator Guidance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {workspace.company_match ? (
            <GrowthEngineCard title="Company match (candidate)">
              <p className="text-sm font-medium">{workspace.company_match.company_name}</p>
              {workspace.company_match.company_domain ? (
                <p className="text-sm text-muted-foreground">{workspace.company_match.company_domain}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Source {workspace.company_match.matched_source.replace(/_/g, " ")} ·{" "}
                {workspace.company_match.match_type.replace(/_/g, " ")} · confidence{" "}
                {(workspace.company_match.match_confidence * 100).toFixed(0)}% · score{" "}
                {workspace.company_match.match_score}
              </p>
              <p className="mt-2 text-xs text-amber-800">
                Candidate match only — not guaranteed company identity. No IP-to-company claim.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{workspace.company_match.evidence}</p>
            </GrowthEngineCard>
          ) : null}
          <GrowthEngineCard title="Executive Summary">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {workspace.overview.executive_summary}
            </p>
          </GrowthEngineCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <GrowthEngineCard title="Pain Points">
              <EvidenceList items={workspace.overview.pain_points} />
            </GrowthEngineCard>
            <GrowthEngineCard title="Buying Signals">
              <EvidenceList items={workspace.overview.buying_signals} />
            </GrowthEngineCard>
            <GrowthEngineCard title="Growth Signals">
              <EvidenceList items={workspace.overview.growth_signals} />
            </GrowthEngineCard>
            <GrowthEngineCard title="Decision Maker Summary">
              <p className="text-sm text-muted-foreground">{workspace.overview.decision_maker_summary}</p>
            </GrowthEngineCard>
            <GrowthEngineCard title="Contact Summary">
              <p className="text-sm text-muted-foreground">{workspace.overview.contact_summary}</p>
              {!workspace.row.contact_identified ? (
                <p className="mt-2 text-xs text-amber-800">Contact PII hidden until identified via intent or research.</p>
              ) : null}
            </GrowthEngineCard>
            <GrowthEngineCard title="Verification Summary">
              <p className="text-sm text-muted-foreground">{workspace.overview.verification_summary}</p>
            </GrowthEngineCard>
          </div>
          <GrowthEngineCard title="Lead Score Summary">
            <p className="text-sm text-muted-foreground">{workspace.overview.lead_score_summary}</p>
          </GrowthEngineCard>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4 space-y-4">
          <GrowthEngineCard title="Evidence">
            <EvidenceList items={workspace.evidence.items} />
          </GrowthEngineCard>
          <GrowthEngineCard title="Attribution">
            <div className="space-y-2">
              {workspace.evidence.attribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attribution entries.</p>
              ) : (
                workspace.evidence.attribution.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">
                      {a.source} · {a.section}
                    </p>
                    <p className="text-muted-foreground">{a.signal}</p>
                    <p className="mt-1">{a.evidence}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {(a.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                ))
              )}
            </div>
          </GrowthEngineCard>
        </TabsContent>

        <TabsContent value="intent" className="mt-4 space-y-4">
          {workspace.search_intent_signals.length > 0 ? (
            <GrowthEngineCard title="Search intent signals">
              <div className="space-y-2">
                {workspace.search_intent_signals.map((signal) => (
                  <div key={signal.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{signal.intent_topic}</p>
                    <p className="text-xs text-muted-foreground">
                      {signal.intent_category.replace(/_/g, " ")} · {signal.intent_stage.replace(/_/g, " ")} · score{" "}
                      {signal.intent_score} · {signal.source_type.replace(/_/g, " ")}
                    </p>
                    {signal.keyword ? (
                      <p className="mt-1 text-xs">Keyword: {signal.keyword}</p>
                    ) : null}
                    <p className="mt-1 text-muted-foreground">{signal.evidence}</p>
                  </div>
                ))}
              </div>
            </GrowthEngineCard>
          ) : null}
          <GrowthEngineCard title="Intent Activity">
            {!workspace.intent_activity ? (
              <p className="text-sm text-muted-foreground">No intent session history loaded.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  {workspace.intent_activity.session_count} sessions ·{" "}
                  {workspace.intent_activity.total_pageviews} pageviews ·{" "}
                  {Math.round(workspace.intent_activity.total_time_on_site_ms / 1000)}s on site
                </p>
                <p className="text-muted-foreground">
                  UTM: {workspace.row.utm_source || "—"} / {workspace.row.utm_medium || "—"} /{" "}
                  {workspace.row.utm_campaign || "—"}
                </p>
                {workspace.intent_activity.sessions.map((session) => (
                  <div key={session.session_key} className="rounded-lg border border-border p-3">
                    <p className="font-medium">
                      Session {session.session_key.slice(0, 8)}… · {session.pageview_count} views
                      {session.is_identified ? " · identified" : " · anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.started_at} — {Math.round(session.total_time_on_site_ms / 1000)}s
                    </p>
                    {session.pageviews.length > 0 ? (
                      <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                        {session.pageviews.slice(-5).map((pv) => (
                          <li key={pv.id}>
                            {pv.page_path || pv.page_url}
                            {pv.duration_ms > 0 ? ` (${Math.round(pv.duration_ms / 1000)}s)` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {session.conversions.length > 0 ? (
                      <p className="mt-2 text-xs font-medium text-emerald-800">
                        Conversions: {session.conversions.map((c) => c.conversion_type).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </GrowthEngineCard>
        </TabsContent>

        <TabsContent value="engine" className="mt-4 space-y-4">
          {!run ? (
            <GrowthEngineCard title="Lead Engine">
              <p className="text-sm text-muted-foreground">
                Pipeline not run yet. Use Run Lead Engine to generate stage outputs (fixture mode, human review required).
              </p>
              <Button className="mt-3" size="sm" disabled={!!acting} onClick={() => void runAction("run_lead_engine")}>
                <Play className="mr-2 size-4" />
                Run Lead Engine
              </Button>
            </GrowthEngineCard>
          ) : (
            <>
              <GrowthEngineCard title="Pipeline status">
                <p className="text-sm text-muted-foreground">{run.execution_summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LEAD_ENGINE_ORCHESTRATOR_STAGES.map((def) => {
                    const stage = stageById.get(def.stageId)
                    return (
                      <Badge
                        key={def.stageId}
                        variant={stage?.status === "completed" ? "default" : "secondary"}
                      >
                        {def.shortLabel}
                      </Badge>
                    )
                  })}
                </div>
              </GrowthEngineCard>
              {run.stage_results.map((stage) => (
                <StageResultCard key={stage.stage_id} stage={stage} />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="guidance" className="mt-4 space-y-4">
          <GrowthEngineCard title="Why this matters">
            <p className="text-sm text-muted-foreground">
              {handoff?.why_this_matters ?? hints?.recommended_next_action ?? "Run Lead Engine for guidance."}
            </p>
          </GrowthEngineCard>
          <GrowthEngineCard title="Recommended next action">
            <p className="text-sm font-medium">
              {handoff?.recommended_next_action ?? hints?.recommended_next_action}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Follow-up: {handoff?.recommended_followup_window ?? hints?.recommended_followup_window}
            </p>
          </GrowthEngineCard>
          <GrowthEngineCard title="Missing information">
            <EvidenceList items={handoff?.missing_information ?? []} />
          </GrowthEngineCard>
          <GrowthEngineCard title="Objection preparation">
            <EvidenceList items={handoff?.objection_preparation ?? []} />
          </GrowthEngineCard>
          {handoff?.talking_point_summary ? (
            <GrowthEngineCard title="Talking points">
              <p className="text-sm text-muted-foreground">{handoff.talking_point_summary}</p>
            </GrowthEngineCard>
          ) : null}
          {handoff?.human_notes?.length ? (
            <GrowthEngineCard title="Operator notes">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {handoff.human_notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </GrowthEngineCard>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <GrowthEngineCard title="History">
            <ul className="space-y-3 text-sm">
              {workspace.history.map((entry) => (
                <li key={`${entry.at}-${entry.action}`} className="border-b border-border pb-2 last:border-0">
                  <p className="font-medium">{entry.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{entry.at}</p>
                  <p className="text-muted-foreground">{entry.note}</p>
                </li>
              ))}
            </ul>
          </GrowthEngineCard>
        </TabsContent>
      </Tabs>

      <p className="font-mono text-xs text-muted-foreground">{workspace.qa_marker}</p>
    </div>
  )
}
