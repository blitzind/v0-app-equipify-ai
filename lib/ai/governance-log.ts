import "server-only"

/**
 * Structured, secret-safe logs for AI/automation entitlement skips (cron, workers).
 * Do not pass prompts, model output, tokens, or webhook URLs.
 */
export function logAiGovernanceSkip(args: {
  organizationId: string
  feature: string
  reason: string
  source: string
}): void {
  console.info(
    JSON.stringify({
      kind: "ai_governance_skip",
      at: new Date().toISOString(),
      organizationId: args.organizationId,
      feature: args.feature,
      reason: args.reason,
      source: args.source,
    }),
  )
}
