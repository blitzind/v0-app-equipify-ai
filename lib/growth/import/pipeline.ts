import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { appendGrowthImportBatchEvent } from "@/lib/growth/import/batch-events-repository"
import {
  fetchGrowthImportBatchById,
  fetchGrowthImportBatchRowByIndex,
  refreshGrowthImportBatchLeadOutcomes,
  replaceGrowthImportBatchRows,
  updateGrowthImportBatch,
  upsertGrowthImportBatchRowOutcome,
} from "@/lib/growth/import/batch-repository"
import { GROWTH_IMPORT_COMMIT_CHUNK_SIZE, GROWTH_IMPORT_PREVIEW_ROWS } from "@/lib/growth/import/constants"
import { inferBatchAutoTags } from "@/lib/growth/import/batch-tags"
import { computeContactabilityScore, isEstimatedCallReadyLead } from "@/lib/growth/import/contactability"
import { findImportDedupeMatch, proposeImportRowAction } from "@/lib/growth/import/dedupe"
import { suggestGrowthImportColumnMapping } from "@/lib/growth/import/map-columns"
import {
  buildCreateLeadInputFromImportRow,
  buildProtectedMergePatch,
} from "@/lib/growth/import/merge"
import { computeImportPipelineSummary } from "@/lib/growth/import/quality"
import { loadGrowthImportCsvFromStorage } from "@/lib/growth/import/storage"
import type {
  GrowthImportBatch,
  GrowthImportBatchOptions,
  GrowthImportColumnMapping,
  GrowthImportDuplicateStrategy,
  ImportPipelineSummary,
  ImportRowPreview,
  NormalizedImportRow,
} from "@/lib/growth/import/types"
import { getImportVendorAdapter } from "@/lib/growth/import/vendors/registry"
import { extractSeamlessTierBPayload } from "@/lib/growth/import/vendors/seamless-csv"
import { createGrowthLead, fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import {
  emitGrowthLeadImportCreatedTimeline,
  emitGrowthLeadImportUpdatedTimeline,
} from "@/lib/growth/timeline-emitter"

type Actor = { userId: string; email: string }

function resolveBatchAutoTags(batch: GrowthImportBatch): string[] {
  return batch.options.autoTags ?? inferBatchAutoTags(batch)
}

function buildPreviewStats(previews: ImportRowPreview[]) {
  const rows = previews.map((preview) => preview.normalized)
  const avgContactabilityScore =
    rows.length === 0
      ? 0
      : Math.round((previews.reduce((sum, preview) => sum + preview.contactabilityScore, 0) / previews.length) * 100) /
        100
  const estimatedCallReadyLeads = previews.filter((preview) => preview.estimatedCallReady).length
  return { avgContactabilityScore, estimatedCallReadyLeads }
}

export async function buildGrowthImportPreview(
  admin: SupabaseClient,
  batch: GrowthImportBatch,
  mapping: GrowthImportColumnMapping,
): Promise<{
  headers: string[]
  previews: ImportRowPreview[]
  validationSummary: Record<string, unknown>
}> {
  if (!batch.storagePath) throw new Error("missing_storage_path")
  const adapter = getImportVendorAdapter(batch.sourceVendor)
  const parsed = await loadGrowthImportCsvFromStorage(admin, batch.storagePath)

  const previews: ImportRowPreview[] = []
  let errorCount = 0
  let warningCount = 0

  for (let rowIndex = 0; rowIndex < parsed.rows.length; rowIndex++) {
    const raw = parsed.rows[rowIndex]!
    const normalized = adapter.normalizeRow(raw, mapping)
    const issues = adapter.validate(normalized)
    if (issues.some((i) => i.severity === "error")) errorCount++
    if (issues.some((i) => i.severity === "warning")) warningCount++
    const externalRef = adapter.externalRef(normalized, adapter.vendorKey())
    const dedupe = await findImportDedupeMatch(admin, {
      vendorKey: adapter.vendorKey(),
      row: normalized,
      externalRef,
    })
    const strategy = (batch.options.duplicateStrategy ?? "skip_high_confidence") as GrowthImportDuplicateStrategy
    const proposedAction = proposeImportRowAction(dedupe, strategy)
    const contactabilityScore = computeContactabilityScore(normalized)
    const hasError = issues.some((i) => i.severity === "error")
    previews.push({
      rowIndex,
      normalized,
      issues,
      dedupe,
      proposedAction,
      contactabilityScore,
      estimatedCallReady: isEstimatedCallReadyLead({ row: normalized, hasError, proposedAction }),
    })
  }

  const previewStats = buildPreviewStats(previews)

  return {
    headers: parsed.headers,
    previews,
    validationSummary: {
      rowCount: parsed.rows.length,
      errorCount,
      warningCount,
      headers: parsed.headers,
      ...previewStats,
      autoTags: resolveBatchAutoTags(batch),
    },
  }
}

export async function runGrowthImportDryRun(
  admin: SupabaseClient,
  batchId: string,
  mapping: GrowthImportColumnMapping,
  actor: Actor,
): Promise<{ batch: GrowthImportBatch; summary: ImportPipelineSummary; previews: ImportRowPreview[] }> {
  const batch = await fetchGrowthImportBatchById(admin, batchId)
  if (!batch) throw new Error("batch_not_found")
  if (batch.status === "cancelled") throw new Error("batch_cancelled")

  const { previews, validationSummary } = await buildGrowthImportPreview(admin, batch, mapping)
  const autoTags = resolveBatchAutoTags(batch)

  let imported = 0
  let updated = 0
  let skipped = 0
  let duplicate = 0
  let error = 0

  const rowRecords = previews.map((preview) => {
    const hasError = preview.issues.some((i) => i.severity === "error")
    let status: "validated" | "duplicate" | "skipped" | "error" = "validated"
    if (hasError) {
      status = "error"
      error++
    } else if (preview.proposedAction === "skip") {
      status = preview.dedupe ? "duplicate" : "skipped"
      if (preview.dedupe) duplicate++
      else skipped++
    } else if (preview.proposedAction === "merge") {
      status = "validated"
      updated++
    } else {
      status = "validated"
      imported++
    }

    return {
      rowIndex: preview.rowIndex,
      status,
      action: preview.proposedAction,
      matchedLeadId: preview.dedupe?.leadId ?? null,
      dedupeKey: preview.dedupe?.dedupeKey ?? null,
      dedupeConfidence: preview.dedupe?.confidence ?? null,
      sourcePayload: {} as Record<string, string>,
      normalizedPayload: preview.normalized,
      codes: preview.issues.map((i) => i.code),
      message: preview.issues.map((i) => i.message).join(" · ") || null,
    }
  })

  // attach source payloads
  const parsed = await loadGrowthImportCsvFromStorage(admin, batch.storagePath!)
  for (const record of rowRecords) {
    record.sourcePayload = parsed.rows[record.rowIndex] ?? {}
  }

  await replaceGrowthImportBatchRows(admin, batchId, rowRecords)

  const summary = computeImportPipelineSummary({
    rows: previews.map((p) => p.normalized),
    imported,
    updated,
    skipped,
    duplicate,
    error,
    previews,
  })

  const updatedBatch = await updateGrowthImportBatch(admin, batchId, {
    columnMapping: mapping,
    rowCount: previews.length,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: skipped,
    duplicateCount: duplicate,
    errorCount: error,
    emailFillPercent: summary.emailFillPercent,
    phoneFillPercent: summary.phoneFillPercent,
    websiteFillPercent: summary.websiteFillPercent,
    decisionMakerFillPercent: summary.decisionMakerFillPercent,
    importQualityScore: summary.importQualityScore,
    validationSummary,
    previewJson: {
      headers: parsed.headers,
      rows: parsed.rows.slice(0, GROWTH_IMPORT_PREVIEW_ROWS),
    },
    options: {
      ...batch.options,
      phase: "dry_run",
      duplicateStrategy: batch.options.duplicateStrategy ?? "skip_high_confidence",
      autoTags,
    },
    status: "partial",
  })

  await appendGrowthImportBatchEvent(admin, {
    batchId,
    eventType: "dry_run_completed",
    title: "Dry run completed",
    summary: `${imported} create · ${updated} merge · ${skipped + duplicate} skip · ${error} errors`,
    payload: summary,
    actorUserId: actor.userId,
    actorEmail: actor.email,
  })

  return { batch: updatedBatch!, summary, previews }
}

export async function runGrowthImportCommit(
  admin: SupabaseClient,
  batchId: string,
  input: {
    mapping: GrowthImportColumnMapping
    dryRun?: boolean
    actor: Actor
  },
): Promise<{ batch: GrowthImportBatch; summary: ImportPipelineSummary }> {
  const existing = await fetchGrowthImportBatchById(admin, batchId)
  if (!existing) throw new Error("batch_not_found")
  if (existing.status === "cancelled") throw new Error("batch_cancelled")
  if (!existing.storagePath) throw new Error("missing_storage_path")

  const dryRun = input.dryRun ?? false
  if (dryRun) {
    const result = await runGrowthImportDryRun(admin, batchId, input.mapping, input.actor)
    return { batch: result.batch, summary: result.summary }
  }

  await updateGrowthImportBatch(admin, batchId, {
    status: "running",
    startedAt: new Date().toISOString(),
    columnMapping: input.mapping,
  })

  await appendGrowthImportBatchEvent(admin, {
    batchId,
    eventType: "commit_started",
    title: "Import commit started",
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
  })

  const adapter = getImportVendorAdapter(existing.sourceVendor)
  const parsed = await loadGrowthImportCsvFromStorage(admin, existing.storagePath)
  const strategy = (existing.options.duplicateStrategy ?? "skip_high_confidence") as GrowthImportDuplicateStrategy
  const autoTags = resolveBatchAutoTags(existing)
  const isSeamless = existing.sourceVendor === "seamless"

  let imported = 0
  let updated = 0
  let skipped = 0
  let duplicate = 0
  let error = 0
  let estimatedCallReadyLeads = 0
  const normalizedRows: NormalizedImportRow[] = []
  const commitPreviews: ImportRowPreview[] = []

  try {
    for (let offset = 0; offset < parsed.rows.length; offset += GROWTH_IMPORT_COMMIT_CHUNK_SIZE) {
      const chunk = parsed.rows.slice(offset, offset + GROWTH_IMPORT_COMMIT_CHUNK_SIZE)
      for (let i = 0; i < chunk.length; i++) {
        const rowIndex = offset + i
        const prior = await fetchGrowthImportBatchRowByIndex(admin, batchId, rowIndex)

        if (prior && (prior.status === "imported" || prior.status === "updated")) {
          if (prior.status === "imported") imported++
          if (prior.status === "updated") updated++
          continue
        }

        const raw = chunk[i]!
        const normalized = adapter.normalizeRow(raw, input.mapping)
        normalizedRows.push(normalized)
        const issues = adapter.validate(normalized)
        const externalRef = adapter.externalRef(normalized, adapter.vendorKey())

        if (issues.some((issue) => issue.severity === "error")) {
          error++
          await upsertGrowthImportBatchRowOutcome(admin, batchId, {
            rowIndex,
            status: "error",
            action: "skip",
            sourcePayload: raw,
            normalizedPayload: normalized,
            codes: issues.map((issue) => issue.code),
            message: issues.map((issue) => issue.message).join(" · "),
          })
          continue
        }

        const dedupe = await findImportDedupeMatch(admin, {
          vendorKey: adapter.vendorKey(),
          row: normalized,
          externalRef,
        })
        const action = proposeImportRowAction(dedupe, strategy)
        const contactabilityScore = computeContactabilityScore(normalized)
        const seamlessTierB = isSeamless ? extractSeamlessTierBPayload(raw) : undefined
        const hasError = issues.some((issue) => issue.severity === "error")
        commitPreviews.push({
          rowIndex,
          normalized,
          issues,
          dedupe,
          proposedAction: action,
          contactabilityScore,
          estimatedCallReady: isEstimatedCallReadyLead({ row: normalized, hasError, proposedAction: action }),
        })

        if (action === "skip") {
          if (dedupe) duplicate++
          else skipped++
          await upsertGrowthImportBatchRowOutcome(admin, batchId, {
            rowIndex,
            status: dedupe ? "duplicate" : "skipped",
            action: "skip",
            matchedLeadId: dedupe?.leadId ?? null,
            dedupeKey: dedupe?.dedupeKey ?? null,
            dedupeConfidence: dedupe?.confidence ?? null,
            sourcePayload: raw,
            normalizedPayload: normalized,
            codes: dedupe ? ["duplicate_match"] : ["skipped"],
            message: dedupe ? `Duplicate via ${dedupe.rule}` : "Skipped by strategy",
          })
          continue
        }

        if (action === "merge" && dedupe) {
          const existingLead = await fetchGrowthLeadById(admin, dedupe.leadId)
          if (!existingLead) {
            error++
            await upsertGrowthImportBatchRowOutcome(admin, batchId, {
              rowIndex,
              status: "error",
              action: "merge",
              sourcePayload: raw,
              normalizedPayload: normalized,
              codes: ["merge_target_missing"],
              message: "Matched lead no longer exists.",
            })
            continue
          }

          const patch = buildProtectedMergePatch(existingLead, normalized, {
            sourceChannel: existing.sourceChannel,
            sourceCampaign: existing.sourceCampaign,
            sourceVendor: existing.sourceVendor,
            sourceImportBatchId: batchId,
            externalRef,
            rowIndex,
            autoTags,
            contactabilityScore,
            seamlessTierB,
          })

          const lead = await updateGrowthLeadFromImportMerge(admin, dedupe.leadId, patch)
          if (!lead) {
            error++
            continue
          }

          await emitGrowthLeadImportUpdatedTimeline(admin, {
            leadId: lead.id,
            batchId,
            rowIndex,
            actor: input.actor,
          })
          await recomputeGrowthLeadWorkflowSignals(admin, lead.id)
          updated++
          if (isEstimatedCallReadyLead({ row: normalized, hasError: false, proposedAction: "merge" })) {
            estimatedCallReadyLeads++
          }

          await upsertGrowthImportBatchRowOutcome(admin, batchId, {
            rowIndex,
            status: "updated",
            action: "merge",
            leadId: lead.id,
            matchedLeadId: dedupe.leadId,
            dedupeKey: dedupe.dedupeKey,
            dedupeConfidence: dedupe.confidence,
            sourcePayload: raw,
            normalizedPayload: normalized,
            codes: ["merged"],
            message: `Merged via ${dedupe.rule}`,
          })
          continue
        }

        const lead = await createGrowthLead(
          admin,
          buildCreateLeadInputFromImportRow(normalized, {
            sourceChannel: existing.sourceChannel,
            sourceCampaign: existing.sourceCampaign,
            sourceVendor: existing.sourceVendor,
            sourceImportBatchId: batchId,
            externalRef,
            rowIndex,
            createdBy: input.actor.userId,
            autoTags,
            contactabilityScore,
            seamlessTierB,
          }),
        )

        await emitGrowthLeadImportCreatedTimeline(admin, {
          leadId: lead.id,
          batchId,
          rowIndex,
          companyName: lead.companyName,
          actor: input.actor,
        })
        const { recordAttributionTouch } = await import("@/lib/growth/revenue-attribution/record-attribution-touch")
        await recordAttributionTouch(admin, {
          touchType: "lead_import",
          leadId: lead.id,
          repUserId: input.actor.userId,
          attributionSource: "import_pipeline",
          attributionConfidence: 1,
          metadata: {
            batch_id: batchId,
            source_channel: existing.sourceChannel,
            source_campaign: existing.sourceCampaign,
            source_vendor: existing.sourceVendor,
            row_index: rowIndex,
          },
        }).catch(() => undefined)
        await recomputeGrowthLeadWorkflowSignals(admin, lead.id)
        imported++
        if (isEstimatedCallReadyLead({ row: normalized, hasError: false, proposedAction: "create_new" })) {
          estimatedCallReadyLeads++
        }

        await upsertGrowthImportBatchRowOutcome(admin, batchId, {
          rowIndex,
          status: "imported",
          action: "create_new",
          leadId: lead.id,
          sourcePayload: raw,
          normalizedPayload: normalized,
          codes: ["imported"],
          message: "Lead created",
        })
      }
    }

    const summary = computeImportPipelineSummary({
      rows: normalizedRows.length ? normalizedRows : parsed.rows.map((raw) => adapter.normalizeRow(raw, input.mapping)),
      imported,
      updated,
      skipped,
      duplicate,
      error,
      previews: commitPreviews,
      estimatedCallReadyLeads,
    })

    const finalStatus = error > 0 && imported + updated === 0 ? "failed" : error > 0 ? "partial" : "completed"

    let batch = await updateGrowthImportBatch(admin, batchId, {
      rowCount: parsed.rows.length,
      importedCount: imported,
      updatedCount: updated,
      skippedCount: skipped,
      duplicateCount: duplicate,
      errorCount: error,
      emailFillPercent: summary.emailFillPercent,
      phoneFillPercent: summary.phoneFillPercent,
      websiteFillPercent: summary.websiteFillPercent,
      decisionMakerFillPercent: summary.decisionMakerFillPercent,
      importQualityScore: summary.importQualityScore,
      status: finalStatus,
      finishedAt: new Date().toISOString(),
      options: { ...existing.options, phase: "committed" },
      validationSummary: {
        ...(existing.validationSummary ?? {}),
        avgContactabilityScore: summary.avgContactabilityScore,
        estimatedCallReadyLeads: summary.estimatedCallReadyLeads,
        autoTags,
        commitSummary: summary,
      },
    })

    batch = (await refreshGrowthImportBatchLeadOutcomes(admin, batchId)) ?? batch

    await appendGrowthImportBatchEvent(admin, {
      batchId,
      eventType: finalStatus === "failed" ? "commit_failed" : "commit_completed",
      title: finalStatus === "failed" ? "Import commit failed" : "Import commit completed",
      summary: `${imported} imported · ${updated} updated · ${duplicate} duplicates · ${error} errors`,
      payload: summary,
      actorUserId: input.actor.userId,
      actorEmail: input.actor.email,
    })

    logGrowthEngine("import_batch_commit_completed", { batchId, imported, updated, error, finalStatus })
    return { batch: batch!, summary }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await updateGrowthImportBatch(admin, batchId, {
      status: "failed",
      errorMessage: message,
      finishedAt: new Date().toISOString(),
    })
    await appendGrowthImportBatchEvent(admin, {
      batchId,
      eventType: "commit_failed",
      title: "Import commit failed",
      summary: message,
      actorUserId: input.actor.userId,
      actorEmail: input.actor.email,
    })
    throw e
  }
}

export async function initializeGrowthImportBatchFromUpload(
  admin: SupabaseClient,
  batch: GrowthImportBatch,
  mapping?: GrowthImportColumnMapping,
): Promise<{ batch: GrowthImportBatch; suggestedMapping: GrowthImportColumnMapping; headers: string[] }> {
  if (!batch.storagePath) throw new Error("missing_storage_path")
  const parsed = await loadGrowthImportCsvFromStorage(admin, batch.storagePath)
  const adapter = getImportVendorAdapter(batch.sourceVendor)
  const suggestedMapping = mapping ?? suggestGrowthImportColumnMapping(parsed.headers, adapter)

  const autoTags = resolveBatchAutoTags(batch)
  const updated = await updateGrowthImportBatch(admin, batch.id, {
    rowCount: parsed.rows.length,
    columnMapping: suggestedMapping,
    previewJson: {
      headers: parsed.headers,
      rows: parsed.rows.slice(0, GROWTH_IMPORT_PREVIEW_ROWS),
    },
    options: { ...batch.options, phase: "uploaded", autoTags },
    status: "partial",
  })

  return { batch: updated!, suggestedMapping, headers: parsed.headers }
}
