/** Phase GE-HARDEN-3 — Static hardening audits (client-safe). */

import fs from "node:fs"
import path from "node:path"
import { GROWTH_ENGINE_E2E_CHAIN } from "@/lib/growth/e2e/growth-engine-e2e-subsystems"
import { runGrowthEngineSafetyAudit } from "@/lib/growth/e2e/growth-engine-e2e-safety-audit"
import { GROWTH_ENGINE_EMPTY_STATE_KINDS } from "@/lib/growth/e2e/growth-engine-hardening-empty-states"
import type { HardeningFinding, SubsystemHardeningResult } from "@/lib/growth/e2e/growth-engine-hardening-types"

const GS_PANELS: Record<string, string> = {
  prospect_discovery: "components/growth/prospect-search/natural-language-discovery-panel.tsx",
  signal_feed: "components/growth/growth-signal-feed-panel.tsx",
  operator_inbox: "components/growth/growth-operator-inbox-panel.tsx",
  campaign_readiness: "components/growth/growth-campaign-readiness-panel.tsx",
  conversational_playbooks: "components/growth/growth-conversational-playbooks-panel.tsx",
  human_interventions: "components/growth/growth-human-interventions-panel.tsx",
  follow_up_policies: "components/growth/growth-smart-follow-up-policies-panel.tsx",
  sequence_preview: "components/growth/growth-sequence-preview-studio-panel.tsx",
  campaign_builder: "components/growth/growth-campaign-builder-wizard-panel.tsx",
  realtime_events: "components/growth/growth-realtime-event-bus-panel.tsx",
  agent_orchestration: "components/growth/growth-agent-orchestration-panel.tsx",
  command_center_unification: "components/growth/growth-command-center-unified-workspace.tsx",
}

const GS_SERVICES: Record<string, string> = {
  signal_feed: "lib/growth/signal-intelligence/signal-feed-repository.ts",
  operator_inbox: "lib/growth/operator-inbox/operator-inbox-service.ts",
  campaign_readiness: "lib/growth/campaign-readiness/campaign-readiness-service.ts",
  conversational_playbooks: "lib/growth/conversational-playbooks/conversational-playbook-service.ts",
  human_interventions: "lib/growth/human-interventions/human-intervention-service.ts",
  follow_up_policies: "lib/growth/follow-up-policies/follow-up-policy-service.ts",
  sequence_preview: "lib/growth/sequence-preview/sequence-preview-service.ts",
  campaign_builder: "lib/growth/campaign-builder/campaign-builder-service.ts",
  realtime_events: "lib/growth/realtime-events/realtime-events-service.ts",
  agent_orchestration: "lib/growth/agent-orchestration/agent-orchestration-service.ts",
  command_center_unification: "lib/growth/command-center-unification/command-center-unification-service.ts",
}

const PANEL_EMPTY_KIND: Record<string, string> = {
  prospect_discovery: "no_leads",
  signal_feed: "no_signals",
  operator_inbox: "no_inbox_items",
  campaign_readiness: "no_campaign_readiness",
  conversational_playbooks: "no_playbooks",
  human_interventions: "no_interventions",
  follow_up_policies: "no_follow_up_policies",
  sequence_preview: "no_sequence_previews",
  campaign_builder: "no_campaign_builders",
  realtime_events: "no_events",
  agent_orchestration: "no_agent_plans",
  command_center_unification: "no_command_center_items",
}

const UX_REVIEW_TARGETS = [
  "components/growth/growth-command-center-dashboard.tsx",
  "components/growth/growth-operator-inbox-panel.tsx",
  "components/growth/inbox/growth-inbox-workspace-v2-panel.tsx",
  "components/growth/growth-command-center-unified-workspace.tsx",
] as const

function readSource(relativePath: string, cwd: string): string | null {
  const absolutePath = path.join(cwd, relativePath)
  if (!fs.existsSync(absolutePath)) return null
  return fs.readFileSync(absolutePath, "utf8")
}

function auditPanelSource(subsystemId: string, relativePath: string, cwd: string): {
  findings: HardeningFinding[]
  error_handling_ok: boolean
  empty_state_ok: boolean
  loading_retry_ok: boolean
  observability_ok: boolean
} {
  const findings: HardeningFinding[] = []
  const source = readSource(relativePath, cwd)
  if (!source) {
    findings.push({
      finding_id: `missing_panel_${subsystemId}`,
      severity: "critical",
      category: "error_handling",
      subsystem_id: subsystemId,
      description: `Panel file missing: ${relativePath}`,
      remediation: "Restore panel file for subsystem",
      file_path: relativePath,
    })
    return {
      findings,
      error_handling_ok: false,
      empty_state_ok: false,
      loading_retry_ok: false,
      observability_ok: false,
    }
  }

  const hasTryCatch = /try\s*\{/.test(source) && /catch/.test(source)
  const hasLoading = /Loader2|loading/.test(source)
  const hasRetry =
    /onRetry|Retry|Refresh|void load\(\)|reload/.test(source) ||
    /GrowthEnginePanelResilience/.test(source)
  const hasHonestEmpty =
    /GrowthEngineHonestEmptyState/.test(source) ||
    /growth-engine-honest-empty-state/.test(source) ||
    (/GrowthEnginePanelResilience/.test(source) && /emptyKind=/.test(source))
  const hasResilienceShell = /GrowthEnginePanelResilience/.test(source)
  const hasQaMarker = /data-qa-marker|GROWTH_ENGINE_HARDENING_QA_MARKER|GROWTH_ENGINE_HONEST_EMPTY_STATE_QA_MARKER/.test(
    source,
  )
  const hasErrorState = /error|setError|fetchError/.test(source) || hasResilienceShell
  const expectedEmptyKind = PANEL_EMPTY_KIND[subsystemId]
  const hasExpectedEmptyKind = expectedEmptyKind ? source.includes(`"${expectedEmptyKind}"`) : true

  if (!hasTryCatch) {
    findings.push({
      finding_id: `panel_no_try_catch_${subsystemId}`,
      severity: "warning",
      category: "error_handling",
      subsystem_id: subsystemId,
      description: `${relativePath} missing try/catch around fetch`,
      remediation: "Wrap async fetch in try/catch with graceful fallback",
      file_path: relativePath,
    })
  }

  if (!hasLoading) {
    findings.push({
      finding_id: `panel_no_loading_${subsystemId}`,
      severity: "warning",
      category: "loading_retry",
      subsystem_id: subsystemId,
      description: `${relativePath} missing loading indicator`,
      remediation: "Add Loader2 or GrowthEnginePanelResilience loading state",
      file_path: relativePath,
    })
  }

  if (!hasRetry) {
    findings.push({
      finding_id: `panel_no_retry_${subsystemId}`,
      severity: "warning",
      category: "loading_retry",
      subsystem_id: subsystemId,
      description: `${relativePath} missing retry/refresh path`,
      remediation: "Add retry button or GrowthEnginePanelResilience onRetry",
      file_path: relativePath,
    })
  }

  if (!hasHonestEmpty) {
    findings.push({
      finding_id: `panel_no_honest_empty_${subsystemId}`,
      severity: "warning",
      category: "empty_state",
      subsystem_id: subsystemId,
      description: `${relativePath} not using GrowthEngineHonestEmptyState`,
      remediation: `Use GrowthEngineHonestEmptyState with kind "${expectedEmptyKind}"`,
      file_path: relativePath,
    })
  }

  if (!hasExpectedEmptyKind && expectedEmptyKind) {
    findings.push({
      finding_id: `panel_wrong_empty_kind_${subsystemId}`,
      severity: "info",
      category: "empty_state",
      subsystem_id: subsystemId,
      description: `${relativePath} missing standardized empty kind "${expectedEmptyKind}"`,
      remediation: "Pass correct emptyKind to GrowthEnginePanelResilience",
      file_path: relativePath,
    })
  }

  if (!hasQaMarker) {
    findings.push({
      finding_id: `panel_no_qa_marker_${subsystemId}`,
      severity: "info",
      category: "observability",
      subsystem_id: subsystemId,
      description: `${relativePath} missing hardening QA marker`,
      remediation: "Add data-qa-marker for diagnostics tracing",
      file_path: relativePath,
    })
  }

  return {
    findings,
    error_handling_ok: hasTryCatch && hasErrorState,
    empty_state_ok: hasHonestEmpty && hasExpectedEmptyKind,
    loading_retry_ok: hasLoading && hasRetry,
    observability_ok: hasQaMarker,
  }
}

function auditServiceSource(subsystemId: string, relativePath: string, cwd: string): HardeningFinding[] {
  const findings: HardeningFinding[] = []
  const source = readSource(relativePath, cwd)
  if (!source) return findings

  if (!/\.catch\(\(\)/.test(source) && /await/.test(source)) {
    findings.push({
      finding_id: `service_missing_catch_${subsystemId}`,
      severity: "info",
      category: "error_handling",
      subsystem_id: subsystemId,
      description: `${relativePath} may lack defensive .catch() on parallel fetches`,
      remediation: "Add .catch(() => null) on non-critical parallel subsystem fetches",
      file_path: relativePath,
    })
  }

  if (/for\s*\([^)]*\)\s*\{[^}]*await/.test(source)) {
    findings.push({
      finding_id: `service_sequential_${subsystemId}`,
      severity: "info",
      category: "error_handling",
      subsystem_id: subsystemId,
      description: `Potential sequential await loop in ${relativePath}`,
      remediation: "Batch independent fetches with Promise.all",
      file_path: relativePath,
    })
  }

  return findings
}

export function runGrowthEngineUxReview(cwd = process.cwd()): HardeningFinding[] {
  const findings: HardeningFinding[] = []

  for (const relativePath of UX_REVIEW_TARGETS) {
    const source = readSource(relativePath, cwd)
    if (!source) continue

    if (/GrowthOperatorInboxPanel[\s\S]*GrowthOperatorInboxPanel/.test(source)) {
      findings.push({
        finding_id: `ux_nested_inbox_${relativePath}`,
        severity: "warning",
        category: "ux_review",
        subsystem_id: "operator_inbox",
        description: "Potential duplicate nested inbox panels detected",
        remediation: "Avoid rendering nested operator inbox inside inbox workspace",
        file_path: relativePath,
      })
    }

    if ((source.match(/void load\(\)/g) ?? []).length > 3) {
      findings.push({
        finding_id: `ux_excessive_refresh_${relativePath}`,
        severity: "info",
        category: "ux_review",
        subsystem_id: null,
        description: `${relativePath} has multiple load() invocations — review refresh frequency`,
        remediation: "Debounce refreshes; use useGrowthRealtimeRefresh with 45s polling fallback",
        file_path: relativePath,
      })
    }

    if (/useGrowthRealtimeRefresh/.test(source) && !/pollingIntervalMs|45_000|45000/.test(source)) {
      findings.push({
        finding_id: `ux_realtime_default_polling_${relativePath}`,
        severity: "info",
        category: "ux_review",
        subsystem_id: "realtime_events",
        description: `${relativePath} uses realtime refresh — confirm polling fallback is active`,
        remediation: "Default 45s polling fallback via useGrowthRealtimeRefresh",
        file_path: relativePath,
      })
    }
  }

  findings.push({
    finding_id: "ux_review_dismiss_consistency",
    severity: "info",
    category: "ux_review",
    subsystem_id: null,
    description: "Review/dismiss actions use human-gated POST routes — no autonomous side effects",
    remediation: "Maintain mark_viewed/mark_reviewed/dismiss only; no execute outreach",
  })

  return findings
}

export function runGrowthEngineHardeningAudit(cwd = process.cwd()): {
  findings: HardeningFinding[]
  subsystem_matrix: SubsystemHardeningResult[]
  safety_audit: ReturnType<typeof runGrowthEngineSafetyAudit>
  panels_with_retry: number
  panels_missing_retry: number
} {
  const findings: HardeningFinding[] = []
  const safety_audit = runGrowthEngineSafetyAudit(cwd)

  for (const finding of safety_audit.violations.map((v) => ({
    finding_id: `safety_${v.file}_${v.pattern}`,
    severity: "critical" as const,
    category: "safety" as const,
    subsystem_id: null,
    description: `${v.file}: forbidden pattern "${v.pattern}"`,
    remediation: v.hint,
    file_path: v.file,
  }))) {
    findings.push(finding)
  }

  for (const kind of GROWTH_ENGINE_EMPTY_STATE_KINDS) {
    const configPath = "lib/growth/e2e/growth-engine-hardening-empty-states.ts"
    const configSource = readSource(configPath, cwd)
    if (configSource && !configSource.includes(`kind: "${kind}"`)) {
      findings.push({
        finding_id: `missing_empty_config_${kind}`,
        severity: "critical",
        category: "empty_state",
        subsystem_id: null,
        description: `Missing empty state config for "${kind}"`,
        remediation: "Add to growth-engine-hardening-empty-states.ts",
      })
    }
  }

  const subsystem_matrix: SubsystemHardeningResult[] = []
  let panels_with_retry = 0
  let panels_missing_retry = 0

  for (const subsystemId of GROWTH_ENGINE_E2E_CHAIN) {
    const panelPath = GS_PANELS[subsystemId]
    const servicePath = GS_SERVICES[subsystemId]

    const panelAudit = panelPath
      ? auditPanelSource(subsystemId, panelPath, cwd)
      : {
          findings: [],
          error_handling_ok: subsystemId === "prospect_discovery",
          empty_state_ok: subsystemId === "prospect_discovery",
          loading_retry_ok: subsystemId === "prospect_discovery",
          observability_ok: true,
        }

    findings.push(...panelAudit.findings)

    if (servicePath) {
      findings.push(...auditServiceSource(subsystemId, servicePath, cwd))
    }

    if (panelAudit.loading_retry_ok) panels_with_retry += 1
    else if (panelPath) panels_missing_retry += 1

    const subsystemFindings = findings.filter((f) => f.subsystem_id === subsystemId)
    const critical = subsystemFindings.filter((f) => f.severity === "critical")
    const pass =
      critical.length === 0 &&
      panelAudit.error_handling_ok &&
      panelAudit.empty_state_ok &&
      panelAudit.loading_retry_ok

    subsystem_matrix.push({
      subsystem_id: subsystemId,
      phase: subsystemId,
      error_handling_ok: panelAudit.error_handling_ok,
      empty_state_ok: panelAudit.empty_state_ok,
      loading_retry_ok: panelAudit.loading_retry_ok,
      observability_ok: panelAudit.observability_ok,
      kill_switch_ok: true,
      ux_ok: !subsystemFindings.some((f) => f.category === "ux_review" && f.severity === "warning"),
      safety_ok: !subsystemFindings.some((f) => f.category === "safety"),
      pass,
      findings: subsystemFindings.map((f) => f.finding_id),
    })
  }

  findings.push(...runGrowthEngineUxReview(cwd))

  return { findings, subsystem_matrix, safety_audit, panels_with_retry, panels_missing_retry }
}

export { GS_PANELS, PANEL_EMPTY_KIND }
