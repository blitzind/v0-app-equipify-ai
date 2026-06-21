"use client"

import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthPersonalizationEvaluationReport } from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"
import {
  negativeFeedbackReasonLabel,
  regenerationFeedbackLabel,
} from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-utils"

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

function rejectionLabel(reason: string | null): string {
  if (!reason) return "—"
  if (reason.startsWith("rejection:") || reason.startsWith("regeneration:")) {
    return reason.split(":").slice(1).join(":").replace(/_/g, " ")
  }
  if (
    [
      "too_generic",
      "wrong_industry_assumptions",
      "too_salesy",
      "missing_company_context",
      "too_long",
      "too_technical",
      "other",
    ].includes(reason)
  ) {
    return negativeFeedbackReasonLabel(reason as never)
  }
  return regenerationFeedbackLabel(reason as never)
}

export function GrowthPersonalizationEvaluationPanel({
  report,
}: {
  report: GrowthPersonalizationEvaluationReport
}) {
  return (
    <div className="space-y-4">
      <GrowthEngineCard title="Evaluation Overview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Generations" value={report.overview.generationCount} />
          <StatTile label="Approval Rate" value={`${report.overview.approvalRate}%`} />
          <StatTile label="Rejection Rate" value={`${report.overview.rejectionRate}%`} />
          <StatTile label="Regeneration Rate" value={`${report.overview.regenerationRate}%`} />
          <StatTile label="Avg Evidence" value={`${report.overview.avgEvidenceCoverage}%`} />
          <StatTile label="Avg Personalization Score" value={report.overview.avgPersonalizationScore} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Helpful Feedback" value={report.overview.helpfulCount} />
          <StatTile label="Not Helpful Feedback" value={report.overview.notHelpfulCount} />
          <StatTile label="Avg Time To Approval" value={formatDuration(report.overview.avgTimeToApprovalMs)} />
          <StatTile label="Draft Queue" value={report.overview.draftCount} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Industry Performance">
        {!report.industries.length ? (
          <p className="text-sm text-muted-foreground">No industry-resolved generations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2">Industry</th>
                  <th className="px-2 py-2">Generated</th>
                  <th className="px-2 py-2">Approved</th>
                  <th className="px-2 py-2">Rejected</th>
                  <th className="px-2 py-2">Avg Score</th>
                  <th className="px-2 py-2">Top Rejection</th>
                </tr>
              </thead>
              <tbody>
                {report.industries.map((row) => (
                  <tr key={row.industryId} className="border-b border-border/40">
                    <td className="px-2 py-2 font-medium">{row.industryLabel}</td>
                    <td className="px-2 py-2">{row.generationCount}</td>
                    <td className="px-2 py-2">{row.approvalCount}</td>
                    <td className="px-2 py-2">{row.rejectionCount}</td>
                    <td className="px-2 py-2">{row.avgPersonalizationScore}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {rejectionLabel(row.topRejectionReason)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GrowthEngineCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="Feedback Insights">
          {!report.feedbackInsights.length ? (
            <p className="text-sm text-muted-foreground">No regeneration or operator feedback yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.feedbackInsights.slice(0, 8).map((entry) => (
                <li key={entry.reason} className="flex items-center justify-between rounded border px-3 py-2">
                  <span>{entry.label}</span>
                  <span className="text-muted-foreground">
                    {entry.count} ({entry.share}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Recommendations">
          {!report.recommendations.length ? (
            <p className="text-sm text-muted-foreground">
              Recommendations appear after enough generations per industry/playbook element.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.recommendations.slice(0, 8).map((entry) => (
                <li key={`${entry.industryId}:${entry.elementKey}:${entry.action}`} className="rounded border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge
                      label={entry.action}
                      tone={
                        entry.action === "promote"
                          ? "healthy"
                          : entry.action === "demote"
                            ? "critical"
                            : "attention"
                      }
                    />
                    <span className="font-medium">{entry.industryLabel}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.rationale}</p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>
    </div>
  )
}
