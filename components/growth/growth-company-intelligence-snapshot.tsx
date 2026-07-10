"use client"

import type { ReactNode } from "react"
import { Building2, Globe, Loader2, MapPin, ShieldCheck, Wrench } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  hasUsableLeadResearch,
  mapWorkflowStatusToCustomerResearchState,
  resolveCustomerResearchProgressMessage,
} from "@/lib/growth/research/growth-lead-research-readiness"
import type { GrowthLeadResearchRun } from "@/lib/growth/research-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthCompanyIntelligenceSnapshotProps = {
  lead: GrowthLead
  latestRun?: GrowthLeadResearchRun | null
  prospectRun?: GrowthResearchRunPublicView | null
  researchEnqueueing?: boolean
}

function IntelCell({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-border/70 bg-muted/15 p-3 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  )
}

function websiteFetchTone(status: string) {
  switch (status) {
    case "ok":
      return "healthy" as const
    case "skipped":
      return "neutral" as const
    default:
      return "attention" as const
  }
}

export function GrowthCompanyIntelligenceSnapshot({
  lead,
  latestRun,
  prospectRun,
  researchEnqueueing = false,
}: GrowthCompanyIntelligenceSnapshotProps) {
  const result = latestRun?.result
  const serviceTerritory = result?.serviceAreaClues?.slice(0, 2).join(" · ") || null
  const equipment = result?.equipmentServiceIndicators?.slice(0, 3).join(" · ") || null
  const websiteSummary =
    result?.websiteSummary?.trim() ||
    prospectRun?.researchSummary?.trim() ||
    null
  const companyEvidence = prospectRun?.signals?.companyEvidence_v22
  const verifiedIndustries = companyEvidence?.profile.industriesServed?.values.slice(0, 3).join(" · ") || null
  const evidenceConfidence = companyEvidence
    ? `${Math.round(companyEvidence.qualityScores.overallEvidenceConfidence * 100)}% evidence confidence`
    : null
  const dmConfidence = lead.decisionMakerStatus?.replace(/_/g, " ") ?? null

  const researchState = mapWorkflowStatusToCustomerResearchState(null, {
    lastProspectResearchedAt: lead.lastProspectResearchedAt,
    latestProspectResearchRunId: lead.latestProspectResearchRunId,
    prospectRunStatus: researchEnqueueing ? "running" : prospectRun?.status ?? null,
    website: lead.website,
  })
  const progressMessage = resolveCustomerResearchProgressMessage(
    researchEnqueueing ? "researching" : researchState,
  )

  const hasLeadIntel =
    lead.estimatedAnnualRevenue ||
    lead.estimatedEmployeeCount ||
    lead.fleetSizeEstimate ||
    lead.crmDetected ||
    lead.fieldServiceStackDetected

  const hasResearchIntel =
    Boolean(latestRun || prospectRun || serviceTerritory || equipment || websiteSummary) ||
    hasUsableLeadResearch(lead)

  if (researchEnqueueing || researchState === "researching") {
    return (
      <GrowthCollapsibleEngineCard
        title="Company Intelligence"
        icon={<Building2 className="size-4" />}
        defaultOpen
        persistKey={GROWTH_DRAWER_CARD_KEYS.companyIntelligence}
      >
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {progressMessage ?? "Ava is researching this company…"}
        </div>
      </GrowthCollapsibleEngineCard>
    )
  }

  if (!hasLeadIntel && !hasResearchIntel && !lead.website) {
    return (
      <GrowthCollapsibleEngineCard
        title="Company Intelligence"
        icon={<Building2 className="size-4" />}
        defaultOpen={false}
        persistKey={GROWTH_DRAWER_CARD_KEYS.companyIntelligence}
      >
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {progressMessage ??
            "Ava will gather company intelligence automatically once a website is available."}
        </div>
      </GrowthCollapsibleEngineCard>
    )
  }

  return (
    <GrowthCollapsibleEngineCard
      title="Company Intelligence"
      icon={<Building2 className="size-4" />}
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.companyIntelligence}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <IntelCell icon={<Building2 className="size-3.5" />} label="Revenue estimate" value={lead.estimatedAnnualRevenue ?? "—"} />
        <IntelCell icon={<Building2 className="size-3.5" />} label="Employee estimate" value={lead.estimatedEmployeeCount ?? "—"} />
        <IntelCell icon={<Building2 className="size-3.5" />} label="Fleet estimate" value={lead.fleetSizeEstimate ?? "—"} />
        <IntelCell icon={<Wrench className="size-3.5" />} label="CRM detected" value={lead.crmDetected ?? "—"} />
        <IntelCell
          icon={<Wrench className="size-3.5" />}
          label="Field service stack"
          value={lead.fieldServiceStackDetected ?? "—"}
          className="sm:col-span-2 lg:col-span-1"
        />
        <IntelCell icon={<Building2 className="size-3.5" />} label="Industry" value={prospectRun?.industryGuess ?? "—"} />
        {verifiedIndustries ? (
          <IntelCell
            icon={<ShieldCheck className="size-3.5" />}
            label="Verified industries"
            value={verifiedIndustries}
          />
        ) : null}
        {evidenceConfidence ? (
          <IntelCell
            icon={<ShieldCheck className="size-3.5" />}
            label="Evidence quality"
            value={evidenceConfidence}
          />
        ) : null}
        <IntelCell
          icon={<Globe className="size-3.5" />}
          label="Website intelligence"
          value={websiteSummary ?? (lead.website ? lead.website : "—")}
        />
        <IntelCell icon={<MapPin className="size-3.5" />} label="Service territory" value={serviceTerritory ?? "—"} />
        <IntelCell icon={<Wrench className="size-3.5" />} label="Equipment indicators" value={equipment ?? "—"} />
        <IntelCell
          icon={<Globe className="size-3.5" />}
          label="Website fetch"
          value={
            latestRun?.websiteFetchStatus ? (
              <GrowthBadge
                label={latestRun.websiteFetchStatus.replace(/_/g, " ")}
                tone={websiteFetchTone(latestRun.websiteFetchStatus)}
              />
            ) : (
              "—"
            )
          }
        />
        <IntelCell
          icon={<ShieldCheck className="size-3.5" />}
          label="Decision maker confidence"
          value={dmConfidence ? <span className="capitalize">{dmConfidence}</span> : "—"}
        />
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
