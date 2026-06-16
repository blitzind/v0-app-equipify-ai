"use client"

import type { GrowthEngagementReport } from "@/lib/growth/engagement/growth-engagement-report-types"

export function GrowthEngagementReportTable({ report }: { report: GrowthEngagementReport | null }) {
  if (!report) {
    return <p className="text-sm text-muted-foreground">Select a report to preview rows.</p>
  }

  if (report.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No rows available for this report and filter set.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
            {report.columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row, index) => (
            <tr key={`${report.reportId}:${index}`} className="border-b border-border/60">
              {report.columns.map((column) => (
                <td key={column.key} className="px-3 py-2 tabular-nums">
                  {row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
