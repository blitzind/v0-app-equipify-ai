/** Apollo live pilot structured error reporting — client-safe, no secrets. */

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bAPOLLO_API_KEY[=:\s]+["']?[^\s"']+/gi,
  /\bGROWTH_APOLLO_API_KEY[=:\s]+["']?[^\s"']+/gi,
  /\bSUPABASE_SERVICE_ROLE_KEY[=:\s]+["']?[^\s"']+/gi,
  /\bsk-[a-zA-Z0-9_-]{8,}\b/g,
]

export function redactApolloLivePilotErrorMessage(message: string): string {
  let redacted = message
  for (const pattern of SECRET_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]")
  }
  return redacted
}

export function describeApolloLivePilotThrownError(error: unknown): {
  error_name: string
  error_message: string
  stack_first_line: string | null
} {
  if (error instanceof Error) {
    const stack_first_line =
      error.stack
        ?.split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? null
    return {
      error_name: error.name,
      error_message: redactApolloLivePilotErrorMessage(error.message),
      stack_first_line: stack_first_line
        ? redactApolloLivePilotErrorMessage(stack_first_line)
        : null,
    }
  }

  return {
    error_name: "Error",
    error_message: redactApolloLivePilotErrorMessage(String(error)),
    stack_first_line: null,
  }
}

export function logApolloLivePilotError(phase: string, error: unknown): void {
  const described = describeApolloLivePilotThrownError(error)
  console.info(
    JSON.stringify({
      source: "growth-engine",
      event: "apollo_live_pilot_error",
      ts: new Date().toISOString(),
      phase,
      error_name: described.error_name,
      error_message: described.error_message,
      stack_first_line: described.stack_first_line,
    }),
  )
}

export function formatApolloLivePilotErrorForEvidence(phase: string, error: unknown): string {
  const described = describeApolloLivePilotThrownError(error)
  return `[${phase}] ${described.error_name}: ${described.error_message}`
}

export function formatApolloLivePilotFailureForEvidence(
  phase: string,
  error_name: string,
  error_message: string,
): string {
  return `[${phase}] ${error_name}: ${redactApolloLivePilotErrorMessage(error_message)}`
}

export function logApolloLivePilotFailure(input: {
  phase: string
  error_name: string
  error_message: string
  stack_first_line?: string | null
}): void {
  console.info(
    JSON.stringify({
      source: "growth-engine",
      event: "apollo_live_pilot_error",
      ts: new Date().toISOString(),
      phase: input.phase,
      error_name: input.error_name,
      error_message: redactApolloLivePilotErrorMessage(input.error_message),
      stack_first_line: input.stack_first_line ?? null,
    }),
  )
}
