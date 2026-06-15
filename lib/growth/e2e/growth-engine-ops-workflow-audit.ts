/** Phase GE-OPS-1 — Human workflow certification (client-safe). */

import {
  assertReadinessSafetyInvariants,
  runGrowthEngineSafetyAudit,
} from "@/lib/growth/e2e/growth-engine-e2e-safety-audit"
import { GROWTH_ENGINE_E2E_SUBSYSTEMS } from "@/lib/growth/e2e/growth-engine-e2e-subsystems"
import type { HumanWorkflowStepResult, OpsFinding } from "@/lib/growth/e2e/growth-engine-ops-types"

export const HUMAN_WORKFLOW_CHAIN = [
  { step_id: "lead_imported", label: "Lead Imported", subsystem_id: "prospect_discovery" },
  { step_id: "signals_generated", label: "Signals Generated", subsystem_id: "signal_feed" },
  { step_id: "recommendations_produced", label: "Recommendations Produced", subsystem_id: "operator_inbox" },
  { step_id: "campaign_readiness", label: "Campaign Readiness Assessed", subsystem_id: "campaign_readiness" },
  { step_id: "playbooks_available", label: "Playbooks Available", subsystem_id: "conversational_playbooks" },
  { step_id: "interventions_queued", label: "Interventions Queued", subsystem_id: "human_interventions" },
  { step_id: "follow_up_policies", label: "Follow-Up Policies", subsystem_id: "follow_up_policies" },
  { step_id: "sequence_preview", label: "Sequence Preview", subsystem_id: "sequence_preview" },
  { step_id: "campaign_built", label: "Campaign Built", subsystem_id: "campaign_builder" },
  { step_id: "agent_plan_produced", label: "Agent Plan Produced", subsystem_id: "agent_orchestration" },
  { step_id: "human_review", label: "Human Review", subsystem_id: "command_center_unification" },
  { step_id: "approval_queue", label: "Approval Queue", subsystem_id: "operator_inbox" },
] as const

export function certifyHumanWorkflow(): {
  steps: HumanWorkflowStepResult[]
  safety_findings: OpsFinding[]
  workflow_findings: OpsFinding[]
} {
  const steps: HumanWorkflowStepResult[] = []
  const safety_findings: OpsFinding[] = []
  const workflow_findings: OpsFinding[] = []

  const safetyAudit = runGrowthEngineSafetyAudit()
  for (const violation of safetyAudit.violations) {
    safety_findings.push({
      finding_id: `safety_${violation.file}_${violation.pattern}`,
      severity: "critical",
      category: "safety",
      description: `${violation.file}: ${violation.pattern}`,
      remediation: violation.hint,
    })
  }

  for (const step of HUMAN_WORKFLOW_CHAIN) {
    const def = GROWTH_ENGINE_E2E_SUBSYSTEMS.find((s) => s.subsystem_id === step.subsystem_id)
    if (!def) {
      steps.push({
        step_id: step.step_id,
        label: step.label,
        safety_invariants_ok: false,
        pass: false,
      })
      workflow_findings.push({
        finding_id: `workflow_missing_${step.step_id}`,
        severity: "critical",
        category: "workflow",
        description: `Subsystem ${step.subsystem_id} not registered for step ${step.step_id}`,
        remediation: "Register subsystem in GROWTH_ENGINE_E2E_SUBSYSTEMS",
      })
      continue
    }

    const readiness = def.buildReadiness()
    const safety = assertReadinessSafetyInvariants(readiness)
    if (!safety.ok) {
      workflow_findings.push({
        finding_id: `workflow_safety_${step.step_id}`,
        severity: "critical",
        category: "workflow",
        description: `${step.label}: ${safety.failures.join(", ")}`,
        remediation: "Fix readiness payload safety invariants",
      })
    }

    steps.push({
      step_id: step.step_id,
      label: step.label,
      safety_invariants_ok: safety.ok,
      pass: safety.ok,
    })
  }

  workflow_findings.push({
    finding_id: "workflow_no_autonomous_outreach",
    severity: "info",
    category: "workflow",
    description: "Full workflow chain requires human review at every execution gate",
    remediation: "Maintain requires_human_review=true on all readiness and action routes",
  })

  return { steps, safety_findings, workflow_findings }
}

export function verifyWorkflowSafetyInvariants(): boolean {
  const { steps } = certifyHumanWorkflow()
  return steps.every((s) => s.safety_invariants_ok && s.pass)
}
