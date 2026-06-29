/**
 * GE-IRE-6G — Account Outreach Strategy panel view model (client-safe).
 */

import { GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER } from "@/lib/growth/contact-verification/account-outreach-strategy-panel-feature"

export type AccountOutreachStrategyPanelPrimaryView = {
  display_name: string
  committee_role?: string
  recommended_channel: string
  score: number
  confidence: number
  recommended_email?: string | null
  recommended_email_present: boolean
  reasons: string[]
  evidence: string[]
  warnings: string[]
}

export type AccountOutreachStrategyPanelBackupView = {
  display_name: string
  committee_role?: string
  recommended_channel: string
  score: number
  reasons: string[]
}

export type AccountOutreachStrategyPanelCommitteeView = {
  coverage_score: number
  coverage_tier: string
  covered_roles: string[]
  missing_roles: string[]
  recommended_strategy: string
}

export type AccountOutreachStrategyPanelStagedStepView = {
  step: number
  action: string
  contact_name?: string
  committee_role?: string
  channel: string
  rationale: string
}

export type AccountOutreachStrategyPanelReadinessView = {
  ready: boolean
  score: number
  tier: string
  blockers: string[]
}

export type AccountOutreachStrategyPanelView = {
  qa_marker: typeof GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER
  company_name?: string
  domain?: string
  primary?: AccountOutreachStrategyPanelPrimaryView
  backups: AccountOutreachStrategyPanelBackupView[]
  committee: AccountOutreachStrategyPanelCommitteeView
  staged_plan: AccountOutreachStrategyPanelStagedStepView[]
  readiness: AccountOutreachStrategyPanelReadinessView
  summary: {
    total_contacts: number
    recommended_contacts: number
    primary_contact?: string
    recommended_strategy: string
  }
  warnings: string[]
}

export type AccountOutreachStrategyPanelApiResponse = {
  ok: boolean
  enabled: boolean
  view?: AccountOutreachStrategyPanelView
  message?: string
}
