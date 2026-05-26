import { randomUUID } from "node:crypto"
import { providerSkippedResponse } from "@/lib/growth/lead-engine/providers/provider-errors"
import type {
  GrowthLeadEngineCompanyIdentificationProvider,
  GrowthLeadEngineProviderContext,
} from "@/lib/growth/lead-engine/providers/provider-types"

const FUTURE_PROVIDER_NAME = "lead_engine_future_company_identification"

/** Reserved provider slot — no third-party enrichment yet. */
export function createFutureCompanyIdentificationProvider(): GrowthLeadEngineCompanyIdentificationProvider {
  return {
    provider_type: "company_identification",
    identify: (context: GrowthLeadEngineProviderContext) =>
      Promise.resolve(
        providerSkippedResponse(
          FUTURE_PROVIDER_NAME,
          "company_identification",
          context,
          randomUUID(),
          "Future company identification provider reserved — no external enrichment integrated.",
        ),
      ),
  }
}

export function createFixtureCompanyIdentificationProvider(): GrowthLeadEngineCompanyIdentificationProvider {
  return {
    provider_type: "company_identification",
    identify: (context: GrowthLeadEngineProviderContext) =>
      Promise.resolve(
        providerSkippedResponse(
          "lead_engine_fixture_company_identification",
          "company_identification",
          context,
          randomUUID(),
          "Fixture mode uses in-process company identification engine — provider hook skipped.",
        ),
      ),
  }
}
