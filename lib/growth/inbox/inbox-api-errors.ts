import "server-only"

/** Never surface raw ReferenceErrors or undefined helper names to operators. */
export function sanitizeGrowthInboxApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  const message = error.message.trim()
  if (!message) return fallback
  if (/^ReferenceError:/i.test(message) || /\bis not defined$/i.test(message)) {
    return "Inbox data could not be loaded due to a server configuration issue. Retry shortly or contact platform support."
  }
  if (/^TypeError:/i.test(message) && message.includes("is not a function")) {
    return "Inbox data could not be loaded due to a server configuration issue. Retry shortly or contact platform support."
  }
  return message
}
