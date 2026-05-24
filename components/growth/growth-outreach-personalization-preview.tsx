"use client"

import { AlertTriangle } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { outreachIndustryLabel } from "@/lib/growth/outreach/personalization/industry-detection"
import type { OutreachPersonalizationAudit } from "@/lib/growth/outreach/personalization/personalization-types"

type Props = {
  audit: OutreachPersonalizationAudit
  generatedSubject?: string | null
  generatedContent: string
}

function confidenceTone(label: OutreachPersonalizationAudit["confidenceLabel"]): "healthy" | "attention" | "critical" {
  if (label === "high") return "healthy"
  if (label === "medium") return "attention"
  return "critical"
}

function warningTone(severity: OutreachPersonalizationAudit["warnings"][number]["severity"]): "neutral" | "attention" | "critical" {
  if (severity === "critical") return "critical"
  if (severity === "warning") return "attention"
  return "neutral"
}

export function GrowthOutreachPersonalizationPreview({ audit, generatedSubject, generatedContent }: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <GrowthBadge label={`Confidence ${audit.confidenceScore}`} tone={confidenceTone(audit.confidenceLabel)} />
        <GrowthBadge label={audit.strategyVersion} tone="neutral" />
        <GrowthBadge label={outreachIndustryLabel(audit.industry)} tone="neutral" />
        <GrowthBadge label={audit.angle.replace(/_/g, " ")} tone="neutral" />
        {audit.refinedByAi ? (
          <GrowthBadge label="AI refined" tone="healthy" />
        ) : (
          <GrowthBadge label="Deterministic draft" tone="neutral" />
        )}
      </div>

      {audit.warnings.length > 0 ? (
        <div className="space-y-2">
          {audit.warnings.map((warning) => (
            <div
              key={`${warning.code}-${warning.message}`}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <div className="font-medium capitalize">{warning.code.replace(/_/g, " ")}</div>
                <div>{warning.message}</div>
              </div>
              <GrowthBadge label={warning.severity} tone={warningTone(warning.severity)} />
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Source signals</p>
        <div className="flex flex-wrap gap-1.5">
          {audit.sourceSignals.length === 0 ? (
            <span className="text-xs text-muted-foreground">No strong signals detected.</span>
          ) : (
            audit.sourceSignals.map((signal) => (
              <GrowthBadge key={signal} label={signal.replace(/_/g, " ")} tone="neutral" />
            ))
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected blocks</p>
        <ul className="space-y-2">
          {audit.selectedBlocks.map((block) => (
            <li key={`${block.key}-${block.blockId}`} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
              <div className="font-medium capitalize">
                {block.key} · {block.label}
              </div>
              <div className="mt-1 text-muted-foreground">{block.text}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Context packet</p>
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Company</dt>
            <dd className="font-medium">{audit.contextPacket.companyName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Decision maker</dt>
            <dd className="font-medium">
              {audit.contextPacket.decisionMakerName ?? "—"}
              {audit.contextPacket.decisionMakerTitle ? ` · ${audit.contextPacket.decisionMakerTitle}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fit / engagement</dt>
            <dd className="font-medium">
              {audit.contextPacket.fitScore ?? "—"} / {audit.contextPacket.engagementScore ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Opportunity readiness</dt>
            <dd className="font-medium">{audit.contextPacket.opportunityReadinessTier ?? "—"}</dd>
          </div>
        </dl>
        {audit.contextPacket.websiteFindings.length > 0 ? (
          <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
            {audit.contextPacket.websiteFindings.slice(0, 4).map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated draft</p>
        {generatedSubject ? <p className="text-sm font-medium">Subject: {generatedSubject}</p> : null}
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">{generatedContent}</pre>
        <p className="mt-1 text-xs text-muted-foreground">
          Variation key: {audit.variationKey} · Max words: {audit.maxWords}
        </p>
      </div>
    </div>
  )
}
