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
    <div className="min-w-0 rounded-md border border-border/60 bg-muted/20 px-2 py-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-xs">{value}</p>
    </div>
  )
}

export function GrowthInboxRelationshipMemoryStrip() {
  const { leadId, loading, memoryProfile } = useGrowthInboxLeadContext()
  const [mobileExpanded, setMobileExpanded] = useState(false)

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

  const stripBody = (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <MemoryChip
        label="Relationship Stage"
        value={profile ? relationshipStageLabel(profile.relationshipStage) : "—"}
      />
      <MemoryChip label="Engagement Trend" value={context?.engagementTrend ?? influence.engagementTrend ?? "—"} />
      <MemoryChip
        label="Memory Coverage"
        value={profile ? `${profile.memoryCoverageScore}%` : influence.memoryCoverageScore != null ? `${influence.memoryCoverageScore}%` : "—"}
      />
      <MemoryChip label="Key Objections" value={objections.length ? objections.join(" · ") : "None recorded"} />
      <MemoryChip label="Preferences" value={preferences.length ? preferences.join(" · ") : "None recorded"} />
      <MemoryChip label="Commitments" value={commitments.length ? commitments.join(" · ") : "None recorded"} />
      <MemoryChip label="Risk Flags" value={riskFlags.length ? riskFlags.join(" · ") : "None flagged"} />
    </div>
  )

  return (
    <div
      className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relationship Memory</p>
          {profile ? (
            <GrowthBadge label={relationshipStageLabel(profile.relationshipStage)} tone="healthy" />
          ) : null}
          {context?.engagementTrend ? <GrowthBadge label={context.engagementTrend} tone="medium" /> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 md:hidden"
          onClick={() => setMobileExpanded((value) => !value)}
        >
          {mobileExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          <span className="sr-only">Toggle relationship memory</span>
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading relationship memory…</p>
      ) : (
        <>
          <div className="hidden md:block">{stripBody}</div>
          <div className={`md:hidden ${mobileExpanded ? "block" : "hidden"}`}>{stripBody}</div>
          {!mobileExpanded ? (
            <p className="text-[11px] text-muted-foreground md:hidden">
              Tap to expand objections, preferences, commitments, and risk flags.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
