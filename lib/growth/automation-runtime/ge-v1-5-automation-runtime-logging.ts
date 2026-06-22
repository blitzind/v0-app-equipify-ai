/** GE-v1-5 — Runtime audit logging (client-safe). */

import {
  GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  type GeV15AutomationRuntimeLeadState,
  type GeV15AutomationRuntimeTrigger,
  type GeV15RuntimeLogEntry,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

const MAX_LOG_ENTRIES = 100

export function createEmptyGeV15RuntimeState(): GeV15AutomationRuntimeLeadState {
  return {
    qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
    recommendations: [],
    preparedActions: [],
    pendingDelays: [],
    logs: [],
    lastSignalAt: null,
    lastProcessedTrigger: null,
  }
}

export function parseGeV15RuntimeState(
  metadata: Record<string, unknown> | null | undefined,
): GeV15AutomationRuntimeLeadState {
  const raw = metadata?.ge_v1_5_automation_runtime
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return createEmptyGeV15RuntimeState()
  }
  const state = raw as Partial<GeV15AutomationRuntimeLeadState>
  return {
    qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
    recommendations: Array.isArray(state.recommendations) ? state.recommendations : [],
    preparedActions: Array.isArray(state.preparedActions) ? state.preparedActions : [],
    pendingDelays: Array.isArray(state.pendingDelays) ? state.pendingDelays : [],
    logs: Array.isArray(state.logs) ? state.logs : [],
    lastSignalAt: typeof state.lastSignalAt === "string" ? state.lastSignalAt : null,
    lastProcessedTrigger: state.lastProcessedTrigger ?? null,
  }
}

export function appendGeV15RuntimeLog(
  state: GeV15AutomationRuntimeLeadState,
  entry: Omit<GeV15RuntimeLogEntry, "id" | "at">,
): GeV15AutomationRuntimeLeadState {
  const logEntry: GeV15RuntimeLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  }
  return {
    ...state,
    logs: [logEntry, ...state.logs].slice(0, MAX_LOG_ENTRIES),
  }
}

export function buildGeV15TriggerLogMessage(
  trigger: GeV15AutomationRuntimeTrigger,
  playbookId?: string,
): string {
  return playbookId
    ? `Signal ${trigger} matched playbook ${playbookId}`
    : `Signal ${trigger} received`
}

export function buildGeV15ConditionLogMessage(
  passed: boolean,
  results: Array<{ kind: string; passed: boolean }>,
): string {
  const summary = results.map((r) => `${r.kind}:${r.passed ? "pass" : "fail"}`).join(", ")
  return passed ? `Conditions passed (${summary})` : `Conditions blocked (${summary})`
}

export function buildGeV15ActionLogMessage(action: string, title: string): string {
  return `Action ${action} — ${title}`
}

export function buildGeV15ApprovalLogMessage(
  actionId: string,
  fromStatus: string,
  toStatus: string,
): string {
  return `Approval ${actionId}: ${fromStatus} → ${toStatus}`
}
