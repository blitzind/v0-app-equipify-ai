"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { projectLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-projection"
import { relationshipStageLabel } from "@/lib/growth/lead-memory/memory-types"
import { GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

function MemoryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 rounded border border-border/50 bg-muted/15 px-2 py-0.5">
      <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}: </span>
      <span className="text-[11px]">{value}</span>
    </div>
  )
}

function isPlaceholderMemoryValue(value: string): boolean {
  return (
    !value ||
    value === "—" ||
    value === "None recorded" ||
    value === "None flagged" ||
    value === "0%" ||
    value === "unknown"
  )
}

export function GrowthInboxRelationshipMemoryStrip() {
  const { leadId, loading, memoryProfile } = useGrowthInboxLeadContext()
  const [expanded, setExpanded] = useState(false)

  const influence = useMemo(
    () => projectLeadMemoryInfluenceContext(memoryProfile),
    [memoryProfile],
  )

  if (!leadId) return null

  const profile = memoryProfile?.profile
  const context = memoryProfile?.relationshipContext
  const objections = (memoryProfile?.objections ?? [])
    .filter((entry) => !entry.resolved)
    .slice(0, 3)
    .map((entry) => entry.objectionLabel)
  const preferences = (memoryProfile?.preferences ?? [])
    .slice(0, 3)
    .map((entry) => `${entry.preferenceKey}: ${entry.preferenceValue}`)
  const commitments = influence.commitmentSummaries.slice(0, 3)
  const riskFlags = [...(context?.riskFlags ?? []), ...influence.riskFlags].slice(0, 4)

  const chips = [
    profile?.relationshipStage
      ? { label: "Stage", value: relationshipStageLabel(profile.relationshipStage) }
      : null,
    context?.engagementTrend || influence.engagementTrend
      ? { label: "Trend", value: context?.engagementTrend ?? influence.engagementTrend ?? "" }
      : null,
    profile?.memoryCoverageScore != null && profile.memoryCoverageScore > 0
      ? { label: "Coverage", value: `${profile.memoryCoverageScore}%` }
      : influence.memoryCoverageScore != null && influence.memoryCoverageScore > 0
        ? { label: "Coverage", value: `${influence.memoryCoverageScore}%` }
        : null,
    objections.length ? { label: "Objections", value: objections.join(" · ") } : null,
    preferences.length ? { label: "Preferences", value: preferences.join(" · ") } : null,
    commitments.length ? { label: "Commitments", value: commitments.join(" · ") } : null,
    riskFlags.length ? { label: "Risk", value: riskFlags.join(" · ") } : null,
  ].filter((chip): chip is { label: string; value: string } => chip != null && !isPlaceholderMemoryValue(chip.value))

  const hasMemory = chips.length > 0

  return (
    <div
      className="shrink-0 border-b border-border/60 bg-card/90 px-3 py-1.5"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Memory</p>
          {loading ? (
            <span className="text-[11px] text-muted-foreground">Loading…</span>
          ) : hasMemory ? (
            <>
              {profile ? (
                <GrowthBadge label={relationshipStageLabel(profile.relationshipStage)} tone="healthy" />
              ) : null}
              {!expanded ? (
                <div className="hidden min-w-0 flex-1 flex-wrap gap-1 lg:flex">
                  {chips.slice(0, 3).map((chip) => (
                    <MemoryChip key={chip.label} label={chip.label} value={chip.value} />
                  ))}
                  {chips.length > 3 ? (
                    <span className="text-[10px] text-muted-foreground">+{chips.length - 3} more</span>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">No relationship memory yet for this lead.</span>
          )}
        </div>
        {hasMemory ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-1.5 text-[10px] text-muted-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-0.5 size-3" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="mr-0.5 size-3" />
                Details
              </>
            )}
          </Button>
        ) : null}
      </div>

      {hasMemory && expanded ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <MemoryChip key={chip.label} label={chip.label} value={chip.value} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
