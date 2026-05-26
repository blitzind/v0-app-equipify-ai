"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
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
import { GROWTH_LEAD_ENGINE_PIPELINE_STAGES } from "@/lib/growth/lead-engine/run-sandbox-pipeline"
import {
  GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER,
  type GrowthLeadEnginePipelineStageResult,
  type GrowthLeadEngineSandboxInput,
  type GrowthLeadEngineSandboxPipelineResult,
} from "@/lib/growth/lead-engine/workspace-types"
import { cn } from "@/lib/utils"

const DEFAULT_INPUT: GrowthLeadEngineSandboxInput = {
  companyName: "Precision Biomedical Services",
  domain: "precisionbiomed.example",
  industry: "Biomedical field service",
  location: "United States",
  notes: "Multi-site dispatch coordination mentioned in operator context.",
}

function statusIcon(status: GrowthLeadEnginePipelineStageResult["status"]) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-emerald-600" />
  if (status === "error") return <XCircle className="size-4 text-destructive" />
  if (status === "pending") return <Circle className="size-4 text-muted-foreground" />
  return <Circle className="size-4 text-muted-foreground" />
}

function StagePanel({ stage }: { stage: GrowthLeadEnginePipelineStageResult }) {
  const [tab, setTab] = useState<"parsed" | "raw">("parsed")

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {statusIcon(stage.status)}
          <div>
            <p className="font-medium">{stage.label}</p>
            <p className="font-mono text-xs text-muted-foreground">{stage.qaMarker}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={stage.status === "ok" ? "default" : stage.status === "error" ? "destructive" : "secondary"}>
            {stage.status}
          </Badge>
          {stage.confidence != null ? (
            <Badge variant="outline">
              confidence {(stage.confidence <= 1 ? stage.confidence * 100 : stage.confidence).toFixed(0)}%
            </Badge>
          ) : null}
          {stage.humanReviewRequired === true ? (
            <Badge variant="outline" className="border-amber-300 text-amber-900">
              human review
            </Badge>
          ) : null}
        </div>
      </div>

      {stage.parseMessage ? (
        <div className="border-b border-border bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {stage.parseMessage}
        </div>
      ) : null}

      {stage.evidenceSummary ? (
        <div className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Evidence: </span>
          {stage.evidenceSummary}
        </div>
      ) : null}

      <div className="flex gap-1 border-b border-border px-4 pt-2">
        <button
          type="button"
          className={cn(
            "rounded-t-md px-3 py-1.5 text-sm",
            tab === "parsed" ? "bg-muted font-medium" : "text-muted-foreground",
          )}
          onClick={() => setTab("parsed")}
        >
          Parsed output
        </button>
        <button
          type="button"
          className={cn(
            "rounded-t-md px-3 py-1.5 text-sm",
            tab === "raw" ? "bg-muted font-medium" : "text-muted-foreground",
          )}
          onClick={() => setTab("raw")}
        >
          Raw JSON
        </button>
      </div>

      <pre className="max-h-80 overflow-auto p-4 font-mono text-xs leading-relaxed">
        {tab === "parsed"
          ? stage.parsed
            ? JSON.stringify(stage.parsed, null, 2)
            : "(no parsed output)"
          : stage.rawJson || "(not run)"}
      </pre>
    </div>
  )
}

export function GrowthLeadEngineWorkspace() {
  const [input, setInput] = useState<GrowthLeadEngineSandboxInput>(DEFAULT_INPUT)
  const [result, setResult] = useState<GrowthLeadEngineSandboxPipelineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stageById = useMemo(() => {
    const map = new Map<string, GrowthLeadEnginePipelineStageResult>()
    for (const stage of result?.stages ?? []) {
      map.set(stage.stageId, stage)
    }
    return map
  }, [result])

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
        result?: GrowthLeadEngineSandboxPipelineResult
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.result) {
        throw new Error(data.message ?? data.error ?? "Sandbox pipeline failed.")
      }
      setResult(data.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sandbox pipeline failed.")
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
                <h2 className="text-lg font-semibold">Lead Engine overview</h2>
                <p className="text-sm text-muted-foreground">
                  Ten-stage research pipeline — fixture dry-run validates parsers and types. No LLM providers or outbound execution.
                </p>
              </div>
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              QA: {GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/growth/leads">Back to Inbox</Link>
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {GROWTH_LEAD_ENGINE_PIPELINE_STAGES.map((def) => {
            const stage = stageById.get(def.stageId)
            return (
              <Badge
                key={def.stageId}
                variant={
                  stage?.status === "ok"
                    ? "default"
                    : stage?.status === "error"
                      ? "destructive"
                      : "secondary"
                }
                className="font-normal"
              >
                {def.label}
              </Badge>
            )
          })}
        </div>

        {result ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {result.completedCount} stages parsed · {result.errorCount} errors · mode {result.mode}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Sandbox input</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Operator context only — fixtures derive stage JSON; connect LLM providers in a later slice.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={input.companyName}
              onChange={(e) => setInput((prev) => ({ ...prev, companyName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Website / domain</Label>
            <Input
              id="domain"
              value={input.domain}
              onChange={(e) => setInput((prev) => ({ ...prev, domain: e.target.value }))}
              placeholder="example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={input.industry}
              onChange={(e) => setInput((prev) => ({ ...prev, industry: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={input.location}
              onChange={(e) => setInput((prev) => ({ ...prev, location: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes / ICP context</Label>
            <Textarea
              id="notes"
              rows={3}
              value={input.notes}
              onChange={(e) => setInput((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void runPipeline()} disabled={loading || !input.companyName.trim()}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Run fixture pipeline
          </Button>
        </div>
        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-semibold">Stage outputs</h3>
        {GROWTH_LEAD_ENGINE_PIPELINE_STAGES.map((def) => (
          <StagePanel key={def.stageId} stage={stageById.get(def.stageId) ?? {
            stageId: def.stageId,
            label: def.label,
            qaMarker: def.qaMarker,
            status: "pending",
            rawJson: "",
            parsed: null,
            parseOk: false,
            parseMessage: null,
            confidence: null,
            evidenceSummary: null,
            humanReviewRequired: null,
          }} />
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Radar size={17} />
          </span>
          <div>
            <h3 className="font-semibold text-violet-950">North Star — Real-Time Intent Pixel</h3>
            <p className="mt-1 text-sm text-violet-900/90">
              Future capability placeholder. Infrastructure shell only — not active in this slice.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-violet-900/85">
              <li>Website visitor tracking and session history</li>
              <li>Page visit history and time on site</li>
              <li>Form capture attribution and conversion events</li>
              <li>Company / domain identification when available (not guaranteed for anonymous visitors)</li>
              <li>Lead enrichment hooks with consent- and privacy-safe tracking</li>
            </ul>
            <p className="mt-3 rounded-lg border border-violet-200/80 bg-white/60 px-3 py-2 text-sm text-violet-950">
              <strong>Privacy boundary:</strong> Do not claim we can always capture name, email, phone, or LinkedIn from
              anonymous visitors. Personally identifiable information is captured only when the visitor submits it,
              identifies through a form, booking, chat, login, or a compliant enrichment source.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
