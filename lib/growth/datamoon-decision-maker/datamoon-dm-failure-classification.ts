/**
 * GE-AIOS-CONTACT-1E — DataMoon DM discovery failure classification (client-safe).
 * Terminal auth/config failures must never burn poll budget or become max_polls_exceeded.
 */

export const GROWTH_AIOS_CONTACT_1E_QA_MARKER =
  "ge-aios-contact-1e-datamoon-forbidden-poll-repair-v1" as const

/** Provider error categories that are terminal for DM discovery — never poll. */
export const DATAMOON_DM_TERMINAL_FAILURE_CODES = [
  "forbidden",
  "unauthorized",
  "disabled",
  "missing_key",
  "provider_not_configured",
  "missing_provider_audience_id",
  "bad_request",
  "validation",
  "audience_module_unauthorized",
  "wrong_key_type",
  "credentials_rejected",
  "credentials_absent",
  "provider_disabled",
  "malformed_request",
  "build_rejected",
  "fetch_forbidden",
] as const

export type DatamoonDmTerminalFailureCode = (typeof DATAMOON_DM_TERMINAL_FAILURE_CODES)[number]

/** Transient categories that may back off and continue polling (only with a valid audience ID). */
export const DATAMOON_DM_RETRYABLE_FAILURE_CODES = [
  "server_error",
  "network",
  "not_found", // transient provider lag before audience is visible
] as const

export type DatamoonDmFailureDiagnosticCode =
  | "provider_disabled"
  | "credentials_absent"
  | "credentials_rejected"
  | "audience_module_unauthorized"
  | "wrong_key_type"
  | "malformed_request"
  | "build_rejected"
  | "valid_pending_run"
  | "fetch_forbidden"
  | "provider_timeout"
  | "poll_limit_exceeded"
  | "missing_provider_audience_id"
  | "unknown"

export function isDatamoonDmTerminalFailureCode(code: string | null | undefined): boolean {
  if (!code) return false
  return (DATAMOON_DM_TERMINAL_FAILURE_CODES as readonly string[]).includes(code)
}

export function isDatamoonDmRetryableFailureCode(code: string | null | undefined): boolean {
  if (!code) return false
  return (DATAMOON_DM_RETRYABLE_FAILURE_CODES as readonly string[]).includes(code)
}

/**
 * Map HTTP / client error categories to terminal vs retryable for DM discovery.
 * 401/403 and config absences are always terminal.
 */
export function isDatamoonDmDiscoveryFailureTerminal(
  errorCategory: string | null | undefined,
): boolean {
  if (!errorCategory) return false
  if (isDatamoonDmTerminalFailureCode(errorCategory)) return true
  // Aliases from HTTP layer / client preflight
  return (
    errorCategory === "forbidden" ||
    errorCategory === "unauthorized" ||
    errorCategory === "disabled" ||
    errorCategory === "missing_key"
  )
}

/**
 * Operator-facing diagnostic for a failure code — never elevates max_polls over an earlier terminal cause.
 */
export function classifyDatamoonDmFailureDiagnostic(input: {
  failureCode: string | null | undefined
  firstFailureCode?: string | null
  httpStatus?: number | null
  audienceId?: string | null
  audienceMode?: "ext" | "module" | null
  audienceExtKeyPresent?: boolean
  audienceModuleKeyPresent?: boolean
  providerEnabled?: boolean
}): {
  diagnostic: DatamoonDmFailureDiagnosticCode
  primaryFailureCode: string
  message: string
} {
  const primary =
    (input.firstFailureCode && isDatamoonDmDiscoveryFailureTerminal(input.firstFailureCode)
      ? input.firstFailureCode
      : null) ||
    input.failureCode ||
    "unknown"

  if (input.providerEnabled === false || primary === "disabled") {
    return {
      diagnostic: "provider_disabled",
      primaryFailureCode: primary === "unknown" ? "provider_disabled" : primary,
      message: "DataMoon provider disabled — enable DATAMOON_PROVIDER_ENABLED for live discovery.",
    }
  }

  if (primary === "missing_key" || primary === "credentials_absent") {
    return {
      diagnostic: "credentials_absent",
      primaryFailureCode: "credentials_absent",
      message:
        input.audienceMode === "module"
          ? "DATAMOON_AUDIENCE_MODULE_API_KEY absent for module mode."
          : "DATAMOON_AUDIENCE_EXT_API_KEY absent for ext mode.",
    }
  }

  if (primary === "forbidden" || primary === "unauthorized" || primary === "credentials_rejected") {
    const mode = input.audienceMode ?? "ext"
    const otherKeyPresent =
      mode === "ext" ? Boolean(input.audienceModuleKeyPresent) : Boolean(input.audienceExtKeyPresent)
    if (otherKeyPresent) {
      return {
        diagnostic: "wrong_key_type",
        primaryFailureCode: primary,
        message: `Audience ${mode} credentials rejected (HTTP ${input.httpStatus ?? "401/403"}). Alternate audience key is present — check DATAMOON_DEFAULT_MODE vs authorized module.`,
      }
    }
    return {
      diagnostic: mode === "module" ? "audience_module_unauthorized" : "credentials_rejected",
      primaryFailureCode: primary,
      message: `Audience ${mode} authorization rejected — credentials present but provider returned forbidden/unauthorized.`,
    }
  }

  if (primary === "bad_request" || primary === "validation" || primary === "malformed_request") {
    return {
      diagnostic: "malformed_request",
      primaryFailureCode: primary,
      message: "DataMoon rejected the audience request as malformed or invalid.",
    }
  }

  if (primary === "missing_provider_audience_id" || primary === "build_rejected") {
    return {
      diagnostic: primary === "missing_provider_audience_id" ? "missing_provider_audience_id" : "build_rejected",
      primaryFailureCode: primary,
      message: "Audience build did not return a valid provider audience/build ID — polling must not start.",
    }
  }

  if (primary === "fetch_forbidden") {
    return {
      diagnostic: "fetch_forbidden",
      primaryFailureCode: primary,
      message: "Audience fetch returned forbidden — stop polling immediately.",
    }
  }

  if (primary === "max_polls_exceeded" || primary === "poll_limit_exceeded") {
    // Never report max polls as root when an earlier terminal cause exists.
    if (input.firstFailureCode && isDatamoonDmDiscoveryFailureTerminal(input.firstFailureCode)) {
      return classifyDatamoonDmFailureDiagnostic({
        ...input,
        failureCode: input.firstFailureCode,
        firstFailureCode: null,
      })
    }
    return {
      diagnostic: "poll_limit_exceeded",
      primaryFailureCode: "max_polls_exceeded",
      message: "Legitimate pending run exceeded bounded poll attempts.",
    }
  }

  if (primary === "server_error" || primary === "network" || primary === "provider_timeout") {
    return {
      diagnostic: "provider_timeout",
      primaryFailureCode: primary,
      message: "Temporary provider error — backoff and retry only with a valid audience ID.",
    }
  }

  if (input.audienceId && (!input.failureCode || input.failureCode === "null")) {
    return {
      diagnostic: "valid_pending_run",
      primaryFailureCode: "valid_pending_run",
      message: "Valid provider audience ID present — bounded polling allowed.",
    }
  }

  return {
    diagnostic: "unknown",
    primaryFailureCode: primary,
    message: `Unclassified DataMoon DM failure: ${primary}`,
  }
}

/**
 * Resolve the durable failure code to persist when poll budget is exhausted.
 * Preserves the earliest terminal cause — never masks forbidden with max_polls_exceeded.
 */
export function resolveDatamoonDmPollExhaustionFailureCode(input: {
  firstFailureCode?: string | null
  priorFailureCode?: string | null
}): string {
  const first = input.firstFailureCode ?? null
  const prior = input.priorFailureCode ?? null
  if (first && isDatamoonDmDiscoveryFailureTerminal(first)) return first
  if (prior && isDatamoonDmDiscoveryFailureTerminal(prior)) return prior
  return "max_polls_exceeded"
}
