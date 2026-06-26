"use client"

/**
 * GE-AIOS-5A report section — retained for certification compatibility.
 * GE-AIOS-5B renders the executive dashboard via {@link GrowthAiOsExecutivePlanningReviewDashboard}.
 */
import type { AiExecutivePlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import { GrowthAiOsExecutReasoningCollapsible } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-reasoning-collapsible"

export function GrowthAiOsExecutivePlanningReportSection({ report }: { report: AiExecutivePlanningReport }) {
  return <GrowthAiOsExecutReasoningCollapsible report={report} />
}
