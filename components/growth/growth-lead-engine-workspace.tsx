"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, Loader2, Play, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LeadIntelligenceExamplePresets } from "@/components/growth/lead-intelligence-inspector/lead-intelligence-example-presets"
import { LeadIntelligenceOperatorSummaryCard } from "@/components/growth/lead-intelligence-inspector/lead-intelligence-operator-summary-card"
import { LeadIntelligencePipelineHeader } from "@/components/growth/lead-intelligence-inspector/lead-intelligence-pipeline-header"
import {
  LeadIntelligenceStagePanel,
  LeadIntelligenceTechnicalDetails,
} from "@/components/growth/lead-intelligence-inspector/lead-intelligence-stage-panel"
import { LeadIntelligenceSystemStatusPanel } from "@/components/growth/lead-intelligence-inspector/lead-intelligence-system-status-panel"
import { LeadIntelligenceWorkflowCard } from "@/components/growth/lead-intelligence-inspector/lead-intelligence-workflow-card"
import { LEAD_INTELLIGENCE_INSPECTOR_DEFAULT_INPUT } from "@/lib/growth/lead-engine/lead-intelligence-inspector-fixtures"
import { GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER } from "@/lib/growth/lead-engine/lead-intelligence-inspector-types"
import { LEAD_ENGINE_STAGE_UI } from "@/lib/growth/lead-engine/lead-engine-stage-ui"
import type { LeadIntelligenceStageDisplayContext } from "@/lib/growth/lead-engine/lead-intelligence-stage-display"
import {
  type GrowthLeadEngineOrchestratorStageResult,
  type GrowthLeadEnginePipelineRun,
} from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"
import { parseProspectSearchLeadEngineHandoffParams } from "@/lib/growth/prospect-search/prospect-search-lead-engine-handoff"
import {
  decodeGrowthWorkflowContext,
  summarizeGrowthWorkflowContext,
} from "@/lib/growth/prospect-search/prospect-workflow-context"

export function GrowthLeadEngineWorkspace() {
  const searchParams = useSearchParams()
  const [input, setInput] = useState<GrowthLeadEngineSandboxInput>(LEAD_INTELLIGENCE_INSPECTOR_DEFAULT_INPUT)
  const [activePresetId, setActivePresetId] = useState<string | null>("medical-equipment")
  const [run, setRun] = useState<GrowthLeadEnginePipelineRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handoffApplied, setHandoffApplied] = useState(false)
  const [contactHandoff, setContactHandoff] = useState<
    import("@/lib/growth/prospect-search/prospect-search-contact-intelligence-types").ProspectSearchLeadEngineContactHandoffContext | null
  >(null)
  const [workflowContextSummary, setWorkflowContextSummary] = useState<string | null>(null)

  useEffect(() => {
    if (handoffApplied || !searchParams) return
    const handoff = parseProspectSearchLeadEngineHandoffParams(searchParams)
    if (!handoff) return
    setInput(handoff)
    setContactHandoff(handoff.contactHandoff ?? null)
    const workflowContext = decodeGrowthWorkflowContext(searchParams.get("workflowContext"))
    setWorkflowContextSummary(workflowContext ? summarizeGrowthWorkflowContext(workflowContext) : null)
    setActivePresetId(null)
    setHandoffApplied(true)
  }, [handoffApplied, searchParams])

  async function runPipeline() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/lead-engine/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        run?: GrowthLeadEnginePipelineRun
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.run) {
        throw new Error(data.message ?? data.error ?? "Lead Engine pipeline failed.")
      }
      setRun(data.run)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lead Engine pipeline failed.")
    } finally {
      setLoading(false)
    }
  }

  function applyPreset(next: GrowthLeadEngineSandboxInput, id: string) {
    setInput(next)
    setActivePresetId(id)
    setError(null)
  }

  const stageDisplayContext: LeadIntelligenceStageDisplayContext = {
    hasRun: Boolean(run),
    loading,
    runStatus: run?.pipeline_status ?? null,
    completedStageIds: run?.completed_stages ?? [],
    currentStageId: run?.current_stage ?? null,
    isSampleMode: run?.mode === "fixture_dry_run" || !run,
  }

  return (
    <div className="flex flex-col gap-6" data-qa-marker={GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER}>
      <LeadIntelligenceWorkflowCard />

      <LeadIntelligencePipelineHeader run={run} loading={loading} />

      <LeadIntelligenceSystemStatusPanel run={run} />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold">Account input</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Load an example account or enter company context, then run the Lead Engine pipeline.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/growth/queue">Revenue Queue</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/growth/search">
                <Search className="mr-1.5 size-3.5" />
                Prospect Search
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <LeadIntelligenceExamplePresets activeId={activePresetId} onSelect={applyPreset} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={input.companyName}
              onChange={(e) => {
                setActivePresetId(null)
                setInput((p) => ({ ...p, companyName: e.target.value }))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Website / domain</Label>
            <Input
              id="domain"
              value={input.domain}
              onChange={(e) => {
                setActivePresetId(null)
                setInput((p) => ({ ...p, domain: e.target.value }))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={input.industry}
              onChange={(e) => {
                setActivePresetId(null)
                setInput((p) => ({ ...p, industry: e.target.value }))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={input.location}
              onChange={(e) => {
                setActivePresetId(null)
                setInput((p) => ({ ...p, location: e.target.value }))
              }}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes / ICP context</Label>
            <Textarea
              id="notes"
              rows={3}
              value={input.notes}
              onChange={(e) => {
                setActivePresetId(null)
                setInput((p) => ({ ...p, notes: e.target.value }))
              }}
            />
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={() => void runPipeline()} disabled={loading || !input.companyName.trim()}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Run Lead Engine
          </Button>
        </div>

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {contactHandoff ? (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-sm text-violet-950">
            <p className="font-semibold">Prospect Search contact context preloaded</p>
            {contactHandoff.summary ? (
              <p className="mt-1 text-xs">{contactHandoff.summary}</p>
            ) : (
              <p className="mt-1 text-xs">
                {contactHandoff.contact_count} evidence-backed contact
                {contactHandoff.contact_count === 1 ? "" : "s"}
                {contactHandoff.first_contact_role
                  ? ` · first contact: ${contactHandoff.first_contact_role}`
                  : ""}
                {contactHandoff.first_contact_confidence != null
                  ? ` (${Math.round(contactHandoff.first_contact_confidence * 100)}%)`
                  : ""}
              </p>
            )}
          </div>
        ) : null}

        {workflowContextSummary ? (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm text-sky-950">
            <p className="font-semibold">Prospect workflow continuity</p>
            <p className="mt-1 text-xs">{workflowContextSummary}</p>
          </div>
        ) : null}

      </section>

      {run ? (
        <>
          <LeadIntelligenceOperatorSummaryCard run={run} />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-semibold">Execution summary</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="mt-1 font-semibold">{run.pipeline_status}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="mt-1 font-semibold">{run.execution_duration_ms}ms</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="mt-1 font-semibold">{(run.pipeline_confidence * 100).toFixed(0)}%</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Stages</p>
              <p className="mt-1 font-semibold">
                {run.completed_stages.length}/{LEAD_ENGINE_STAGE_UI.length}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{run.execution_summary}</p>

          {run.fatal_errors.length > 0 ? (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <p className="font-medium">Fatal errors</p>
              <ul className="mt-1 list-disc pl-5">
                {run.fatal_errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {run.warning_messages.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-medium">Warnings</p>
              <ul className="mt-1 list-disc pl-5">
                {run.warning_messages.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <LeadIntelligenceTechnicalDetails
            title={`Technical Details (${run.pipeline_diagnostics.length} diagnostics)`}
            className="mt-4"
          >
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Pipeline diagnostics</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {run.pipeline_diagnostics.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Attribution chain ({run.pipeline_attribution_chain.length})
                </p>
                <div className="max-h-48 space-y-2 overflow-auto text-sm">
                  {run.pipeline_attribution_chain.map((row, i) => (
                    <div key={i} className="rounded border border-border p-2">
                      <span className="font-mono text-xs">{row.stage_id}</span> · {row.source} — {row.evidence}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Evidence chain ({run.pipeline_evidence_chain.length})
                </p>
                <div className="max-h-48 space-y-2 overflow-auto text-sm">
                  {run.pipeline_evidence_chain.map((row, i) => (
                    <div key={i} className="rounded border border-border p-2">
                      <span className="font-mono text-xs">{row.stage_id}</span> — {row.summary}
                    </div>
                  ))}
                </div>
              </div>

              <p className="font-mono text-[10px] text-muted-foreground">run_id: {run.run_id}</p>
            </div>
          </LeadIntelligenceTechnicalDetails>
        </section>
        </>
      ) : null}

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold">Stage intelligence</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidence-backed operator panels for each pipeline stage — expand structured output only when needed.
          </p>
        </div>
        {LEAD_ENGINE_STAGE_UI.map((def) => {
          const stage =
            run?.stage_results.find((s) => s.stage_id === def.stageKey) ??
            ({
              stage_id: def.stageKey,
              label: def.label,
              short_label: def.shortLabel,
              qa_marker: def.qaMarker,
              status: "pending",
              duration_ms: 0,
              raw_json: "",
              parsed: null,
              parse_ok: false,
              parse_message: null,
              confidence: null,
              human_review_required: null,
              attribution: [],
              evidence: null,
              diagnostics: [],
              fatal: false,
              warnings: [],
            } satisfies GrowthLeadEngineOrchestratorStageResult)
          return (
            <LeadIntelligenceStagePanel
              key={def.stageKey}
              stage={stage}
              stageDef={def}
              displayContext={stageDisplayContext}
            />
          )
        })}
      </section>
    </div>
  )
}
