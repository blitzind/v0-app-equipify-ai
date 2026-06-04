import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { runCanonicalPersonBackfill } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import {
  buildCanonicalPersonBackfillApiResponse,
  parseCanonicalPersonBackfillRequest,
} from "@/lib/growth/canonical-persons/canonical-person-backfill-api"
import {
  GROWTH_CANONICAL_PERSON_MIGRATION,
  isGrowthCanonicalPersonSchemaReady,
} from "@/lib/growth/canonical-persons/canonical-person-schema-health"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = parseCanonicalPersonBackfillRequest(await request.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error, message: parsed.message },
      { status: 400 },
    )
  }

  if (!(await isGrowthCanonicalPersonSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_CANONICAL_PERSON_MIGRATION,
        message: "Apply migration 20270709120000_growth_engine_canonical_persons_7_2b.sql first.",
      },
      { status: 503 },
    )
  }

  const startedMs = Date.now()
  try {
    const result = await runCanonicalPersonBackfill(access.admin, {
      mode: parsed.mode,
      batchSize: parsed.batchSize,
      cursor: parsed.cursor,
    })
    const duration_ms = Date.now() - startedMs

    logGrowthEngine("canonical_person_backfill", {
      mode: parsed.mode,
      duration_ms,
      done: result.done,
      batch_size: result.progress.batch_size,
      processed_in_chunk: result.progress.processed_in_chunk,
      current_source_table: result.progress.current_source_table,
      actor_user_id: access.userId,
      merge_groups_by_email: result.stats.merge_groups_by_email,
      canonical_persons_after: result.stats.canonical_persons_after,
    })

    return NextResponse.json(
      buildCanonicalPersonBackfillApiResponse({
        mode: parsed.mode,
        result,
        duration_ms,
      }),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Canonical person backfill failed."
    logGrowthEngine("canonical_person_backfill_failed", {
      mode: parsed.mode,
      message,
      actor_user_id: access.userId,
    })
    return NextResponse.json({ ok: false, error: "backfill_failed", message }, { status: 500 })
  }
}
