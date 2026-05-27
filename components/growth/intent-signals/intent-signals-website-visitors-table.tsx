"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthLiveVisitorRow } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return "—"
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(iso).toLocaleDateString()
}

function intentLabel(visitor: GrowthLiveVisitorRow): string {
  if (visitor.high_intent) return "High"
  if (visitor.buying_stage_candidate) return "Medium"
  if (visitor.search_intent_detected) return "Medium"
  return "Low"
}

function extractCompanyLabel(displayLabel: string): string {
  const atMatch = displayLabel.match(/@\s*(.+)$/)
  if (atMatch?.[1]) return atMatch[1].trim()
  if (displayLabel.includes(".")) return displayLabel
  return "—"
}

export function IntentSignalsWebsiteVisitorsTable({
  visitors,
  viewMode,
}: {
  visitors: GrowthLiveVisitorRow[]
  viewMode: "company" | "people"
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2">{viewMode === "people" ? "Person" : "Company"}</th>
            <th className="px-4 py-2">Company</th>
            <th className="px-4 py-2">Job title</th>
            <th className="px-4 py-2">Country</th>
            <th className="px-4 py-2">Intent</th>
            <th className="px-4 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {visitors.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                No active visitors in the live window. Events may still be recorded — check setup diagnostics.
              </td>
            </tr>
          ) : (
            visitors.map((visitor) => {
              const intent = intentLabel(visitor)
              const company = extractCompanyLabel(visitor.display_label)
              return (
                <tr key={visitor.session_id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <p className="font-medium">{visitor.display_label}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {visitor.high_intent ? (
                        <Badge className="bg-violet-600 hover:bg-violet-600">High intent</Badge>
                      ) : null}
                      {visitor.returning_session ? <Badge variant="outline">Returning</Badge> : null}
                      <Badge variant={visitor.visitor_type === "identified" ? "default" : "secondary"}>
                        {visitor.visitor_type}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">{company}</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        intent === "High"
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : intent === "Medium"
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : ""
                      }
                    >
                      {intent}
                    </Badge>
                    {visitor.buying_stage_candidate ? (
                      <p className="mt-1 text-xs text-muted-foreground">{visitor.buying_stage_candidate}</p>
                    ) : null}
                    {visitor.search_intent_detected ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{visitor.search_intent_detected}</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatRelativeTime(visitor.last_activity_at)}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
