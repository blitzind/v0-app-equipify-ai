"use client"

import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementDashboardTemplatePerformanceRow } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

export function GrowthEngagementTemplateTable({
  items,
  onOpenTemplate,
}: {
  items: GrowthEngagementDashboardTemplatePerformanceRow[]
  onOpenTemplate?: (templateId: string) => void
}) {
  return (
    <GrowthEngineCard title="Template performance">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No template engagement in this date range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Template</th>
                <th className="px-2 py-2 font-medium">Pages</th>
                <th className="px-2 py-2 font-medium">Views</th>
                <th className="px-2 py-2 font-medium">CTA</th>
                <th className="px-2 py-2 font-medium">Booking starts</th>
                <th className="px-2 py-2 font-medium">Booking done</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.templateId}
                  className={`border-b border-border/60 ${onOpenTemplate ? "cursor-pointer hover:bg-muted/40" : ""}`}
                  onClick={() => onOpenTemplate?.(row.templateId)}
                >
                  <td className="px-2 py-2">
                    <p className="font-medium">{row.templateName}</p>
                    <p className="text-xs text-muted-foreground">{row.templateId.slice(0, 8)}…</p>
                  </td>
                  <td className="px-2 py-2 tabular-nums">{row.usageCount}</td>
                  <td className="px-2 py-2 tabular-nums">{row.sharePageViews}</td>
                  <td className="px-2 py-2 tabular-nums">{row.ctaClicks}</td>
                  <td className="px-2 py-2 tabular-nums">{row.bookingStarts}</td>
                  <td className="px-2 py-2 tabular-nums">{row.bookingCompletions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GrowthEngineCard>
  )
}
