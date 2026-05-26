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
import { VerificationEnrichmentCard } from "@/components/growth/lead-operator/verification-enrichment-card"
import { HighIntentActivityCard } from "@/components/growth/revenue-intelligence/high-intent-activity-card"
import { RevenueIntelligenceWorkspaceLayout } from "@/components/growth/revenue-intelligence/workspace-layout"
import { LEAD_ENGINE_STAGE_UI } from "@/lib/growth/lead-engine/lead-engine-stage-ui"
import type { GrowthLeadEngineOrchestratorStageResult } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { formatLabel } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
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
            {item.confidence != null
              ? ` · ${(item.confidence <= 1 ? item.confidence * 100 : item.confidence).toFixed(0)}%`
              : ""}
          </p>
        </div>
      ))}
    </div>
  )
}

function StageResultCard({ stage }: { stage: GrowthLeadEngineOrchestratorStageResult }) {
  const parsed = stage.parsed as Record<string, unknown> | null
  const highlights: string[] = []
  if (typeof parsed?.lead_score === "number") highlights.push(`Lead score ${parsed.lead_score}`)
  if (typeof parsed?.disposition === "string") highlights.push(`Verification: ${parsed.disposition}`)
  if (typeof parsed?.approval_status === "string") highlights.push(`Approval: ${parsed.approval_status}`)
  if (typeof parsed?.company_summary === "string") highlights.push(parsed.company_summary)
  if (typeof parsed?.execution_summary === "string") highlights.push(parsed.execution_summary)
  if (typeof parsed?.score_explanation === "string") highlights.push(parsed.score_explanation)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="font-medium">{stage.label}</p>
        <div className="flex gap-2">
          <Badge variant={stage.status === "completed" ? "default" : "secondary"}>
            {formatLabel(stage.status)}
          </Badge>
          {stage.human_review_required ? (
            <Badge variant="outline" className="border-amber-300 text-amber-900">
              review
            </Badge>
          ) : null}
        </div>
      </div>
      {stage.evidence?.summary ? (
        <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">{stage.evidence.summary}</p>
      ) : null}
      {highlights.length > 0 ? (
        <ul className="list-disc space-y-1 px-4 py-3 pl-8 text-sm text-muted-foreground">
          {highlights.slice(0, 5).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">Stage output available — expand technical details if needed.</p>
      )}
      <CollapsibleBlock title="Technical details">
        <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-xs">
          {stage.parsed ? JSON.stringify(stage.parsed, null, 2) : stage.raw_json || "(empty)"}
        </pre>
      </CollapsibleBlock>
    </div>
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

  const searchEvidence = (workspace?.search_intent_signals ?? []).map((s) => ({
    claim: s.intent_topic,
    evidence: s.evidence,
    source: `search_intent · ${s.source_type}`,
    confidence: s.intent_score / 100,
  }))

  const companyEvidence = workspace?.company_match
    ? [
        {
          claim: `Company: ${workspace.company_match.company_name}`,
          evidence: workspace.company_match.evidence,
          source: `company_identification · ${workspace.company_match.matched_source}`,
          confidence: workspace.company_match.match_confidence,
        },
      ]
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading revenue intelligence workspace…
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

  const actionsBar = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <Button asChild variant="outline" size="sm">
        <Link href="/admin/growth/leads">← Revenue intelligence inbox</Link>
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!acting} onClick={() => void runAction("claim")}>
          {acting === "claim" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Claim
        </Button>
        <Button size="sm" variant="outline" disabled={!!acting} onClick={() => void runAction("assign_owner")}>
          Assign owner
        </Button>
        <Button size="sm" variant="outline" disabled={!!acting} onClick={() => void runAction("approve")}>
          Approve
        </Button>
        <Button size="sm" disabled={!!acting} onClick={() => void runAction("run_lead_engine")}>
          {acting === "run_lead_engine" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Play className="mr-2 size-4" />
          )}
          Refresh intelligence
        </Button>
        <Button size="sm" variant="outline" disabled={!!acting} onClick={() => void runAction("archive")}>
          Archive
        </Button>
        <Button size="sm" variant="outline" disabled={!!acting} onClick={() => void runAction("mark_duplicate")}>
          Mark duplicate
        </Button>
        <Button size="sm" variant="ghost" disabled={!!acting} onClick={() => void load()}>
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <RevenueIntelligenceWorkspaceLayout workspace={workspace} actions={
      <>
        {actionsBar}
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </div>
        ) : null}
      </>
    }>
      <Tabs defaultValue="guidance" className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="guidance">Operator guidance</TabsTrigger>
          <TabsTrigger value="intent">Intent activity</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="engine">Lead intelligence</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="guidance" className="mt-4 space-y-4">
          {typeof workspace.row.metadata?.prospect_search === "object" &&
          workspace.row.metadata.prospect_search &&
          typeof (workspace.row.metadata.prospect_search as Record<string, unknown>).source_id ===
            "string" &&
          (workspace.row.metadata.prospect_search as Record<string, unknown>).source_type ===
            "external_discovered" ? (
            <VerificationEnrichmentCard
              companyCandidateId={
                (workspace.row.metadata.prospect_search as Record<string, unknown>).source_id as string
              }
            />
          ) : null}
          <GrowthEngineCard title="Next action">
            <p className="text-sm font-medium text-foreground">
              {handoff?.recommended_next_action ?? hints?.recommended_next_action}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Recommended timing: {handoff?.recommended_followup_window ?? hints?.recommended_followup_window}
            </p>
          </GrowthEngineCard>
          <GrowthEngineCard title="Missing information">
            <EvidenceList items={handoff?.missing_information ?? []} />
          </GrowthEngineCard>
          <GrowthEngineCard title="Objection preparation">
            <EvidenceList items={handoff?.objection_preparation ?? []} />
          </GrowthEngineCard>
          <GrowthEngineCard title="Follow-up recommendation">
            <p className="text-sm text-muted-foreground">
              {handoff?.recommended_followup_window ?? hints?.recommended_followup_window} —{" "}
              {formatLabel(handoff?.recommended_channel ?? hints?.recommended_channel ?? "none")} channel when approved for outreach.
            </p>
          </GrowthEngineCard>
          {handoff?.talking_point_summary ? (
            <GrowthEngineCard title="Talking points">
              <p className="text-sm text-muted-foreground">{handoff.talking_point_summary}</p>
            </GrowthEngineCard>
          ) : null}
        </TabsContent>

        <TabsContent value="intent" className="mt-4 space-y-4">
          <GrowthEngineCard title="High-intent activity">
            <HighIntentActivityCard
              intentActivity={workspace.intent_activity}
              searchSignals={workspace.search_intent_signals}
            />
          </GrowthEngineCard>
          <GrowthEngineCard title="Session history">
            {!workspace.intent_activity ? (
              <p className="text-sm text-muted-foreground">No intent session history loaded.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  {workspace.intent_activity.session_count} sessions ·{" "}
                  {workspace.intent_activity.total_pageviews} pageviews · visit frequency{" "}
                  {workspace.row.session_count > 1 ? "returning" : "first visit"} · page depth{" "}
                  {workspace.row.visit_count} views
                </p>
                {workspace.intent_activity.sessions.map((session) => (
                  <div key={session.session_key} className="rounded-lg border border-border p-3">
                    <p className="font-medium">
                      Session · {session.pageview_count} views
                      {session.is_identified ? " · identified" : " · anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(session.total_time_on_site_ms / 1000)}s on site
                    </p>
                    {session.pageviews.length > 0 ? (
                      <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                        {session.pageviews.slice(-8).map((pv) => (
                          <li key={pv.id}>
                            {pv.page_path || pv.page_url}
                            {pv.duration_ms > 0 ? ` (${Math.round(pv.duration_ms / 1000)}s)` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {session.conversions.length > 0 ? (
                      <p className="mt-2 text-xs font-medium text-emerald-800">
                        Conversions: {session.conversions.map((c) => c.conversion_type.replace(/_/g, " ")).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </GrowthEngineCard>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4 space-y-4">
          <GrowthEngineCard title="Evidence cards">
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
          {searchEvidence.length > 0 ? (
            <GrowthEngineCard title="Search intent evidence">
              <EvidenceList items={searchEvidence} />
            </GrowthEngineCard>
          ) : null}
          {companyEvidence.length > 0 ? (
            <GrowthEngineCard title="Company identification evidence">
              <EvidenceList items={companyEvidence} />
            </GrowthEngineCard>
          ) : null}
        </TabsContent>

        <TabsContent value="engine" className="mt-4 space-y-4">
          {!run ? (
            <GrowthEngineCard title="Lead intelligence">
              <p className="text-sm text-muted-foreground">
                Intelligence package not generated yet. Run refresh to produce scores, verification, and operator guidance.
              </p>
              <Button className="mt-3" size="sm" disabled={!!acting} onClick={() => void runAction("run_lead_engine")}>
                <Play className="mr-2 size-4" />
                Refresh intelligence
              </Button>
            </GrowthEngineCard>
          ) : (
            <>
              <GrowthEngineCard title="Pipeline intelligence">
                <p className="text-sm text-muted-foreground">{run.execution_summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LEAD_ENGINE_STAGE_UI.map((def) => {
                    const stage = stageById.get(def.stageKey)
                    return (
                      <Badge
                        key={def.stageKey}
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

        <TabsContent value="history" className="mt-4">
          <GrowthEngineCard title="Activity history">
            <ul className="space-y-3 text-sm">
              {workspace.history.map((entry) => (
                <li key={`${entry.at}-${entry.action}`} className="border-b border-border pb-2 last:border-0">
                  <p className="font-medium capitalize">{formatLabel(entry.action)}</p>
                  <p className="text-xs text-muted-foreground">{entry.at}</p>
                  <p className="text-muted-foreground">{entry.note}</p>
                </li>
              ))}
            </ul>
          </GrowthEngineCard>
        </TabsContent>
      </Tabs>
    </RevenueIntelligenceWorkspaceLayout>
  )
}
