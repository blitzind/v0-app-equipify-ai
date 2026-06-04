"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthInboxContextEmptyHint } from "@/components/growth/inbox/growth-inbox-context-empty-hint"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { projectLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-projection"
import { relationshipStageLabel } from "@/lib/growth/lead-memory/memory-types"
import { GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { cn } from "@/lib/utils"

function MemoryChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="inline-flex max-w-full min-w-0 items-baseline gap-1 rounded border border-border/50 bg-muted/15 px-2 py-0.5"
      title={`${label}: ${value}`}
    >
      <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-[11px] leading-snug">{value}</span>
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
      : null,
    influence.memoryCoverageScore != null && influence.memoryCoverageScore > 0 && !profile?.memoryCoverageScore
      ? { label: "Coverage", value: `${influence.memoryCoverageScore}%` }
      : null,
    objections.length ? { label: "Objections", value: objections.join(" · ") } : null,
    preferences.length ? { label: "Preferences", value: preferences.join(" · ") } : null,
    commitments.length ? { label: "Commitments", value: commitments.join(" · ") } : null,
    riskFlags.length ? { label: "Risk", value: riskFlags.join(" · ") } : null,
  ].filter((chip): chip is { label: string; value: string } => chip != null && !isPlaceholderMemoryValue(chip.value))

  const hasMemory = chips.length > 0
  const previewChips = expanded ? chips : chips.slice(0, 4)

  return (
    <div
      className="shrink-0 border-b border-border/60 bg-card/90 px-3 py-2"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Memory</p>
            {loading ? (
              <span className="text-[11px] text-muted-foreground">Loading…</span>
            ) : hasMemory && profile ? (
              <GrowthBadge label={relationshipStageLabel(profile.relationshipStage)} tone="healthy" />
            ) : null}
            {!loading && !hasMemory ? (
              <GrowthInboxContextEmptyHint label="No relationship memory yet — builds after engagement" />
            ) : null}
          </div>

          {hasMemory && !loading ? (
            <div className={cn("flex flex-wrap gap-1.5", expanded ? "max-h-40 overflow-y-auto pr-1" : undefined)}>
              {previewChips.map((chip) => (
                <MemoryChip key={chip.label} label={chip.label} value={chip.value} />
              ))}
              {!expanded && chips.length > previewChips.length ? (
                <span className="self-center text-[10px] text-muted-foreground">
                  +{chips.length - previewChips.length} more
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasMemory ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-0.5 h-7 shrink-0 px-2 text-[10px] text-muted-foreground"
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
                {chips.length > 4 ? "All" : "Details"}
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
