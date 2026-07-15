"use client"

import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import { ORGANIZATIONAL_KNOWLEDGE_CATEGORIES } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import {
  filterValidatedInstitutionalLearnings,
  GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE,
  GROWTH_INSTITUTIONAL_LEARNING_TRUTHFULNESS_1A_QA_MARKER,
  GROWTH_INSTITUTIONAL_LEARNING_VALIDATED_LABEL,
} from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"
import { GrowthTrainingSectionCard } from "@/components/growth/training/growth-training-section-card"
import { GROWTH_TRAINING_LEARNED_TITLE } from "@/lib/growth/training/growth-training-workspace-types"

type Props = {
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload | null
}

const CATEGORY_LABELS: Record<(typeof ORGANIZATIONAL_KNOWLEDGE_CATEGORIES)[number], string> = {
  industry: "Industry",
  company_size: "Company size",
  persona: "Persona",
  messaging: "Messaging",
  objection: "Objection",
  timing: "Timing",
  pain_point: "Pain point",
  market: "Market",
  sales_process: "Sales process",
}

export function GrowthTrainingLearnedSection({ organizationalKnowledge }: Props) {
  const items = filterValidatedInstitutionalLearnings(organizationalKnowledge?.store.items)

  const grouped = ORGANIZATIONAL_KNOWLEDGE_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

  return (
    <GrowthTrainingSectionCard
      title={GROWTH_TRAINING_LEARNED_TITLE}
      description="Validated learnings from your organization's outcomes and approved intelligence. Read-only — knowledge is earned, not edited here."
      qaSection="training-learned"
    >
      <div data-qa-marker-institutional-learning-1a={GROWTH_INSTITUTIONAL_LEARNING_TRUTHFULNESS_1A_QA_MARKER}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE}</p>
      ) : (
        <div className="space-y-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {GROWTH_INSTITUTIONAL_LEARNING_VALIDATED_LABEL}
          </p>
          {grouped.map((group) => (
            <div key={group.category}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <ul className="mt-2 space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.knowledge_id}
                    className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground"
                  >
                    {item.finding}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      </div>
    </GrowthTrainingSectionCard>
  )
}
