import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import type {
  DeterministicOperationalInsight,
  OperationalDashboardFinding,
} from "@/lib/aiden/operational-insight-schema"

export type { DeterministicOperationalInsight, OperationalDashboardFinding } from "@/lib/aiden/operational-insight-schema"

/** @deprecated Use DeterministicOperationalInsight */
export type DeterministicIndustryInsight = DeterministicOperationalInsight

/** Industry-tailored summaries + cards returned alongside AIden operational recommendations. */
export type IndustryOperationalBrief = {
  industryKey: WorkspaceIndustryKey
  profileId: string
  /** Structured dashboard findings (deterministic); string lines are derived for compatibility. */
  dashboardOperationalSummaries: OperationalDashboardFinding[]
  maintenanceOperationalSummaries: OperationalDashboardFinding[]
  dashboardSummaryLines: string[]
  maintenanceSummaryLines: string[]
  deterministicInsights: DeterministicOperationalInsight[]
  /** When true, no medium+ dashboard summaries and no insight cards fired deterministic rules. */
  signalsPresentationHealthy: boolean
  /** Prompt-only priors — not displayed as standalone facts. */
  recommendationPriors: string[]
  maintenancePriors: string[]
}
