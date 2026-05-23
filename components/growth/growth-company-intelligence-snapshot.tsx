"use client"

import type { ReactNode } from "react"
import { Building2, Globe, MapPin, ShieldCheck, Wrench } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLeadResearchRun } from "@/lib/growth/research-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthCompanyIntelligenceSnapshotProps = {
  lead: GrowthLead
  latestRun?: GrowthLeadResearchRun | null
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

export function GrowthCompanyIntelligenceSnapshot({ lead, latestRun }: GrowthCompanyIntelligenceSnapshotProps) {
  const result = latestRun?.result
  const serviceTerritory = result?.serviceAreaClues?.slice(0, 2).join(" · ") || null
  const equipment = result?.equipmentServiceIndicators?.slice(0, 3).join(" · ") || null
  const websiteSummary = result?.websiteSummary?.trim() || null
  const dmConfidence = lead.decisionMakerStatus?.replace(/_/g, " ") ?? null

  const hasLeadIntel =
    lead.estimatedAnnualRevenue ||
    lead.estimatedEmployeeCount ||
    lead.fleetSizeEstimate ||
    lead.crmDetected ||
    lead.fieldServiceStackDetected

  const hasResearchIntel = Boolean(latestRun || serviceTerritory || equipment || websiteSummary)

  if (!hasLeadIntel && !hasResearchIntel && !lead.website) {
    return (
      <GrowthCollapsibleEngineCard
        title="Company Intelligence"
        icon={<Building2 className="size-4" />}
        defaultOpen={false}
        persistKey={GROWTH_DRAWER_CARD_KEYS.companyIntelligence}
      >
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Company intelligence will populate after research and enrichment signals refresh.
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
