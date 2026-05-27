/** Stub provider validation — no live provider execution. Client-safe. */

import { getDeliveryProviderRegistryEntry } from "@/lib/growth/providers/provider-registry"
import type {
  GrowthDeliveryProviderFamily,
  GrowthDeliveryValidationResult,
} from "@/lib/growth/providers/provider-types"

export type ProviderValidationOutcome = {
  result: GrowthDeliveryValidationResult
  summary: string
  configuration_status: string
}

export function validateProvider(input: {
  provider_family: GrowthDeliveryProviderFamily
  status?: string
  supports_send?: boolean
}): ProviderValidationOutcome {
  const registry = getDeliveryProviderRegistryEntry(input.provider_family)

  if (!registry.capabilities.send) {
    return {
      result: "unsupported",
      summary: `${registry.label} does not support outbound send in this registry profile.`,
      configuration_status: "unsupported",
    }
  }

  if (input.status === "disabled") {
    return {
      result: "error",
      summary: "Provider is disabled and cannot be validated.",
      configuration_status: "disabled",
    }
  }

  if (input.provider_family === "custom" && !input.supports_send) {
    return {
      result: "warning",
      summary: "Custom provider requires manual configuration review before delivery routing.",
      configuration_status: "manual_review",
    }
  }

  if (input.provider_family === "smtp") {
    return {
      result: "warning",
      summary: "SMTP validation is stub-only — credentials must be verified manually before live delivery.",
      configuration_status: "stub_validated",
    }
  }

  return {
    result: "supported",
    summary: `${registry.label} passed stub validation checks.`,
    configuration_status: "stub_validated",
  }
}
