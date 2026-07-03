"use client"

import type { OpportunityIntelligenceField } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-field"
import type {
  GrowthHomeOpportunityIntelligenceResearchStatus,
  GrowthHomeOpportunityIntelligenceApiResponse,
} from "@/lib/growth/opportunity-intelligence/growth-home-opportunity-intelligence-api-contract"
import type { OpportunityIntelligenceViewModel } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-view-model-types"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"

function FieldBlock<T>({
  title,
  field,
  renderValue,
}: {
  title: string
  field: OpportunityIntelligenceField<T>
  renderValue: (value: NonNullable<T>) => React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {field.available ? (
          <GrowthBadge label="Available" tone="healthy" />
        ) : (
          <GrowthBadge label="Not yet available" tone="neutral" />
        )}
      </div>
      {field.available && field.value != null ? (
        <div className="mt-2 space-y-1 text-sm">{renderValue(field.value)}</div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Intelligence will appear after canonical engines have run — no recomputation from this view.
        </p>
      )}
      {field.source ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Source: {field.source}
          {field.computedAt ? ` · ${new Date(field.computedAt).toLocaleString()}` : ""}
        </p>
      ) : null}
    </div>
  )
}

function LabeledList({ items }: { items: Array<{ label: string; source: string }> }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">None recorded.</p>
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={`${item.source}:${item.label}`}>
          {item.label}
          <span className="text-xs text-muted-foreground"> ({item.source})</span>
        </li>
      ))}
    </ul>
  )
}

export function GrowthHomeOpportunityIntelligencePanel({
  viewModel,
  researchStatus,
}: {
  viewModel: OpportunityIntelligenceViewModel
  researchStatus: GrowthHomeOpportunityIntelligenceResearchStatus | null | undefined
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Read-only intelligence — no outbound, enrollment, or recomputation from this panel.
      </div>

      <div className="rounded-lg border border-border/70 p-3">
        <p className="text-sm font-semibold">Research status</p>
        {researchStatus?.available ? (
          <p className="mt-1 text-sm">
            Workflow: <span className="font-medium">{researchStatus.workflowStatus?.replaceAll("_", " ")}</span>
            {researchStatus.updatedAt ? (
              <span className="text-muted-foreground"> · updated {new Date(researchStatus.updatedAt).toLocaleString()}</span>
            ) : null}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No Growth Lead Research workflow snapshot yet.</p>
        )}
      </div>

      <FieldBlock title="Qualification" field={viewModel.qualification} renderValue={(value) => (
        <>
          <p>
            Score {value.overallScore} · {value.qualification.replaceAll("_", " ")} · fit {value.fitScore}
          </p>
          {value.recommendations.length ? <p className="text-muted-foreground">{value.recommendations.join(" · ")}</p> : null}
        </>
      )} />

      <FieldBlock title="Revenue readiness" field={viewModel.revenueReadiness} renderValue={(value) => (
        <>
          <p className="text-lg font-semibold tabular-nums">
            {value.score} · {value.tier.replaceAll("_", " ")}
          </p>
          <p className="text-muted-foreground">{value.summary}</p>
        </>
      )} />

      <FieldBlock title="Next best action" field={viewModel.nextBestAction} renderValue={(value) => (
        <>
          {"label" in value ? (
            <>
              <p className="font-medium">{value.label}</p>
              <p className="text-muted-foreground">{value.reason}</p>
            </>
          ) : (
            <>
              <p className="font-medium">{value.label}</p>
              <p className="text-muted-foreground">{value.reason}</p>
            </>
          )}
        </>
      )} />

      <FieldBlock title="Opportunity assessment" field={viewModel.opportunityAssessment} renderValue={(value) => (
        <>
          <p>
            Score {value.opportunityScore} · {value.recommendation.replaceAll("_", " ")}
            {value.worthPursuing ? " · worth pursuing" : ""}
          </p>
          <p className="text-muted-foreground">{value.summary}</p>
          <p className="text-muted-foreground">
            Revenue: {value.estimatedRevenueRange} · cycle: {value.estimatedSalesCycle}
          </p>
        </>
      )} />

      <FieldBlock title="Risks" field={viewModel.risks} renderValue={(items) => <LabeledList items={items} />} />
      <FieldBlock title="Strengths" field={viewModel.strengths} renderValue={(items) => <LabeledList items={items} />} />
      <FieldBlock title="Blockers" field={viewModel.blockers} renderValue={(items) => <LabeledList items={items} />} />

      <FieldBlock title="Recommendation" field={viewModel.recommendation} renderValue={(value) => (
        <>
          <p className="font-medium">{value.recommendation.replaceAll("_", " ")}</p>
          {value.description ? <p className="text-muted-foreground">{value.description}</p> : null}
        </>
      )} />

      <FieldBlock title="Confidence" field={viewModel.confidence} renderValue={(value) => (
        <p>
          {Math.round(value.confidence <= 1 ? value.confidence * 100 : value.confidence)}%
          {value.confidenceLabel ? ` · ${value.confidenceLabel}` : ""}
          {value.reason ? ` — ${value.reason}` : ""}
        </p>
      )} />
    </div>
  )
}

export type { GrowthHomeOpportunityIntelligenceApiResponse }
