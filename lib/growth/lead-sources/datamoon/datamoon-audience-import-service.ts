import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  buildDatamoonUnifiedIntakePayload,
  formatDatamoonUnifiedIntakeRecordMessage,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-intake"
import { findDatamoonAudienceDedupeMatch } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-dedupe"
import {
  isDatamoonRecordImportable,
  normalizeDatamoonAudienceRecord,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import {
  createDatamoonAudienceImportRun,
  fetchDatamoonAudienceImportRunById,
  fetchDatamoonAudienceImportRecordsByIds,
  listDatamoonAudienceImportRecords,
  replaceDatamoonAudienceImportRecords,
  updateDatamoonAudienceImportRecord,
  updateDatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { sanitizeDatamoonProviderMetadata, sanitizeDatamoonProviderRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-sanitizer"
import {
  GROWTH_DATAMOON_AUDIENCE_IMPORT_QA_MARKER,
  type DatamoonAudienceImportRecord,
  type DatamoonAudienceImportRequest,
  type DatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { validateDatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"
import { createGrowthLead } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { runUnifiedRevenueWorkflowAfterIntake } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-intake-runner"
import {
  buildAudience,
  fetchAudience,
  isDatamoonDryRunOnly,
  isDatamoonProviderEnabled,
} from "@/lib/growth/providers/datamoon/datamoon-client"
import { resolveDatamoonAudienceMode } from "@/lib/growth/providers/datamoon/datamoon-config"
import type { DatamoonFetchImpl } from "@/lib/growth/providers/datamoon/datamoon-http"

export { GROWTH_DATAMOON_AUDIENCE_IMPORT_QA_MARKER }

type Actor = { userId: string | null; email?: string | null }

type ServiceOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: DatamoonFetchImpl
}

function resolveCompanyName(normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>): string {
  const explicit = normalized.company_name?.trim()
  if (explicit) return explicit
  if (normalized.company_domain) return normalized.company_domain
  if (normalized.email) return normalized.email.split("@")[1] ?? "Unknown Company"
  return "Unknown Company"
}

export async function startDatamoonAudienceImportRun(
  admin: SupabaseClient,
  input: DatamoonAudienceImportRequest,
  actor: Actor,
  options?: ServiceOptions,
): Promise<{ ok: true; run: DatamoonAudienceImportRun } | { ok: false; error: string; issues?: unknown }> {
  const validation = validateDatamoonAudienceImportRequest(input)
  if (!validation.ok) {
    return { ok: false, error: "validation_failed", issues: validation.issues }
  }

  const env = options?.env ?? process.env
  if (!isDatamoonProviderEnabled(env)) {
    return { ok: false, error: "datamoon_provider_disabled" }
  }

  const providerMode = input.provider_mode ?? resolveDatamoonAudienceMode(env)
  const dryRun = isDatamoonDryRunOnly(env)

  const run = await createDatamoonAudienceImportRun(admin, {
    runName: input.run_name.trim(),
    providerMode,
    audienceType: input.audience_type,
    filters: input.filters,
    topicIds: input.topic_ids ?? [],
    requestedLimit: input.limit ?? null,
    audienceName: input.name?.trim() ?? null,
    websiteId: input.website_id?.trim() ?? null,
    dryRun,
    createdBy: actor.userId,
  })

  if (!run) return { ok: false, error: "run_create_failed" }

  const build = await buildAudience(
    {
      type: input.audience_type,
      filters: input.filters,
      topic_ids: input.topic_ids,
      name: input.name,
      website_id: input.website_id,
      limit: input.limit,
      record_limit: input.limit,
    },
    { env, audienceMode: providerMode, fetchImpl: options?.fetchImpl },
  )

  if (build.status === "skipped" || build.status === "failed") {
    await updateDatamoonAudienceImportRun(admin, run.id, {
      status: "failed",
      errorMessage: build.message,
      providerMetadata: sanitizeDatamoonProviderMetadata({
        build_status: build.status,
        error_category: build.error_category,
        validation_errors: build.validation_errors,
      }) as Record<string, unknown>,
    })
    return { ok: false, error: build.message, issues: build.validation_errors ?? undefined }
  }

  const audienceId =
    typeof build.data?.id === "string"
      ? build.data.id
      : build.status === "dry_run"
        ? String(build.data?.id ?? "dry-run-audience-id")
        : null

  const updated = await updateDatamoonAudienceImportRun(admin, run.id, {
    datamoonAudienceId: audienceId,
    status: build.status === "dry_run" ? "building" : "building",
    loadingCount: typeof build.data?.record_count === "number" ? build.data.record_count : 0,
    providerMetadata: sanitizeDatamoonProviderMetadata({
      qa_marker: GROWTH_DATAMOON_AUDIENCE_IMPORT_QA_MARKER,
      build_status: build.status,
      build_message: build.message,
      dry_run: build.dry_run,
      audience_mode: build.audience_mode,
    }) as Record<string, unknown>,
  })

  logGrowthEngine("datamoon_audience_import_build_started", {
    runId: run.id,
    audienceId,
    dryRun: build.dry_run,
  })

  return { ok: true, run: updated ?? run }
}

export async function pollDatamoonAudienceImportRun(
  admin: SupabaseClient,
  runId: string,
  options?: ServiceOptions,
): Promise<{ ok: true; run: DatamoonAudienceImportRun; records: DatamoonAudienceImportRecord[] } | { ok: false; error: string }> {
  const existing = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!existing) return { ok: false, error: "run_not_found" }
  if (!existing.datamoonAudienceId) return { ok: false, error: "missing_audience_id" }

  const env = options?.env ?? process.env
  const fetchResult = await fetchAudience(existing.datamoonAudienceId, {
    env,
    audienceMode: existing.providerMode,
    fetchImpl: options?.fetchImpl,
  })

  const now = new Date().toISOString()

  if (fetchResult.status === "skipped" || fetchResult.status === "failed") {
    const failed = await updateDatamoonAudienceImportRun(admin, runId, {
      status: "failed",
      errorMessage: fetchResult.message,
      lastPolledAt: now,
      providerMetadata: {
        ...existing.providerMetadata,
        ...(sanitizeDatamoonProviderMetadata({
          poll_status: fetchResult.status,
          error_category: fetchResult.error_category,
        }) as Record<string, unknown>),
      },
    })
    return { ok: false, error: fetchResult.message, ...(failed ? {} : {}) }
  }

  const providerStatus = String(fetchResult.data?.status ?? "in_progress")
  const rawRecords = Array.isArray(fetchResult.data?.records) ? fetchResult.data.records : []
  const recordCount =
    typeof fetchResult.data?.record_count === "number" ? fetchResult.data.record_count : rawRecords.length

  if (providerStatus !== "completed" && fetchResult.status !== "dry_run") {
    const building = await updateDatamoonAudienceImportRun(admin, runId, {
      status: "building",
      loadingCount: recordCount,
      recordCount,
      lastPolledAt: now,
      providerMetadata: {
        ...existing.providerMetadata,
        poll_status: providerStatus,
      },
    })
    return { ok: true, run: building ?? existing, records: [] }
  }

  const previewRecords = [] as Array<{
    recordIndex: number
    status: "preview" | "duplicate" | "skipped"
    normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>
    providerRecord: Record<string, unknown>
    dedupeRule?: string | null
    dedupeKey?: string | null
    matchedLeadId?: string | null
    message?: string | null
  }>

  let duplicateCount = 0
  let skippedCount = 0

  for (let index = 0; index < rawRecords.length; index += 1) {
    const raw = rawRecords[index]
    const normalized = normalizeDatamoonAudienceRecord(raw, { providerMode: existing.providerMode })
    const providerRecord = sanitizeDatamoonProviderRecord(raw)

    if (!isDatamoonRecordImportable(normalized)) {
      skippedCount += 1
      previewRecords.push({
        recordIndex: index,
        status: "skipped",
        normalized,
        providerRecord,
        message: "Missing importable identity (email, phone, LinkedIn, or name).",
      })
      continue
    }

    const dedupe = await findDatamoonAudienceDedupeMatch(admin, normalized)
    if (dedupe) {
      duplicateCount += 1
      previewRecords.push({
        recordIndex: index,
        status: "duplicate",
        normalized,
        providerRecord,
        dedupeRule: dedupe.rule,
        dedupeKey: dedupe.dedupeKey,
        matchedLeadId: dedupe.leadId,
        message: `Duplicate via ${dedupe.rule}.`,
      })
      continue
    }

    previewRecords.push({
      recordIndex: index,
      status: "preview",
      normalized,
      providerRecord,
    })
  }

  await replaceDatamoonAudienceImportRecords(admin, runId, previewRecords)

  const completed = await updateDatamoonAudienceImportRun(admin, runId, {
    status: "completed",
    recordCount,
    loadingCount: 0,
    previewCount: previewRecords.filter((row) => row.status === "preview").length,
    duplicateCount,
    skippedCount,
    lastPolledAt: now,
    completedAt: now,
    providerMetadata: {
      ...existing.providerMetadata,
      poll_status: providerStatus,
      fetch_status: fetchResult.status,
    },
  })

  const records = await listDatamoonAudienceImportRecords(admin, runId)
  return { ok: true, run: completed ?? existing, records }
}

export async function importDatamoonAudiencePreviewRecords(
  admin: SupabaseClient,
  runId: string,
  input: {
    recordIds?: string[]
    importAllPreviewed?: boolean
    actor: Actor
  },
): Promise<{
  ok: true
  run: DatamoonAudienceImportRun
  imported: number
  duplicates: number
  skipped: number
  errors: number
  leadIds: string[]
}> {
  const run = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!run) throw new Error("run_not_found")
  if (run.status !== "completed" && run.status !== "imported_partial") {
    throw new Error("run_not_ready_for_import")
  }

  let records: DatamoonAudienceImportRecord[] = []
  if (input.importAllPreviewed) {
    records = await listDatamoonAudienceImportRecords(admin, runId, { status: "preview" })
  } else if (input.recordIds?.length) {
    records = await fetchDatamoonAudienceImportRecordsByIds(admin, runId, input.recordIds)
    records = records.filter((record) => record.status === "preview")
  } else {
    throw new Error("record_selection_required")
  }

  await updateDatamoonAudienceImportRun(admin, runId, { status: "importing" })

  let imported = 0
  let duplicates = 0
  let skipped = 0
  let errors = 0
  const leadIds: string[] = []
  const unifiedIntakeWarnings: Array<{ record_id: string; skip_reason: string }> = []

  for (const record of records) {
    const normalized = record.normalized
    if (!isDatamoonRecordImportable(normalized)) {
      skipped += 1
      await updateDatamoonAudienceImportRecord(admin, record.id, {
        status: "skipped",
        message: "Not importable at commit time.",
      })
      continue
    }

    const dedupe = await findDatamoonAudienceDedupeMatch(admin, normalized)
    if (dedupe) {
      duplicates += 1
      await updateDatamoonAudienceImportRecord(admin, record.id, {
        status: "duplicate",
        message: `Duplicate via ${dedupe.rule} at import.`,
      })
      continue
    }

    try {
      const companyName = resolveCompanyName(normalized)
      const lead = await createGrowthLead(admin, {
        sourceKind: "import",
        sourceDetail: `datamoon_audience:${run.id}:${record.recordIndex}`,
        externalRef: `datamoon:${run.datamoonAudienceId}:${record.recordIndex}`,
        companyName,
        contactName: normalized.contact_name,
        contactEmail: normalized.email,
        contactPhone: normalized.phone,
        website: normalized.company_domain ? `https://${normalized.company_domain}` : null,
        addressLine1: normalized.address_line1,
        city: normalized.city,
        state: normalized.state,
        postalCode: normalized.postal_code,
        country: normalized.country,
        status: "new",
        sourceChannel: "datamoon_audience",
        sourceVendor: "datamoon",
        createdBy: input.actor.userId,
        metadata: {
          datamoon: {
            run_id: run.id,
            audience_id: run.datamoonAudienceId,
            record_index: record.recordIndex,
            source: "datamoon",
            source_confidence: normalized.source_confidence,
            business_email: normalized.business_email,
            personal_emails: normalized.personal_emails,
            linkedin_url: normalized.linkedin_url,
          },
          import: {
            linkedin: normalized.linkedin_url,
          },
        },
      })

      await recomputeGrowthLeadWorkflowSignals(admin, lead.id)

      const intakePayload = buildDatamoonUnifiedIntakePayload({
        run,
        record,
        leadId: lead.id,
      })
      const workflowRun = await runUnifiedRevenueWorkflowAfterIntake({
        admin,
        actor: input.actor,
        ...intakePayload,
      })

      if (workflowRun.skipped) {
        const skipReason =
          typeof workflowRun.skipReason === "string" && workflowRun.skipReason.trim()
            ? workflowRun.skipReason.trim().slice(0, 200)
            : "workflow_skipped"
        unifiedIntakeWarnings.push({ record_id: record.id, skip_reason: skipReason })
        logGrowthEngine("datamoon_unified_intake_skipped", {
          runId,
          leadId: lead.id,
          recordId: record.id,
          skipReason,
        })
      }

      await updateDatamoonAudienceImportRecord(admin, record.id, {
        status: "imported",
        leadId: lead.id,
        message: formatDatamoonUnifiedIntakeRecordMessage({
          skipped: workflowRun.skipped,
          skipReason: workflowRun.skipReason,
        }),
      })
      imported += 1
      leadIds.push(lead.id)
    } catch (error) {
      errors += 1
      await updateDatamoonAudienceImportRecord(admin, record.id, {
        status: "error",
        message: error instanceof Error ? error.message : "Import failed.",
      })
    }
  }

  const remainingPreview = await listDatamoonAudienceImportRecords(admin, runId, { status: "preview" })
  const finalStatus = remainingPreview.length === 0 ? "imported" : "imported_partial"

  const providerMetadataPatch =
    unifiedIntakeWarnings.length > 0
      ? (sanitizeDatamoonProviderMetadata({
          ...run.providerMetadata,
          unified_intake_warnings: unifiedIntakeWarnings,
        }) as Record<string, unknown>)
      : undefined

  const updatedRun = await updateDatamoonAudienceImportRun(admin, runId, {
    status: finalStatus,
    importedCount: run.importedCount + imported,
    duplicateCount: run.duplicateCount + duplicates,
    skippedCount: run.skippedCount + skipped,
    errorCount: run.errorCount + errors,
    importedAt: new Date().toISOString(),
    ...(providerMetadataPatch ? { providerMetadata: providerMetadataPatch } : {}),
  })

  logGrowthEngine("datamoon_audience_import_committed", {
    runId,
    imported,
    duplicates,
    skipped,
    errors,
  })

  return {
    ok: true,
    run: updatedRun ?? run,
    imported,
    duplicates,
    skipped,
    errors,
    leadIds,
  }
}
