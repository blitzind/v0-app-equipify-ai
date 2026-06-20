import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export type WakeBatchState = {
  processorKey: string
  wakeCursor: string | null
  processedCount: number
  remainingCount: number
  updatedAt: string
}

function wakeBatchTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_wake_batch_state")
}

export async function getWakeBatchState(
  admin: SupabaseClient,
  processorKey: string,
): Promise<WakeBatchState> {
  const { data, error } = await wakeBatchTable(admin)
    .select("*")
    .eq("processor_key", processorKey)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    return {
      processorKey,
      wakeCursor: null,
      processedCount: 0,
      remainingCount: 0,
      updatedAt: new Date().toISOString(),
    }
  }

  const row = data as Record<string, unknown>
  return {
    processorKey,
    wakeCursor: row.wake_cursor ? String(row.wake_cursor) : null,
    processedCount: Number(row.processed_count ?? 0),
    remainingCount: Number(row.remaining_count ?? 0),
    updatedAt: String(row.updated_at ?? ""),
  }
}

export async function persistWakeBatchState(
  admin: SupabaseClient,
  input: {
    processorKey: string
    wakeCursor: string | null
    processedCount: number
    remainingCount: number
  },
): Promise<void> {
  const { error } = await wakeBatchTable(admin).upsert(
    {
      processor_key: input.processorKey,
      wake_cursor: input.wakeCursor,
      processed_count: input.processedCount,
      remaining_count: input.remainingCount,
      qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "processor_key" },
  )
  if (error) throw new Error(error.message)
}
