"use client"

import { useState, type ReactNode } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { summarizeLeadEngineStage } from "@/lib/growth/lead-engine/lead-intelligence-stage-summary"
import type { GrowthLeadEngineOrchestratorStageResult } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { cn } from "@/lib/utils"

function stageStatusIcon(status: GrowthLeadEngineOrchestratorStageResult["status"]) {
  if (status === "completed") return <CheckCircle2 className="size-4 text-emerald-600" />
  if (status === "failed") return <XCircle className="size-4 text-destructive" />
  return <Circle className="size-4 text-muted-foreground" />
}

function CollapsibleBlock({
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

export function LeadIntelligenceStagePanel({
  stage,
}: {
  stage: GrowthLeadEngineOrchestratorStageResult
}) {
  const summaryLines = summarizeLeadEngineStage(stage)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {stageStatusIcon(stage.status)}
          <div>
            <p className="font-medium">{stage.label}</p>
            <p className="text-xs text-muted-foreground">{stage.short_label}</p>
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

      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {summaryLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <CollapsibleBlock title="Technical Details">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Structured output</p>
            <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
              {stage.parsed ? JSON.stringify(stage.parsed, null, 2) : "(no parsed output)"}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Raw JSON</p>
            <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
              {stage.raw_json || "(not run)"}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Evidence ({stage.evidence?.items.length ?? 0})
            </p>
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
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Attribution ({stage.attribution.length})
            </p>
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
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Diagnostics ({stage.diagnostics.length})
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {stage.diagnostics.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

        </div>
      </CollapsibleBlock>
    </div>
  )
}

export function LeadIntelligenceTechnicalDetails({
  title = "Technical Details",
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <CollapsibleBlock title={title}>{children}</CollapsibleBlock>
    </div>
  )
}
