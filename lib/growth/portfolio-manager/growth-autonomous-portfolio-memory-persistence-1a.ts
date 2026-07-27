/** AVA-PORTFOLIO-MEMORY-PERSISTENCE-HOTFIX-1A — Observable portfolio memory preference writes (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { upsertOrganizationMemoryPreferences } from "@/lib/growth/memory/storage/organization-memory-repository"
import {
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
  GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY,
  type GrowthPortfolioManagerMemory,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  isValidOrganizationMemoryPreferenceImportance,
  portfolioManagerMemoryPreferencePayload,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"

export const AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_QA_MARKER =
  "ava-portfolio-memory-persistence-hotfix-1a-v1" as const

export type PortfolioManagerMemoryPersistReason =
  | "slice_selection"
  | "slice_outcome"
  | "discovery_batch"
  | "verification_probe"

export type PortfolioManagerMemoryPersistResult = {
  qaMarker: typeof AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_QA_MARKER
  status: "persisted" | "failed" | "skipped"
  rowsWritten: number
  reason: PortfolioManagerMemoryPersistReason
  detail: string | null
}

export async function persistPortfolioManagerMemoryPreferences(
  admin: SupabaseClient,
  input: {
    organizationId: string
    memory: GrowthPortfolioManagerMemory
    generatedAt: string
    reason: PortfolioManagerMemoryPersistReason
  },
): Promise<PortfolioManagerMemoryPersistResult> {
  const preference = portfolioManagerMemoryPreferencePayload(
    input.organizationId,
    input.memory,
    input.generatedAt,
  )

  if (!isValidOrganizationMemoryPreferenceImportance(preference.importance)) {
    const detail = `invalid_importance:${preference.importance}`
    logGrowthEngine("portfolio_manager_memory_persist_failed", {
      qa_marker: AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_QA_MARKER,
      portfolio_qa_marker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      organization_id: input.organizationId,
      reason: input.reason,
      preference_key: GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY,
      detail,
    })
    return {
      qaMarker: AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_QA_MARKER,
      status: "failed",
      rowsWritten: 0,
      reason: input.reason,
      detail,
    }
  }

  const rowsWritten = await upsertOrganizationMemoryPreferences(admin, {
    organizationId: input.organizationId,
    preferences: [preference],
  })

  if (rowsWritten > 0) {
    logGrowthEngine("portfolio_manager_memory_persisted", {
      qa_marker: AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_QA_MARKER,
      portfolio_qa_marker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      organization_id: input.organizationId,
      reason: input.reason,
      preference_key: GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY,
      rows_written: rowsWritten,
    })
    return {
      qaMarker: AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_QA_MARKER,
      status: "persisted",
      rowsWritten,
      reason: input.reason,
      detail: null,
    }
  }

  const detail = "upsert_returned_zero"
  logGrowthEngine("portfolio_manager_memory_persist_failed", {
    qa_marker: AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_QA_MARKER,
    portfolio_qa_marker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    organization_id: input.organizationId,
    reason: input.reason,
    preference_key: GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY,
    detail,
  })
  return {
    qaMarker: AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_QA_MARKER,
    status: "failed",
    rowsWritten: 0,
    reason: input.reason,
    detail,
  }
}
