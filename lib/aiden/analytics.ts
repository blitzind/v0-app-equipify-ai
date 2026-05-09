import "server-only"

type AidenAnalyticsEvent = {
  organizationId: string
  userId: string
  module: string
  question: string
  unresolved: boolean
  fallbackUsed: boolean
  relatedRoutes: string[]
}

function sanitizeQuestion(question: string): string {
  return question
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .replace(/\b(?:sk|pk|rk|api|key|secret|token)_[A-Za-z0-9_-]{12,}\b/g, "[secret]")
    .slice(0, 220)
}

export function logAidenHelpEvent(args: {
  organizationId: string
  userId: string
  latestQuestion: string
  /** Module label only (Phase 1 — no record-level context). */
  context: { module: string }
  unresolved: boolean
  answerText: string
  relatedRoutes: string[]
}) {
  const fallbackUsed = args.answerText.includes("I don't see that functionality documented in Equipify yet.")
  const event: AidenAnalyticsEvent = {
    organizationId: args.organizationId,
    userId: args.userId,
    module: args.context.module,
    question: sanitizeQuestion(args.latestQuestion),
    unresolved: args.unresolved,
    fallbackUsed,
    relatedRoutes: args.relatedRoutes.slice(0, 6),
  }
  console.info("[aiden_help]", JSON.stringify(event))
}
