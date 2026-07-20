/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Human approval workflow audit (client-safe).
 */

import type { SupervisedSalesWorkflowBlocker } from "@/lib/growth/training/supervised-sales-workflow-1b-types"

export type SupervisedSalesApprovalActionAudit = {
  action: string
  status: "built" | "partial" | "missing"
  mechanism: string
}

export function auditSupervisedSalesApprovalWorkflow(): SupervisedSalesApprovalActionAudit[] {
  return [
    {
      action: "Approve",
      status: "built",
      mechanism:
        "POST /api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/[packageId]/action (decision=approve)",
    },
    {
      action: "Reject",
      status: "built",
      mechanism: "Same route with decision=reject",
    },
    {
      action: "Edit",
      status: "built",
      mechanism:
        "POST .../packages/[packageId]/drafts with draftEdits; Completed Work editable blocks",
    },
    {
      action: "Request more research",
      status: "partial",
      mechanism:
        "POST /api/platform/growth/revenue-execution/recommendations/[id]/request-research; execution plan mark_needs_changes",
    },
    {
      action: "Request different contact",
      status: "partial",
      mechanism: "Operator memory actions + lead contact update; no dedicated package button",
    },
    {
      action: "Delay",
      status: "partial",
      mechanism: "Canonical decision engine delay/wait_until_agreed_date",
    },
    {
      action: "Skip",
      status: "built",
      mechanism: "POST /api/platform/growth/ai-os/completed-work/lifecycle (cancel_work, dismiss)",
    },
  ]
}

export function deriveSupervisedSalesBlockers(input: {
  runtimeMissing: number
  outboundKillSwitchEnabled: boolean
  qualifiedLeadCount: number
  packagesGenerated: number
  approvalActionsPartial: number
}): SupervisedSalesWorkflowBlocker[] {
  const blockers: SupervisedSalesWorkflowBlocker[] = []

  if (input.runtimeMissing > 0) {
    blockers.push({
      id: "missing_runtime_components",
      severity: "critical",
      description: `${input.runtimeMissing} supervised sales runtime components missing`,
      remediation: "Restore missing pipeline modules before supervised selling",
    })
  }

  if (input.outboundKillSwitchEnabled) {
    blockers.push({
      id: "outbound_not_gated",
      severity: "critical",
      description: "autonomy_outbound_enabled is true — supervised milestone requires outbound OFF",
      remediation: "Set autonomy_outbound_enabled=false via kill switch service",
    })
  }

  if (input.qualifiedLeadCount === 0) {
    blockers.push({
      id: "no_qualified_production_leads",
      severity: "high",
      description: "No outreach-eligible researched leads in production pool",
      remediation: "Run discovery + research on ICP leads before supervised sales cycle",
    })
  }

  if (input.packagesGenerated === 0 && input.qualifiedLeadCount > 0) {
    blockers.push({
      id: "no_approval_packages",
      severity: "high",
      description: "Qualified leads exist but no approval packages could be loaded or generated",
      remediation: "Run Draft Factory tick or preview package generation for top leads",
    })
  }

  if (input.approvalActionsPartial > 0) {
    blockers.push({
      id: "partial_approval_actions",
      severity: "medium",
      description: `${input.approvalActionsPartial} operator actions only partially wired on package card`,
      remediation: "Use lifecycle + canonical decision paths for delay/research until unified UX ships",
    })
  }

  return blockers
}
