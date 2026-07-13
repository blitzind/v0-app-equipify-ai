/**
 * GE-AIOS-CONTACT-1B — Live DataMoon decision-maker discovery adapter.
 * Reuses buildAudience / fetchAudience — no parallel provider client.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  buildDatamoonDmDiscoveryCriteriaFingerprint,
  createDatamoonDmDiscoveryRun,
  fetchDatamoonDmDiscoveryRunById,
  findDatamoonDmDiscoveryRunByIdempotencyKey,
  patchDatamoonDmDiscoveryRun,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-durable-store"
import {
  DATAMOON_DM_DISCOVERY_POLL_POLICY,
  GROWTH_AIOS_CONTACT_1B_QA_MARKER,
  type DatamoonDecisionMakerDiscoveryAdapter,
  type DatamoonDmDiscoveryAdapterResult,
  type DatamoonDmDiscoveryRequestInput,
  type DatamoonDmDiscoveryRequestResult,
  type DatamoonDmDiscoveryResults,
  type DatamoonDmDiscoveryStatusResult,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-types"
import {
  classifyDatamoonDmFailureDiagnostic,
  GROWTH_AIOS_CONTACT_1E_QA_MARKER,
  isDatamoonDmDiscoveryFailureTerminal,
  resolveDatamoonDmPollExhaustionFailureCode,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-failure-classification"
import { resolveDatamoonBuildAudienceId } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-build-id"
import { resolveDatamoonFetchPayload } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-fetch-payload"
import { resolveDatamoonProviderFiltersForImport } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import {
  buildAudience,
  fetchAudience,
  diagnoseDatamoonProvider,
} from "@/lib/growth/providers/datamoon/datamoon-client"
import {
  isDatamoonDryRunOnly,
  isDatamoonProviderConfigured,
  isDatamoonProviderEnabled,
  resolveDatamoonAudienceMode,
} from "@/lib/growth/providers/datamoon/datamoon-config"
import type { DatamoonFetchImpl } from "@/lib/growth/providers/datamoon/datamoon-http"
import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon/datamoon-types"

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString()
}

function computeBackoffMs(pollAttemptCount: number): number {
  const base = DATAMOON_DM_DISCOVERY_POLL_POLICY.temporaryBackoffMs
  const exp = Math.min(
    DATAMOON_DM_DISCOVERY_POLL_POLICY.maxBackoffMs,
    base * Math.max(1, 2 ** Math.min(pollAttemptCount, 6)),
  )
  return Math.max(DATAMOON_DM_DISCOVERY_POLL_POLICY.minPollIntervalMs, exp)
}

function toProviderFilters(
  filters: Array<{ field: string; operator: string; value: string | string[] }>,
): DatamoonAudienceFilter[] {
  return filters.map((filter) => ({
    field: filter.field,
    operator: filter.operator,
    value: filter.value,
  }))
}

export type LiveDatamoonDmDiscoveryAdapterOptions = {
  admin: SupabaseClient
  env?: NodeJS.ProcessEnv
  fetchImpl?: DatamoonFetchImpl
}

export function createLiveDatamoonDecisionMakerDiscoveryAdapter(
  options: LiveDatamoonDmDiscoveryAdapterOptions,
): DatamoonDecisionMakerDiscoveryAdapter {
  const env = options.env ?? process.env

  return {
    async requestDiscovery(input: DatamoonDmDiscoveryRequestInput): Promise<DatamoonDmDiscoveryRequestResult> {
      const now = new Date().toISOString()

      if (!isDatamoonProviderEnabled(env)) {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: null,
          audienceId: null,
          providerCalled: false,
          reusedExisting: false,
          nextPollAt: null,
          message: "DataMoon provider disabled — fail closed.",
          failureCode: "provider_disabled",
        }
      }
      if (!isDatamoonProviderConfigured(env)) {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: null,
          audienceId: null,
          providerCalled: false,
          reusedExisting: false,
          nextPollAt: null,
          message: "DataMoon provider not configured — fail closed.",
          failureCode: "provider_not_configured",
        }
      }

      const existing = await findDatamoonDmDiscoveryRunByIdempotencyKey(options.admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        idempotencyKey: input.idempotencyKey,
      })
      if (existing && (existing.status === "polling" || existing.status === "requested")) {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: existing.status === "requested" ? "requested" : "polling",
          runId: existing.runId,
          audienceId: existing.audienceId,
          providerCalled: false,
          reusedExisting: true,
          nextPollAt: existing.nextPollAt,
          message: "Reused in-flight equivalent DataMoon DM discovery request.",
          failureCode: null,
        }
      }
      if (existing && existing.status === "completed") {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "duplicate_noop",
          runId: existing.runId,
          audienceId: existing.audienceId,
          providerCalled: false,
          reusedExisting: true,
          nextPollAt: null,
          message: "Equivalent completed DataMoon DM discovery already exists.",
          failureCode: null,
        }
      }
      // CONTACT-1E — do not recreate after terminal auth failure unless retry_eligible.
      if (
        existing?.status === "failed_terminal" &&
        isDatamoonDmDiscoveryFailureTerminal(existing.firstFailureCode ?? existing.failureCode) &&
        !existing.retryEligible
      ) {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: existing.runId,
          audienceId: existing.audienceId,
          providerCalled: false,
          reusedExisting: true,
          nextPollAt: null,
          message:
            existing.failureCode ??
            "Terminal DataMoon failure — set retry_eligible after configuration correction.",
          failureCode: existing.firstFailureCode ?? existing.failureCode,
        }
      }

      const criteriaFingerprint = buildDatamoonDmDiscoveryCriteriaFingerprint({
        organizationId: input.organizationId,
        leadId: input.leadId,
        companyName: input.companyName,
        companyDomain: input.companyDomain,
        titleFamilies: input.titleFamilies,
        geography: input.geography,
      })

      const providerMode = resolveDatamoonAudienceMode(env)
      const dryRun = isDatamoonDryRunOnly(env)
      const nextPollAt = addMs(now, DATAMOON_DM_DISCOVERY_POLL_POLICY.minPollIntervalMs)
      const filters = toProviderFilters(input.filters)

      const durable = await createDatamoonDmDiscoveryRun(options.admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        companyId: input.companyId,
        companyName: input.companyName,
        idempotencyKey: input.idempotencyKey,
        criteriaFingerprint,
        filters,
        titleFamilies: input.titleFamilies,
        providerMode,
        dryRun,
        now,
        nextPollAt,
      })

      if (!durable) {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_retryable",
          runId: null,
          audienceId: null,
          providerCalled: false,
          reusedExisting: false,
          nextPollAt: null,
          message: "Failed to persist DataMoon DM discovery run.",
          failureCode: "run_create_failed",
        }
      }

      const providerFilters = resolveDatamoonProviderFiltersForImport({
        filters,
      })

      const build = await buildAudience(
        {
          type: "advanced_search",
          filters: providerFilters,
          name: `dm-discovery:${input.leadId}`,
          record_limit: DATAMOON_DM_DISCOVERY_POLL_POLICY.maxRecordsFetched,
        },
        { env, audienceMode: providerMode, fetchImpl: options.fetchImpl },
      )

      if (build.status === "skipped" || build.status === "failed") {
        const failureCode = build.error_category ?? "build_failed"
        const terminal = isDatamoonDmDiscoveryFailureTerminal(failureCode)
        const diagnostics = diagnoseDatamoonProvider(env)
        const classified = classifyDatamoonDmFailureDiagnostic({
          failureCode,
          httpStatus: build.http_status,
          audienceMode: providerMode,
          audienceExtKeyPresent: diagnostics.audience_ext_key_present,
          audienceModuleKeyPresent: diagnostics.audience_module_key_present,
          providerEnabled: diagnostics.enabled,
        })
        await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
          status: "failed",
          lifecycleStatus: terminal ? "failed_terminal" : "failed_retryable",
          failureCode,
          failureClass: terminal ? "terminal" : "retryable",
          firstFailureCode: failureCode,
          nextPollAt: terminal ? null : addMs(now, computeBackoffMs(1)),
          retryEligible: false,
          extraMetadata: {
            contact_1e_qa_marker: GROWTH_AIOS_CONTACT_1E_QA_MARKER,
            failure_diagnostic: classified.diagnostic,
            failure_diagnostic_message: classified.message,
            http_status: build.http_status,
            operation: "audience_build",
            audience_mode: providerMode,
          },
        })
        logGrowthEngine("datamoon_dm_discovery_build_failed", {
          qa_marker: GROWTH_AIOS_CONTACT_1E_QA_MARKER,
          organization_id: input.organizationId,
          lead_id: input.leadId,
          run_id: durable.runId,
          failure_code: failureCode,
          terminal,
          diagnostic: classified.diagnostic,
          audience_mode: providerMode,
          http_status: build.http_status,
        })
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: terminal ? "failed_terminal" : "failed_retryable",
          runId: durable.runId,
          audienceId: null,
          providerCalled: true,
          reusedExisting: false,
          nextPollAt: terminal ? null : addMs(now, computeBackoffMs(1)),
          message: classified.message || build.message,
          failureCode,
        }
      }

      const { audienceId, missingProviderAudienceId } = resolveDatamoonBuildAudienceId({
        buildStatus: build.status,
        data: build.data,
      })

      if (missingProviderAudienceId || !audienceId) {
        await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
          status: "failed",
          lifecycleStatus: "failed_terminal",
          failureCode: "missing_provider_audience_id",
          failureClass: "terminal",
          nextPollAt: null,
        })
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: durable.runId,
          audienceId: null,
          providerCalled: true,
          reusedExisting: false,
          nextPollAt: null,
          message: "DataMoon build missing provider audience id.",
          failureCode: "missing_provider_audience_id",
        }
      }

      await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
        audienceId,
        status: "building",
        lifecycleStatus: "polling",
        nextPollAt,
        extraMetadata: {
          build_status: build.status,
          dry_run: build.dry_run,
        },
      })

      logGrowthEngine("datamoon_dm_discovery_requested", {
        qa_marker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
        organization_id: input.organizationId,
        lead_id: input.leadId,
        run_id: durable.runId,
        audience_id: audienceId,
      })

      return {
        qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
        status: "requested",
        runId: durable.runId,
        audienceId,
        providerCalled: true,
        reusedExisting: false,
        nextPollAt,
        message: "DataMoon DM audience build started — polling asynchronously.",
        failureCode: null,
      }
    },

    async getDiscoveryStatus(input: {
      runId: string
      now?: string
    }): Promise<DatamoonDmDiscoveryStatusResult> {
      const now = input.now ?? new Date().toISOString()
      const durable = await fetchDatamoonDmDiscoveryRunById(options.admin, input.runId)
      if (!durable) {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: input.runId,
          audienceId: null,
          pollAttemptCount: 0,
          nextPollAt: null,
          resultCount: null,
          message: "Discovery run not found.",
          failureCode: "run_not_found",
          readyForFetch: false,
        }
      }

      if (durable.status === "completed") {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "completed",
          runId: durable.runId,
          audienceId: durable.audienceId,
          pollAttemptCount: durable.pollAttemptCount,
          nextPollAt: null,
          resultCount: durable.resultCount,
          message: "Discovery completed.",
          failureCode: null,
          readyForFetch: true,
        }
      }

      if (durable.status === "failed_terminal" || durable.status === "no_result") {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: durable.status,
          runId: durable.runId,
          audienceId: durable.audienceId,
          pollAttemptCount: durable.pollAttemptCount,
          nextPollAt: null,
          resultCount: durable.resultCount,
          message: durable.failureCode ?? "Discovery terminal.",
          failureCode: durable.failureCode,
          readyForFetch: false,
        }
      }

      // CONTACT-1E — auth/config failed_retryable must upgrade to terminal; never poll.
      if (
        durable.status === "failed_retryable" &&
        isDatamoonDmDiscoveryFailureTerminal(durable.failureCode ?? durable.firstFailureCode)
      ) {
        const primary = durable.firstFailureCode ?? durable.failureCode ?? "forbidden"
        const diagnostics = diagnoseDatamoonProvider(env)
        const classified = classifyDatamoonDmFailureDiagnostic({
          failureCode: primary,
          firstFailureCode: durable.firstFailureCode,
          audienceId: durable.audienceId,
          audienceMode: durable.providerMode,
          audienceExtKeyPresent: diagnostics.audience_ext_key_present,
          audienceModuleKeyPresent: diagnostics.audience_module_key_present,
          providerEnabled: diagnostics.enabled,
        })
        await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
          status: "failed",
          lifecycleStatus: "failed_terminal",
          failureCode: classified.primaryFailureCode,
          failureClass: "terminal",
          firstFailureCode: durable.firstFailureCode ?? primary,
          nextPollAt: null,
          retryEligible: false,
          extraMetadata: {
            contact_1e_qa_marker: GROWTH_AIOS_CONTACT_1E_QA_MARKER,
            failure_diagnostic: classified.diagnostic,
            failure_diagnostic_message: classified.message,
            promoted_from: "failed_retryable",
          },
        })
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: durable.runId,
          audienceId: durable.audienceId,
          pollAttemptCount: durable.pollAttemptCount,
          nextPollAt: null,
          resultCount: durable.resultCount,
          message: classified.message,
          failureCode: classified.primaryFailureCode,
          readyForFetch: false,
        }
      }

      const requestedAge = Date.parse(now) - Date.parse(durable.requestedAt)
      if (requestedAge > DATAMOON_DM_DISCOVERY_POLL_POLICY.maxProviderAgeMs) {
        await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
          status: "failed",
          lifecycleStatus: "failed_terminal",
          failureCode: "provider_stale",
          failureClass: "terminal",
          nextPollAt: null,
        })
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: durable.runId,
          audienceId: durable.audienceId,
          pollAttemptCount: durable.pollAttemptCount,
          nextPollAt: null,
          resultCount: null,
          message: "Provider run exceeded max age — terminal.",
          failureCode: "provider_stale",
          readyForFetch: false,
        }
      }

      // CONTACT-1E — never burn poll budget without a valid audience/build ID.
      // Allow a short in-flight grace while requestDiscovery is still building.
      if (!durable.audienceId) {
        const ageMs = Date.parse(now) - Date.parse(durable.requestedAt)
        const priorTerminal = isDatamoonDmDiscoveryFailureTerminal(
          durable.firstFailureCode ?? durable.failureCode,
        )
        const buildStillInFlight =
          !priorTerminal &&
          !durable.failureCode &&
          ageMs < 120_000 &&
          (durable.status === "requested" || durable.status === "polling")

        if (buildStillInFlight) {
          const nextPollAt = addMs(now, DATAMOON_DM_DISCOVERY_POLL_POLICY.minPollIntervalMs)
          await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
            lastPollAt: now,
            nextPollAt,
            // Do not increment pollAttemptCount — no provider poll occurred.
            lifecycleStatus: "requested",
          })
          return {
            qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
            status: "requested",
            runId: durable.runId,
            audienceId: null,
            pollAttemptCount: durable.pollAttemptCount,
            nextPollAt,
            resultCount: null,
            message: "Build in flight — waiting for provider audience ID (no poll count).",
            failureCode: null,
            readyForFetch: false,
          }
        }

        const failureCode =
          priorTerminal && durable.firstFailureCode
            ? durable.firstFailureCode
            : durable.failureCode && isDatamoonDmDiscoveryFailureTerminal(durable.failureCode)
              ? durable.failureCode
              : "missing_provider_audience_id"
        await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
          status: "failed",
          lifecycleStatus: "failed_terminal",
          failureCode,
          failureClass: "terminal",
          firstFailureCode: durable.firstFailureCode ?? failureCode,
          lastPollAt: now,
          nextPollAt: null,
          retryEligible: false,
          extraMetadata: {
            contact_1e_qa_marker: GROWTH_AIOS_CONTACT_1E_QA_MARKER,
            failure_diagnostic: "missing_provider_audience_id",
            failure_diagnostic_message:
              "No provider audience ID after build window — polling must not continue (CONTACT-1E).",
            operation: "poll_without_audience_id",
          },
        })
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: durable.runId,
          audienceId: null,
          pollAttemptCount: durable.pollAttemptCount,
          nextPollAt: null,
          resultCount: null,
          message: "No provider audience ID — polling forbidden.",
          failureCode,
          readyForFetch: false,
        }
      }

      if (durable.pollAttemptCount >= DATAMOON_DM_DISCOVERY_POLL_POLICY.maxPollsPerRun) {
        const preserved = resolveDatamoonDmPollExhaustionFailureCode({
          firstFailureCode: durable.firstFailureCode,
          priorFailureCode: durable.failureCode,
        })
        await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
          status: "failed",
          lifecycleStatus: "failed_terminal",
          failureCode: preserved,
          failureClass: "terminal",
          nextPollAt: null,
          extraMetadata: {
            contact_1e_qa_marker: GROWTH_AIOS_CONTACT_1E_QA_MARKER,
            poll_budget_exhausted: true,
            reported_max_polls: preserved === "max_polls_exceeded",
            preserved_primary_failure: preserved !== "max_polls_exceeded" ? preserved : null,
          },
        })
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: durable.runId,
          audienceId: durable.audienceId,
          pollAttemptCount: durable.pollAttemptCount,
          nextPollAt: null,
          resultCount: null,
          message:
            preserved === "max_polls_exceeded"
              ? "Maximum polls exceeded — terminal."
              : `Poll budget exhausted; primary failure preserved: ${preserved}.`,
          failureCode: preserved,
          readyForFetch: false,
        }
      }

      const fetchResult = await fetchAudience(durable.audienceId, {
        env,
        audienceMode: durable.providerMode,
        fetchImpl: options.fetchImpl,
      })

      const pollAttemptCount = durable.pollAttemptCount + 1

      if (fetchResult.status === "skipped" || fetchResult.status === "failed") {
        const rawCode = fetchResult.error_category ?? "poll_failed"
        const failureCode =
          rawCode === "forbidden" || rawCode === "unauthorized" ? "fetch_forbidden" : rawCode
        const terminal = isDatamoonDmDiscoveryFailureTerminal(failureCode) ||
          isDatamoonDmDiscoveryFailureTerminal(rawCode)
        const persistCode = terminal && (rawCode === "forbidden" || rawCode === "unauthorized")
          ? "fetch_forbidden"
          : rawCode
        const diagnostics = diagnoseDatamoonProvider(env)
        const classified = classifyDatamoonDmFailureDiagnostic({
          failureCode: persistCode,
          firstFailureCode: durable.firstFailureCode,
          httpStatus: fetchResult.http_status,
          audienceId: durable.audienceId,
          audienceMode: durable.providerMode,
          audienceExtKeyPresent: diagnostics.audience_ext_key_present,
          audienceModuleKeyPresent: diagnostics.audience_module_key_present,
          providerEnabled: diagnostics.enabled,
        })
        const nextPollAt = terminal ? null : addMs(now, computeBackoffMs(pollAttemptCount))
        await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
          status: terminal ? "failed" : "building",
          lifecycleStatus: terminal ? "failed_terminal" : "failed_retryable",
          failureCode: persistCode,
          failureClass: terminal ? "terminal" : "retryable",
          firstFailureCode: durable.firstFailureCode ?? persistCode,
          lastPollAt: now,
          nextPollAt,
          pollAttemptCount,
          retryEligible: false,
          extraMetadata: {
            contact_1e_qa_marker: GROWTH_AIOS_CONTACT_1E_QA_MARKER,
            failure_diagnostic: classified.diagnostic,
            failure_diagnostic_message: classified.message,
            http_status: fetchResult.http_status,
            operation: "audience_fetch",
          },
        })
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: terminal ? "failed_terminal" : "failed_retryable",
          runId: durable.runId,
          audienceId: durable.audienceId,
          pollAttemptCount,
          nextPollAt,
          resultCount: null,
          message: classified.message || fetchResult.message,
          failureCode: persistCode,
          readyForFetch: false,
        }
      }

      const payload = resolveDatamoonFetchPayload(fetchResult.data)
      const providerStatus = payload.providerStatus
      const resultCount = payload.records.length

      if (providerStatus !== "completed" && fetchResult.status !== "dry_run") {
        const nextPollAt = addMs(now, computeBackoffMs(pollAttemptCount))
        await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
          status: "building",
          lifecycleStatus: "polling",
          lastPollAt: now,
          nextPollAt,
          pollAttemptCount,
          resultCount,
        })
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "polling",
          runId: durable.runId,
          audienceId: durable.audienceId,
          pollAttemptCount,
          nextPollAt,
          resultCount,
          message: `Provider status ${providerStatus ?? "in_progress"} — continue polling.`,
          failureCode: null,
          readyForFetch: false,
        }
      }

      await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
        status: "completed",
        lifecycleStatus: resultCount === 0 ? "no_result" : "completed",
        lastPollAt: now,
        nextPollAt: null,
        pollAttemptCount,
        resultCount,
        noResultAt: resultCount === 0 ? now : null,
        extraMetadata: {
          provider_status: providerStatus ?? "completed",
          raw_records_cached: true,
        },
      })

      // Cache raw records in metadata for fetchDiscoveryResults (bounded).
      await patchDatamoonDmDiscoveryRun(options.admin, durable.runId, {
        extraMetadata: {
          cached_records: payload.records.slice(
            0,
            DATAMOON_DM_DISCOVERY_POLL_POLICY.maxRecordsFetched,
          ),
        },
      })

      return {
        qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
        status: resultCount === 0 ? "no_result" : "completed",
        runId: durable.runId,
        audienceId: durable.audienceId,
        pollAttemptCount,
        nextPollAt: null,
        resultCount,
        message:
          resultCount === 0
            ? "DataMoon audience completed with no records."
            : `DataMoon audience completed with ${resultCount} records.`,
        failureCode: resultCount === 0 ? "no_result" : null,
        readyForFetch: resultCount > 0,
      }
    },

    async fetchDiscoveryResults(input: {
      runId: string
    }): Promise<DatamoonDmDiscoveryResults> {
      const durable = await fetchDatamoonDmDiscoveryRunById(options.admin, input.runId)
      if (!durable) {
        return {
          qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          status: "failed_terminal",
          runId: input.runId,
          audienceId: null,
          records: [],
          message: "Discovery run not found.",
          failureCode: "run_not_found",
        }
      }

      const runMeta = await options.admin
        .schema("growth")
        .from("datamoon_audience_import_runs")
        .select("provider_metadata")
        .eq("id", input.runId)
        .maybeSingle()

      const meta =
        runMeta.data && typeof (runMeta.data as { provider_metadata?: unknown }).provider_metadata === "object"
          ? ((runMeta.data as { provider_metadata: Record<string, unknown> }).provider_metadata ?? {})
          : {}

      let records: unknown[] = Array.isArray(meta.cached_records) ? (meta.cached_records as unknown[]) : []

      if (records.length === 0 && durable.audienceId) {
        const fetchResult = await fetchAudience(durable.audienceId, {
          env,
          audienceMode: durable.providerMode,
          fetchImpl: options.fetchImpl,
        })
        if (fetchResult.status === "success" || fetchResult.status === "dry_run") {
          records = resolveDatamoonFetchPayload(fetchResult.data).records.slice(
            0,
            DATAMOON_DM_DISCOVERY_POLL_POLICY.maxRecordsFetched,
          )
        }
      }

      return {
        qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
        status: durable.status === "no_result" ? "no_result" : "completed",
        runId: durable.runId,
        audienceId: durable.audienceId,
        records,
        message: `Fetched ${records.length} DataMoon person records.`,
        failureCode: null,
      }
    },
  }
}

/**
 * Bridge live multi-step adapter into the SV1-4 single-shot discovery function.
 * One invocation: reuse / request / poll-once / fetch — never blocks indefinitely.
 */
export function createLegacyDatamoonDmDiscoveryAdapterBridge(
  adapter: DatamoonDecisionMakerDiscoveryAdapter,
  options: {
    admin: SupabaseClient
    adapterKind?: "live" | "injected"
  },
): (input: {
  organizationId: string
  leadId: string
  companyName: string | null
  companyDomain: string | null
  titleFamilies: string[]
  filters: Array<{ field: string; operator: string; value: string | string[] }>
  idempotencyKey?: string
  companyId?: string | null
}) => Promise<DatamoonDmDiscoveryAdapterResult> {
  return async (input) => {
    const idempotencyKey =
      input.idempotencyKey ??
      `dm-datamoon:${input.organizationId}:${input.leadId}:${(input.companyDomain || input.companyName || "unknown").toLowerCase()}`

    const existing = await findDatamoonDmDiscoveryRunByIdempotencyKey(options.admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      idempotencyKey,
    })

    if (existing?.status === "completed" || existing?.status === "no_result") {
      const fetched = await adapter.fetchDiscoveryResults({ runId: existing.runId })
      return {
        records: fetched.records,
        providerCalled: false,
        message: fetched.message,
        status: fetched.records.length > 0 ? "reused" : "completed",
        runId: existing.runId,
        audienceId: existing.audienceId,
        nextPollAt: null,
        creditsAvoided: true,
        adapterKind: options.adapterKind ?? "live",
      }
    }

    // CONTACT-1E — terminal auth/config failures do not auto-recreate unless retry_eligible.
    if (existing?.status === "failed_terminal") {
      const authTerminal = isDatamoonDmDiscoveryFailureTerminal(
        existing.firstFailureCode ?? existing.failureCode,
      )
      if (authTerminal && !existing.retryEligible) {
        return {
          records: [],
          providerCalled: false,
          message:
            existing.failureCode ??
            "DataMoon DM discovery terminally failed — await configuration correction + retry_eligible.",
          status: "failed_terminal",
          runId: existing.runId,
          audienceId: existing.audienceId,
          nextPollAt: null,
          failureCode: existing.firstFailureCode ?? existing.failureCode,
          creditsAvoided: true,
          adapterKind: options.adapterKind ?? "live",
        }
      }
      // retry_eligible or non-auth terminal: fall through to create a superseding run.
    }

    if (existing && (existing.status === "polling" || existing.status === "requested" || existing.status === "failed_retryable")) {
      const status = await adapter.getDiscoveryStatus({ runId: existing.runId })
      if (status.status === "failed_terminal") {
        return {
          records: [],
          providerCalled: true,
          message: status.message,
          status: "failed_terminal",
          runId: existing.runId,
          audienceId: existing.audienceId,
          nextPollAt: null,
          failureCode: status.failureCode,
          creditsAvoided: true,
          adapterKind: options.adapterKind ?? "live",
        }
      }
      if (status.readyForFetch || status.status === "completed" || status.status === "no_result") {
        const fetched = await adapter.fetchDiscoveryResults({ runId: existing.runId })
        return {
          records: fetched.records,
          providerCalled: true,
          message: fetched.message,
          status: "completed",
          runId: existing.runId,
          audienceId: existing.audienceId,
          nextPollAt: null,
          failureCode: status.failureCode,
          adapterKind: options.adapterKind ?? "live",
        }
      }
      return {
        records: [],
        providerCalled: true,
        message: status.message,
        status: status.status === "failed_retryable" ? "failed_retryable" : "pending",
        runId: existing.runId,
        audienceId: existing.audienceId,
        nextPollAt: status.nextPollAt,
        failureCode: status.failureCode,
        creditsAvoided: true,
        adapterKind: options.adapterKind ?? "live",
      }
    }

    const requested = await adapter.requestDiscovery({
      organizationId: input.organizationId,
      leadId: input.leadId,
      companyId: input.companyId,
      companyName: input.companyName,
      companyDomain: input.companyDomain,
      titleFamilies: input.titleFamilies,
      filters: input.filters,
      idempotencyKey,
    })

    if (requested.reusedExisting && requested.runId) {
      const status = await adapter.getDiscoveryStatus({ runId: requested.runId })
      if (status.readyForFetch) {
        const fetched = await adapter.fetchDiscoveryResults({ runId: requested.runId })
        return {
          records: fetched.records,
          providerCalled: false,
          message: fetched.message,
          status: "reused",
          runId: requested.runId,
          audienceId: requested.audienceId,
          creditsAvoided: true,
          adapterKind: options.adapterKind ?? "live",
        }
      }
    }

    // Dry-run / immediate-complete builds: poll once after request.
    if (requested.runId && requested.status === "requested") {
      const status = await adapter.getDiscoveryStatus({ runId: requested.runId })
      if (status.readyForFetch || status.status === "completed" || status.status === "no_result") {
        const fetched = await adapter.fetchDiscoveryResults({ runId: requested.runId })
        return {
          records: fetched.records,
          providerCalled: true,
          message: fetched.message,
          status: "completed",
          runId: requested.runId,
          audienceId: requested.audienceId,
          adapterKind: options.adapterKind ?? "live",
        }
      }
      return {
        records: [],
        providerCalled: true,
        message: status.message || requested.message,
        status: "pending",
        runId: requested.runId,
        audienceId: requested.audienceId,
        nextPollAt: status.nextPollAt ?? requested.nextPollAt,
        adapterKind: options.adapterKind ?? "live",
      }
    }

    if (requested.status === "failed_terminal" || requested.status === "failed_retryable") {
      return {
        records: [],
        providerCalled: requested.providerCalled,
        message: requested.message,
        status: requested.status,
        runId: requested.runId,
        audienceId: requested.audienceId,
        nextPollAt: requested.nextPollAt,
        failureCode: requested.failureCode,
        adapterKind: options.adapterKind ?? "live",
      }
    }

    return {
      records: [],
      providerCalled: requested.providerCalled,
      message: requested.message,
      status: "pending",
      runId: requested.runId,
      audienceId: requested.audienceId,
      nextPollAt: requested.nextPollAt,
      failureCode: requested.failureCode,
      creditsAvoided: requested.reusedExisting,
      adapterKind: options.adapterKind ?? "live",
    }
  }
}
