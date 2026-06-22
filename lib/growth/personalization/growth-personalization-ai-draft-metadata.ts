/** GS-AI-PLAYBOOK-4D.2 — Original AI draft snapshot in generation metadata (client-safe). */

export type GrowthPersonalizationOriginalAiDraftSnapshot = {
  subject: string
  body: string
  capturedAt: string
}

export function buildOriginalAiDraftSnapshot(input: {
  subject: string
  body: string
  capturedAt?: string
}): GrowthPersonalizationOriginalAiDraftSnapshot {
  return {
    subject: input.subject.trim(),
    body: input.body.trim(),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
  }
}

export function parseOriginalAiDraftSnapshot(
  metadata: unknown,
): GrowthPersonalizationOriginalAiDraftSnapshot | null {
  if (!metadata || typeof metadata !== "object") return null
  const raw = (metadata as Record<string, unknown>).original_ai_draft
  if (!raw || typeof raw !== "object") return null
  const entry = raw as Record<string, unknown>
  const subject = typeof entry.subject === "string" ? entry.subject.trim() : ""
  const body = typeof entry.body === "string" ? entry.body.trim() : ""
  if (!subject && !body) return null
  return {
    subject,
    body,
    capturedAt: typeof entry.capturedAt === "string" ? entry.capturedAt : new Date(0).toISOString(),
  }
}

export function resolvePersonalizationOriginalAiDraft(input: {
  metadata: unknown
  subject: string
  body: string
}): GrowthPersonalizationOriginalAiDraftSnapshot {
  const parsed = parseOriginalAiDraftSnapshot(input.metadata)
  if (parsed) return parsed
  return buildOriginalAiDraftSnapshot({ subject: input.subject, body: input.body })
}
