/**
 * SV1-5A — Postgres durable Draft Factory repository (production server entry).
 * Guards the production import path with `server-only`.
 * Implementation lives in draft-factory-durable-repository-core.ts.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createPostgresDraftFactoryRepository as createPostgresDraftFactoryRepositoryImpl,
  fetchDurableDraftFactoryLeadState as fetchDurableDraftFactoryLeadStateImpl,
  upsertDurableDraftFactoryLeadStateRow as upsertDurableDraftFactoryLeadStateRowImpl,
  insertDurableWakeReceiptRow as insertDurableWakeReceiptRowImpl,
} from "@/lib/growth/draft-factory/draft-factory-durable-repository-core"
import type { AiOsDraftFactoryDurableLeadState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import type { DraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"

export function createPostgresDraftFactoryRepository(
  admin: SupabaseClient,
): DraftFactoryDurableRepository {
  return createPostgresDraftFactoryRepositoryImpl(admin)
}

export async function fetchDurableDraftFactoryLeadState(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<AiOsDraftFactoryDurableLeadState | null> {
  return fetchDurableDraftFactoryLeadStateImpl(admin, organizationId, leadId)
}

export async function upsertDurableDraftFactoryLeadStateRow(
  admin: SupabaseClient,
  state: AiOsDraftFactoryDurableLeadState,
  expectedVersion?: number,
): Promise<boolean> {
  return upsertDurableDraftFactoryLeadStateRowImpl(admin, state, expectedVersion)
}

export async function insertDurableWakeReceiptRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeFingerprint: string
    wakeType: string
    outcome: string
    transitionSummary: Record<string, unknown>
    createdAt: string
  },
): Promise<"inserted" | "duplicate" | "error"> {
  return insertDurableWakeReceiptRowImpl(admin, input)
}
