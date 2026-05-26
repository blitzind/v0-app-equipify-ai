"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Play,
  Radar,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { LEAD_ENGINE_ORCHESTRATOR_STAGES } from "@/lib/growth/lead-engine/orchestrator/lead-engine-orchestrator"
import {
  GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER,
  type GrowthLeadEngineOrchestratorStageResult,
  type GrowthLeadEnginePipelineRun,
} from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"
import { cn } from "@/lib/utils"

const DEFAULT_INPUT: GrowthLeadEngineSandboxInput = {
  companyName: "Precision Biomedical Services",
  domain: "precisionbiomed.example",
  industry: "Biomedical field service",
  location: "United States",
  notes: "Multi-site dispatch coordination mentioned in operator context.",
}

function stageStatusIcon(status: GrowthLeadEngineOrchestratorStageResult["status"]) {
  if (status === "completed") return <CheckCircle2 className="size-4 text-emerald-600" />
  if (status === "failed") return <XCircle className="size-4 text-destructive" />
  if (status === "skipped") return <Circle className="size-4 text-muted-foreground" />
  return <Circle className="size-4 text-muted-foreground" />
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {title}
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  )
}

function StagePanel({ stage }: { stage: GrowthLeadEngineOrchestratorStageResult }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {stageStatusIcon(stage.status)}
          <div>
            <p className="font-medium">{stage.label}</p>
            <p className="font-mono text-xs text-muted-foreground">{stage.qa_marker}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              stage.status === "completed"
                ? "default"
                : stage.status === "failed"
                  ? "destructive"
                  : "secondary"
            }
          >
            {stage.status}
          </Badge>
          {stage.duration_ms > 0 ? (
            <Badge variant="outline">
              <Clock className="mr-1 size-3" />
              {stage.duration_ms}ms
            </Badge>
          ) : null}
          {stage.confidence != null ? (
            <Badge variant="outline">
              {(stage.confidence <= 1 ? stage.confidence * 100 : stage.confidence).toFixed(0)}%
            </Badge>
          ) : null}
          {stage.human_review_required ? (
            <Badge variant="outline" className="border-amber-300 text-amber-900">
              review
            </Badge>
          ) : null}
          {stage.fatal ? <Badge variant="destructive">fatal</Badge> : null}
        </div>
      </div>

      {stage.parse_message ? (
        <div className="border-b border-border bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {stage.parse_message}
        </div>
      ) : null}

      {stage.warnings.length > 0 ? (
        <div className="border-b border-border bg-amber-50 px-4 py-2 text-sm text-amber-950">
          {stage.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      ) : null}

      <CollapsibleSection title="Output" defaultOpen>
        <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
          {stage.parsed ? JSON.stringify(stage.parsed, null, 2) : "(no parsed output)"}
        </pre>
      </CollapsibleSection>

      <CollapsibleSection title="Raw JSON">
        <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
          {stage.raw_json || "(not run)"}
        </pre>
      </CollapsibleSection>

      <CollapsibleSection title={`Evidence (${stage.evidence?.items.length ?? 0})`}>
        {stage.evidence ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">{stage.evidence.summary}</p>
            {stage.evidence.items.map((item, i) => (
              <div key={i} className="rounded border border-border bg-background p-2">
                <p className="font-medium">{item.claim || "(claim)"}</p>
                <p className="text-muted-foreground">{item.evidence}</p>
                <p className="font-mono text-xs">{item.source}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No evidence extracted.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title={`Attribution (${stage.attribution.length})`}>
        {stage.attribution.length > 0 ? (
          <div className="space-y-2">
            {stage.attribution.map((row, i) => (
              <div key={i} className="rounded border border-border bg-background p-2 text-sm">
                <p>
                  <span className="font-medium">{row.source}</span> · {row.section} · {row.signal}
                </p>
                <p className="text-muted-foreground">{row.evidence}</p>
                <p className="font-mono text-xs">confidence {(row.confidence * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No attribution entries.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title={`Diagnostics (${stage.diagnostics.length})`}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {stage.diagnostics.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </CollapsibleSection>
    </div>
  )
}

function PipelineVisualization({
  run,
}: {
  run: GrowthLeadEnginePipelineRun | null
}) {
  const stageById = useMemo(() => {
    const map = new Map<string, GrowthLeadEngineOrchestratorStageResult>()
    for (const s of run?.stage_results ?? []) map.set(s.stage_id, s)
    return map
  }, [run])

  return (
    <div className="flex flex-wrap gap-2">
      {LEAD_ENGINE_ORCHESTRATOR_STAGES.map((def, index) => {
        const stage = stageById.get(def.stageId)
        const completed = stage?.status === "completed"
        const failed = stage?.status === "failed"
        return (
          <div key={def.stageId} className="flex items-center gap-1">
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-center text-xs",
                completed && "border-emerald-300 bg-emerald-50 text-emerald-900",
                failed && "border-destructive/40 bg-destructive/5 text-destructive",
                !stage && "border-border bg-muted/30 text-muted-foreground",
                stage?.status === "skipped" && "border-border bg-muted/20",
              )}
            >
              <p className="font-semibold">{def.shortLabel}</p>
              <p className="text-[10px] opacity-80">{stage?.status ?? "pending"}</p>
            </div>
            {index < LEAD_ENGINE_ORCHESTRATOR_STAGES.length - 1 ? (
              <ChevronRight className="size-4 text-muted-foreground" />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function GrowthLeadEngineWorkspace() {
  const [input, setInput] = useState<GrowthLeadEngineSandboxInput>(DEFAULT_INPUT)
  const [run, setRun] = useState<GrowthLeadEnginePipelineRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Sparkles size={17} />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Lead Engine</h2>
                <p className="text-sm text-muted-foreground">
                  Orchestrated pipeline (Prompts 1–10) — fixture dry-run with parser enforcement. Admin / internal testing only.
                </p>
              </div>
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">QA: {GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/growth/leads">Back to Inbox</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Sandbox input</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Operator context drives fixture stubs. No provider integrations or outbound execution.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={input.companyName}
              onChange={(e) => setInput((p) => ({ ...p, companyName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Website / domain</Label>
            <Input
              id="domain"
              value={input.domain}
              onChange={(e) => setInput((p) => ({ ...p, domain: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={input.industry}
              onChange={(e) => setInput((p) => ({ ...p, industry: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={input.location}
              onChange={(e) => setInput((p) => ({ ...p, location: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes / ICP context</Label>
            <Textarea
              id="notes"
              rows={3}
              value={input.notes}
              onChange={(e) => setInput((p) => ({ ...p, notes: e.target.value }))}
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
      </section>

      {run ? (
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
                {run.completed_stages.length}/{LEAD_ENGINE_ORCHESTRATOR_STAGES.length}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{run.execution_summary}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">run_id: {run.run_id}</p>

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

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Pipeline</p>
            <PipelineVisualization run={run} />
          </div>

          <CollapsibleSection title={`Pipeline diagnostics (${run.pipeline_diagnostics.length})`} defaultOpen>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {run.pipeline_diagnostics.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title={`Attribution chain (${run.pipeline_attribution_chain.length})`}>
            <div className="max-h-48 space-y-2 overflow-auto text-sm">
              {run.pipeline_attribution_chain.map((row, i) => (
                <div key={i} className="rounded border border-border p-2">
                  <span className="font-mono text-xs">{row.stage_id}</span> · {row.source} — {row.evidence}
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={`Evidence chain (${run.pipeline_evidence_chain.length})`}>
            <div className="max-h-48 space-y-2 overflow-auto text-sm">
              {run.pipeline_evidence_chain.map((row, i) => (
                <div key={i} className="rounded border border-border p-2">
                  <span className="font-mono text-xs">{row.stage_id}</span> — {row.summary}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h3 className="font-semibold">Stage outputs</h3>
        {LEAD_ENGINE_ORCHESTRATOR_STAGES.map((def) => {
          const stage =
            run?.stage_results.find((s) => s.stage_id === def.stageId) ??
            ({
              stage_id: def.stageId,
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
          return <StagePanel key={def.stageId} stage={stage} />
        })}
      </section>

      <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Radar size={17} />
          </span>
          <div>
            <h3 className="font-semibold text-violet-950">North Star — Real-Time Intent Pixel</h3>
            <p className="mt-1 text-sm text-violet-900/90">Future capability placeholder — not active in this slice.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-violet-900/85">
              <li>Website visitor tracking and session history</li>
              <li>Page visit history and time on site</li>
              <li>Form capture attribution and conversion events</li>
              <li>Company / domain identification when available</li>
              <li>Lead enrichment hooks with consent- and privacy-safe tracking</li>
            </ul>
            <p className="mt-3 rounded-lg border border-violet-200/80 bg-white/60 px-3 py-2 text-sm text-violet-950">
              <strong>Privacy boundary:</strong> PII is captured only when the visitor submits it, identifies via form,
              booking, chat, login, or a compliant enrichment source — not from anonymous traffic alone.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
