/**
 * GE-AIOS-CONTACT-1B — Resolve production vs injected DM discovery adapters.
 * Production MUST resolve the live DataMoon adapter — never the no-network stub.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createLegacyDatamoonDmDiscoveryAdapterBridge,
  createLiveDatamoonDecisionMakerDiscoveryAdapter,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-live-adapter"
import {
  GROWTH_AIOS_CONTACT_1B_QA_MARKER,
  type DatamoonDecisionMakerDiscoveryAdapter,
  type DatamoonDmDiscoveryAdapterResult,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-types"
import type { DatamoonFetchImpl } from "@/lib/growth/providers/datamoon/datamoon-http"
import { logGrowthEngine } from "@/lib/growth/access"

export type DatamoonDmDiscoveryRuntime = "production" | "cert" | "test"

export type ResolveDatamoonDmDiscoveryAdapterInput = {
  runtime: DatamoonDmDiscoveryRuntime
  admin: SupabaseClient
  env?: NodeJS.ProcessEnv
  fetchImpl?: DatamoonFetchImpl
  /** Cert/test only — injected multi-step adapter. */
  injectedAdapter?: DatamoonDecisionMakerDiscoveryAdapter
  /** Cert/test only — injected single-shot bridge result adapter. */
  injectedLegacyAdapter?: (input: {
    organizationId: string
    leadId: string
    companyName: string | null
    companyDomain: string | null
    titleFamilies: string[]
    filters: Array<{ field: string; operator: string; value: string | string[] }>
    idempotencyKey?: string
  }) => Promise<DatamoonDmDiscoveryAdapterResult>
}

export type ResolvedDatamoonDmDiscoveryAdapter = {
  qaMarker: typeof GROWTH_AIOS_CONTACT_1B_QA_MARKER
  kind: "live" | "injected"
  multiStep: DatamoonDecisionMakerDiscoveryAdapter
  legacy: (input: {
    organizationId: string
    leadId: string
    companyName: string | null
    companyDomain: string | null
    titleFamilies: string[]
    filters: Array<{ field: string; operator: string; value: string | string[] }>
    idempotencyKey?: string
    companyId?: string | null
  }) => Promise<DatamoonDmDiscoveryAdapterResult>
}

/**
 * Production always selects the live DataMoon adapter.
 * Throws if production would resolve a stub.
 */
export function resolveDatamoonDmDiscoveryAdapter(
  input: ResolveDatamoonDmDiscoveryAdapterInput,
): ResolvedDatamoonDmDiscoveryAdapter {
  if (input.runtime === "production") {
    if (input.injectedAdapter || input.injectedLegacyAdapter) {
      throw new Error(
        "CONTACT-1B: production runtime cannot resolve an injected/stub DataMoon DM discovery adapter.",
      )
    }
    const multiStep = createLiveDatamoonDecisionMakerDiscoveryAdapter({
      admin: input.admin,
      env: input.env,
      fetchImpl: input.fetchImpl,
    })
    const legacy = createLegacyDatamoonDmDiscoveryAdapterBridge(multiStep, {
      admin: input.admin,
      adapterKind: "live",
    })
    logGrowthEngine("datamoon_dm_discovery_adapter_selected", {
      qa_marker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
      runtime: "production",
      adapter_kind: "live",
    })
    return {
      qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
      kind: "live",
      multiStep,
      legacy,
    }
  }

  if (input.injectedLegacyAdapter) {
    const multiStep =
      input.injectedAdapter ??
      ({
        requestDiscovery: async () => {
          throw new Error("Injected legacy-only adapter — use legacy bridge.")
        },
        getDiscoveryStatus: async () => {
          throw new Error("Injected legacy-only adapter — use legacy bridge.")
        },
        fetchDiscoveryResults: async () => {
          throw new Error("Injected legacy-only adapter — use legacy bridge.")
        },
      } satisfies DatamoonDecisionMakerDiscoveryAdapter)
    return {
      qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
      kind: "injected",
      multiStep,
      legacy: input.injectedLegacyAdapter,
    }
  }

  if (input.injectedAdapter) {
    return {
      qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
      kind: "injected",
      multiStep: input.injectedAdapter,
      legacy: createLegacyDatamoonDmDiscoveryAdapterBridge(input.injectedAdapter, {
        admin: input.admin,
        adapterKind: "injected",
      }),
    }
  }

  // Cert/test without injection still gets live adapter (may fail closed on missing keys).
  const multiStep = createLiveDatamoonDecisionMakerDiscoveryAdapter({
    admin: input.admin,
    env: input.env,
    fetchImpl: input.fetchImpl,
  })
  return {
    qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
    kind: "live",
    multiStep,
    legacy: createLegacyDatamoonDmDiscoveryAdapterBridge(multiStep, {
      admin: input.admin,
      adapterKind: "live",
    }),
  }
}

/** Guard used by certs — production selection must never be stub. */
export function assertProductionDatamoonDmDiscoveryAdapterIsLive(
  resolved: ResolvedDatamoonDmDiscoveryAdapter,
): void {
  if (resolved.kind !== "live") {
    throw new Error("CONTACT-1B: production DataMoon DM discovery adapter is not live.")
  }
}
