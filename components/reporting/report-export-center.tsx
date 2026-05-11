"use client"

import Link from "next/link"
import { BarChart3, FileSpreadsheet, MessageSquare, ShieldCheck } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CLIENT_CSV_EXPORT_ROW_WARN_THRESHOLD } from "@/lib/reporting/export-constants"
import { cn } from "@/lib/utils"

type ReportExportCenterProps = {
  className?: string
  /** User can call `/api/.../reports/analytics` (mirrors server gate). */
  canAccessOperationalAnalytics: boolean
  /** Financial invoice CSV block is shown on the page when true. */
  showFinancialExportSection: boolean
}

/**
 * In-page hub for **where** exports live and how they are permission-safe.
 * Does not duplicate primary export controls in the filter toolbar.
 */
export function ReportExportCenter({
  className,
  canAccessOperationalAnalytics,
  showFinancialExportSection,
}: ReportExportCenterProps) {
  return (
    <Card
      className={cn("border-border/80 py-0 shadow-sm print:hidden", className)}
      data-slot="report-export-center"
    >
      <CardHeader className="px-5 py-4 border-b border-border/80">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Export center</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              CSV downloads are generated in your browser from data already returned by org-scoped APIs. They
              use UTF-8 with a BOM so Excel opens special characters reliably. Very large tables may take a
              moment — use filters to narrow the window when possible.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs">
            <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium text-foreground">Operational summary</p>
              <p className="mt-0.5 text-muted-foreground leading-relaxed">
                Use the <span className="font-medium text-foreground">CSV</span> button in the filter bar
                above for the current date range and filters.{" "}
                {!canAccessOperationalAnalytics ? (
                  <span className="text-amber-800 dark:text-amber-200">
                    Your role does not include operational or financial report access — exports are disabled
                    when the report cannot load.
                  </span>
                ) : (
                  "Data matches the same analytics payload as the charts below."
                )}
              </p>
            </div>
          </div>

          {showFinancialExportSection ? (
            <div className="flex gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs">
              <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Invoice &amp; payment export</p>
                <p className="mt-0.5 text-muted-foreground leading-relaxed">
                  The <span className="font-medium text-foreground">Invoice &amp; payment financials</span>{" "}
                  section below includes its own <span className="font-medium text-foreground">CSV</span>{" "}
                  action, gated to billing/financial visibility and the same org API as on-screen totals.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 rounded-lg border border-dashed border-border/80 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
              <p>
                Financial invoice CSV is available to roles with billing or financials access. Ask an admin if
                you need this export.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p>
              Communications history can be exported from the{" "}
              <span className="text-foreground font-medium">Communications</span> feed (current list, same
              filters as on that page). Exports over {CLIENT_CSV_EXPORT_ROW_WARN_THRESHOLD.toLocaleString()}{" "}
              rows show a notice before download.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" asChild>
            <Link href="/communications">Open communications</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
