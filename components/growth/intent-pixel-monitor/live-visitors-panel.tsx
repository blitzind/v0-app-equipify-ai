"use client"

import { Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GrowthLiveVisitorRow } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"

export function LiveVisitorsPanel({ visitors }: { visitors: GrowthLiveVisitorRow[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-sky-600" />
          <div>
            <h2 className="text-lg font-semibold">Live visitors</h2>
            <p className="text-sm text-muted-foreground">
              Active in the last 30 minutes. Anonymous visitors show domain or visitor key only — no PII.
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2">Visitor</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Pages</th>
              <th className="px-4 py-2">Current page</th>
              <th className="px-4 py-2">Referrer / UTM</th>
              <th className="px-4 py-2">Intent signals</th>
              <th className="px-4 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {visitors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No active visitors right now.
                </td>
              </tr>
            ) : (
              visitors.map((v) => (
                <tr key={v.session_id} className="border-b border-border/60">
                  <td className="px-4 py-2">
                    <p className="font-medium">{v.display_label}</p>
                    {v.high_intent ? (
                      <Badge className="mt-1 bg-violet-600 hover:bg-violet-600">High intent</Badge>
                    ) : null}
                    {v.returning_session ? (
                      <Badge variant="outline" className="mt-1 ml-1">
                        Returning
                      </Badge>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{v.session_duration_label}</td>
                  <td className="px-4 py-2 tabular-nums">{v.page_count}</td>
                  <td className="max-w-[180px] truncate px-4 py-2" title={v.current_page}>
                    {v.current_page}
                  </td>
                  <td className="max-w-[200px] px-4 py-2 text-xs text-muted-foreground">
                    <p className="truncate" title={v.referrer ?? undefined}>
                      {v.referrer ?? "—"}
                    </p>
                    <p>
                      {[v.utm_source, v.utm_medium, v.utm_campaign].filter(Boolean).join(" / ") || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {v.search_intent_detected ? (
                      <p>{v.search_intent_detected}</p>
                    ) : null}
                    {v.buying_stage_candidate ? (
                      <p className="text-muted-foreground">{v.buying_stage_candidate}</p>
                    ) : null}
                    {v.company_match_confidence != null ? (
                      <p className="text-muted-foreground">
                        Company match {Math.round(v.company_match_confidence * 100)}%
                      </p>
                    ) : null}
                    {!v.search_intent_detected &&
                    !v.buying_stage_candidate &&
                    v.company_match_confidence == null
                      ? "—"
                      : null}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={v.visitor_type === "identified" ? "default" : "secondary"}>
                      {v.visitor_type}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
