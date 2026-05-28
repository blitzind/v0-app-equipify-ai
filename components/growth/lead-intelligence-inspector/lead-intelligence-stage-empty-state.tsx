"use client"

import { Info, Zap } from "lucide-react"
import { LEAD_STAGE_EMPTY_STATE_QA_MARKER } from "@/lib/growth/lead-engine/lead-intelligence-inspector-qa"
import type { LeadIntelligenceStageEmptyPreview } from "@/lib/growth/lead-engine/lead-intelligence-stage-empty-previews"

export function LeadIntelligenceStageEmptyState({
  preview,
  stageLabel,
  isSamplePreview,
}: {
  preview: LeadIntelligenceStageEmptyPreview
  stageLabel: string
  isSamplePreview?: boolean
}) {
  return (
    <div
      className="rounded-lg border border-dashed border-violet-200/80 bg-violet-50/30 p-4"
      data-qa-marker={LEAD_STAGE_EMPTY_STATE_QA_MARKER}
    >
      {isSamplePreview ? (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
          Sample preview — run pipeline for account-specific stage output
        </p>
      ) : null}

      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-violet-700" />
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold text-violet-950">What {stageLabel} does</p>
            <p className="mt-1 text-violet-900/90">{preview.purpose}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800/80">
              Expected outputs
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-violet-900/85">
              {preview.expectedOutputs.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-violet-100 bg-white/60 p-2.5">
              <p className="text-xs font-semibold text-violet-900">Why it matters</p>
              <p className="mt-1 text-xs text-violet-900/80">{preview.whyItMatters}</p>
            </div>
            <div className="rounded-md border border-violet-100 bg-white/60 p-2.5">
              <p className="flex items-center gap-1 text-xs font-semibold text-violet-900">
                <Zap className="size-3" />
                Execution trigger
              </p>
              <p className="mt-1 text-xs text-violet-900/80">{preview.executionTrigger}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
