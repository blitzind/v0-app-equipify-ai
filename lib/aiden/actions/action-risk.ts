/**
 * Risk classification for AIden **prepared** workspace actions (intent only — no LLM or execution here).
 */

export const AIDEN_PREPARED_WORKSPACE_ACTION_RISK_LEVELS = [
  "read_only",
  "draft_content",
  "operational_write",
  "financial_draft",
  "financial_write",
  "bulk_financial_write",
] as const

export type AidenPreparedWorkspaceActionRiskLevel = (typeof AIDEN_PREPARED_WORKSPACE_ACTION_RISK_LEVELS)[number]

export function isFinancialRiskLevel(level: AidenPreparedWorkspaceActionRiskLevel): boolean {
  return level === "financial_draft" || level === "financial_write" || level === "bulk_financial_write"
}

export function isBulkFinancialRiskLevel(level: AidenPreparedWorkspaceActionRiskLevel): boolean {
  return level === "bulk_financial_write"
}
