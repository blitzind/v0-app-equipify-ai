/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Runtime component readiness audit (client-safe).
 */

import type { SupervisedSalesRuntimeComponentAudit } from "@/lib/growth/training/supervised-sales-workflow-1b-types"

function component(
  id: SupervisedSalesRuntimeComponentAudit["id"],
  label: string,
  status: SupervisedSalesRuntimeComponentAudit["status"],
  locations: string[],
  notes?: string,
): SupervisedSalesRuntimeComponentAudit {
  return { id, label, status, locations, notes }
}

export function auditSupervisedSalesRuntimeComponents(): SupervisedSalesRuntimeComponentAudit[] {
  return [
    component(
      "discovery",
      "Discovery (Prospect Search / portfolio replenishment)",
      "present",
      [
        "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts",
        "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
        "lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts",
      ],
    ),
    component(
      "research",
      "Research orchestrator",
      "present",
      [
        "lib/growth/research/research-orchestrator.ts",
        "lib/growth/research/growth-lead-research-execution-service.ts",
        "lib/growth/ava-home/growth-ava-research-orchestrator-service.ts",
      ],
    ),
    component(
      "provider_bridge",
      "Provider industry → ICP bridge",
      "present",
      ["lib/growth/lead-sources/datamoon/datamoon-provider-industry-icp-bridge-1a.ts"],
    ),
    component(
      "operational_keyword_validation",
      "Post-research operational keyword validation",
      "present",
      [
        "lib/growth/revenue-workflow/growth-operational-keyword-validation-1a.ts",
        "lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a.ts",
      ],
      "External discovery (datamoon) only — by design",
    ),
    component(
      "admission",
      "Lead admission gate",
      "present",
      [
        "lib/growth/revenue-workflow/evaluate-growth-lead-admission.ts",
        "lib/growth/revenue-workflow/growth-lead-admission-production-analysis.ts",
      ],
    ),
    component(
      "seller_truth",
      "Seller truth projection",
      "present",
      [
        "lib/growth/aios/growth/growth-outreach-seller-truth.ts",
        "lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts",
      ],
    ),
    component(
      "sales_strategy_brief",
      "Sales strategy brief",
      "present",
      ["lib/growth/aios/growth/growth-outreach-sales-strategy-brief.ts"],
    ),
    component(
      "approval_package",
      "Approval package generation (Growth 5F)",
      "present",
      [
        "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
        "lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence.ts",
        "lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts",
      ],
    ),
    component(
      "human_approval",
      "Human approval workflow",
      "present",
      [
        "app/(growth)/growth/os/approvals/page.tsx",
        "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/[packageId]/action/route.ts",
        "app/api/platform/growth/ai-os/completed-work/lifecycle/route.ts",
        "lib/growth/aios/approvals/approvals-operator-review-packet.ts",
      ],
      "Delay/request-research via lifecycle + canonical decision — not dedicated package buttons",
    ),
    component(
      "outbound_kill_switch",
      "Outbound kill switch",
      "present",
      ["lib/growth/runtime-guardrails/growth-runtime-kill-switch-service.ts"],
      "Default autonomy_outbound_enabled=false",
    ),
  ]
}

export function summarizeRuntimeReadiness(audit: SupervisedSalesRuntimeComponentAudit[]): {
  present: number
  partial: number
  missing: number
  score: number
} {
  const present = audit.filter((row) => row.status === "present").length
  const partial = audit.filter((row) => row.status === "partial").length
  const missing = audit.filter((row) => row.status === "missing").length
  const score = audit.length > 0 ? (present + partial * 0.5) / audit.length : 0
  return { present, partial, missing, score }
}
