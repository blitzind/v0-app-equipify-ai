"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import type { CallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import { cn } from "@/lib/utils"

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-xl border border-border/60 bg-background/60 p-3 dark:border-white/10", className)}>
      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
      <div className="mt-2 space-y-1.5 text-sm text-foreground">{children}</div>
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-muted-foreground">None detected yet.</p>
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item} className="text-sm text-foreground">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function GrowthCallWorkspaceAiosLiveAssistPanel({
  reasoning,
  className,
}: {
  reasoning: CallWorkspaceAiosLiveReasoningSnapshot | null
  className?: string
}) {
  if (!reasoning) return null

  return (
    <div
      className={cn("grid gap-3", className)}
      data-call-workspace-aios-live-reasoning-qa-marker={GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <GrowthBadge label="Ava live reasoning" tone="healthy" />
        {reasoning.conversationStage ? <GrowthBadge label={reasoning.conversationStage} tone="neutral" /> : null}
        <GrowthBadge label={`${reasoning.confidenceLevel} confidence`} tone="neutral" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Current conversation">
          <p>{reasoning.recommendedNextObjective ?? "Advance with one clear next step."}</p>
          {reasoning.discoveryProgress ? (
            <p className="text-muted-foreground">Discovery: {reasoning.discoveryProgress}</p>
          ) : null}
          {reasoning.conversationMomentum ? (
            <p className="text-muted-foreground">Momentum: {reasoning.conversationMomentum}</p>
          ) : null}
        </Section>

        <Section title="Relationship">
          <p>{reasoning.relationshipHealth ?? "Relationship context loading from memory."}</p>
          {reasoning.trustBudget ? <p className="text-muted-foreground">Trust budget: {reasoning.trustBudget}</p> : null}
          {reasoning.relationshipMovement ? (
            <p className="text-muted-foreground">Movement: {reasoning.relationshipMovement}</p>
          ) : null}
        </Section>

        <Section title="Business pressure">
          <p>{reasoning.operationalProblem ?? reasoning.sayThisNext.businessPressure ?? "No dominant pressure yet."}</p>
        </Section>

        <Section title="Buying signals">
          <BulletList items={reasoning.buyingSignals} />
        </Section>

        <Section title="If they say…">
          <BulletList
            items={reasoning.sayThisNext.scenarioBranches.map((branch) => `${branch.trigger} → ${branch.response}`)}
          />
        </Section>

        <Section title="Conversation risks">
          <BulletList items={reasoning.conversationRisks} />
        </Section>

        <Section title="Opportunity signals">
          <BulletList items={reasoning.opportunitySignals} />
        </Section>

        <Section title="Committee status">
          <p>{reasoning.committeeStatus ?? "Committee coverage not available."}</p>
        </Section>

        {reasoning.institutionalAdvisory.length ? (
          <Section title="Institutional learning" className="md:col-span-2">
            <BulletList items={reasoning.institutionalAdvisory} />
          </Section>
        ) : null}
      </div>
    </div>
  )
}
