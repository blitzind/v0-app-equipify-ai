"use client"

import type { GrowthLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { BuyingStageCard } from "@/components/growth/revenue-intelligence/buying-stage-card"
import { ConfidenceCard } from "@/components/growth/revenue-intelligence/confidence-card"
import { EvidenceStrengthCard } from "@/components/growth/revenue-intelligence/evidence-strength-card"
import { LeadPriorityCard } from "@/components/growth/revenue-intelligence/lead-priority-card"
import { LeadScoreVisual } from "@/components/growth/revenue-intelligence/lead-score-visual"
import { OperatorMotionCard } from "@/components/growth/revenue-intelligence/operator-motion-card"
import { formatLabel } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { LeadHealthIndicator } from "@/components/growth/revenue-intelligence/lead-health-indicator"

function EvidenceSnippetList({
  title,
  items,
  limit = 5,
}: {
  title: string
  items: Array<{ claim: string; evidence: string }>
  limit?: number
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.slice(0, limit).map((item, i) => (
          <li key={`${title}-${i}`} className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
            <p className="font-medium">{item.claim}</p>
            <p className="mt-0.5 text-muted-foreground">{item.evidence}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ExecutiveSummaryCard({ workspace }: { workspace: GrowthLeadOperatorWorkspacePayload }) {
  const { card, overview, buying_stage, company_match, operator_handoff } = workspace
  const topEvidence = workspace.evidence.items.slice(0, 5)
  const searchSnippets = workspace.search_intent_signals.slice(0, 5).map((s) => ({
    claim: s.intent_topic,
    evidence: s.evidence,
  }))
  const companySnippets = company_match
    ? [{ claim: `Company match: ${company_match.company_name}`, evidence: company_match.evidence }]
    : []

  return (
    <div className="space-y-4">
      <GrowthEngineCard title="Executive summary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight">{card.company_name}</h2>
            {card.domain ? <p className="text-sm text-muted-foreground">{card.domain}</p> : null}
            <div className="mt-2">
              <LeadHealthIndicator card={card} />
            </div>
          </div>
          <LeadScoreVisual leadScore={card.lead_score} intentScore={card.intent_score} />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground">{overview.executive_summary}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Verification</p>
            <p className="mt-1 font-medium capitalize">{formatLabel(card.verification_state)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <LeadPriorityCard priority={card.candidate_priority} urgency={card.recommended_urgency} />
          </div>
          <div className="rounded-lg border border-border p-3">
            <BuyingStageCard
              stage={buying_stage?.detected_stage ?? card.buying_stage}
              confidence={buying_stage?.stage_confidence ?? card.buying_stage_confidence}
              signalCount={buying_stage?.signal_count}
              compact
            />
          </div>
          <div className="rounded-lg border border-border p-3">
            <ConfidenceCard
              candidateConfidence={card.candidate_confidence}
              operatorConfidence={operator_handoff?.operator_confidence}
              label="Confidence"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <OperatorMotionCard
              motion={card.recommended_motion}
              owner={card.recommended_owner}
              nextAction={operator_handoff?.recommended_next_action}
            />
          </div>
          <div className="rounded-lg border border-border p-3">
            <EvidenceStrengthCard strength={card.evidence_strength} evidenceCount={card.evidence_count} />
            {card.decision_maker_confidence != null ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Decision maker confidence {(card.decision_maker_confidence * 100).toFixed(0)}%
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">{overview.decision_maker_summary}</p>
            )}
          </div>
        </div>
      </GrowthEngineCard>

      {operator_handoff?.why_this_matters ? (
        <GrowthEngineCard title="Why this matters">
          <p className="text-sm leading-relaxed text-muted-foreground">{operator_handoff.why_this_matters}</p>
        </GrowthEngineCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="Top evidence signals">
          <EvidenceSnippetList title="Evidence" items={topEvidence} />
        </GrowthEngineCard>
        <GrowthEngineCard title="Buying signals">
          <EvidenceSnippetList title="Buying" items={overview.buying_signals} />
        </GrowthEngineCard>
        <GrowthEngineCard title="Pain points">
          <EvidenceSnippetList title="Pain" items={overview.pain_points} />
        </GrowthEngineCard>
        <GrowthEngineCard title="Search intent indicators">
          <EvidenceSnippetList title="Search" items={searchSnippets} />
        </GrowthEngineCard>
        {companySnippets.length > 0 ? (
          <GrowthEngineCard title="Company match evidence" className="lg:col-span-2">
            <EvidenceSnippetList title="Company" items={companySnippets} />
            {company_match ? (
              <p className="mt-2 text-xs text-amber-800">
                Candidate match · {(company_match.match_confidence * 100).toFixed(0)}% confidence
              </p>
            ) : null}
          </GrowthEngineCard>
        ) : null}
      </div>
    </div>
  )
}
