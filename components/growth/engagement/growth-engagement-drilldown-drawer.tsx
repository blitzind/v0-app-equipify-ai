"use client"

import { Loader2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { GrowthEngagementLeadDrilldown } from "@/components/growth/engagement/growth-engagement-lead-drilldown"
import { GrowthEngagementMediaDrilldown } from "@/components/growth/engagement/growth-engagement-media-drilldown"
import { GrowthEngagementSharePageDrilldown } from "@/components/growth/engagement/growth-engagement-share-page-drilldown"
import { GrowthEngagementTemplateDrilldown } from "@/components/growth/engagement/growth-engagement-template-drilldown"
import type { GrowthEngagementDrilldownKind } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

export type GrowthEngagementDrilldownTarget =
  | { kind: "lead"; id: string }
  | { kind: "template"; id: string }
  | { kind: "media"; id: string }
  | { kind: "share_page"; id: string }

function titleForKind(kind: GrowthEngagementDrilldownKind): string {
  switch (kind) {
    case "lead":
      return "Lead engagement drilldown"
    case "template":
      return "Template engagement drilldown"
    case "media":
      return "Media engagement drilldown"
    case "share_page":
      return "Share page engagement drilldown"
  }
}

export function GrowthEngagementDrilldownDrawer({
  open,
  target,
  dateRange,
  onClose,
}: {
  open: boolean
  target: GrowthEngagementDrilldownTarget | null
  dateRange: GrowthEngagementDashboardDateRangePreset
  onClose: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {target ? (
          <>
            <SheetHeader>
              <SheetTitle>{titleForKind(target.kind)}</SheetTitle>
              <SheetDescription>Read-only engagement drilldown for {target.id.slice(0, 8)}…</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              {target.kind === "lead" ? (
                <GrowthEngagementLeadDrilldown leadId={target.id} dateRange={dateRange} />
              ) : null}
              {target.kind === "template" ? (
                <GrowthEngagementTemplateDrilldown templateId={target.id} dateRange={dateRange} />
              ) : null}
              {target.kind === "media" ? (
                <GrowthEngagementMediaDrilldown mediaAssetId={target.id} dateRange={dateRange} />
              ) : null}
              {target.kind === "share_page" ? (
                <GrowthEngagementSharePageDrilldown sharePageId={target.id} dateRange={dateRange} />
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading drilldown…
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
