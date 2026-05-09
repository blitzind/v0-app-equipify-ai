/**
 * Client-only persistence for AIden chat (localStorage). No server / no long-term memory.
 */

import type { AidenSupportPhase2Answer } from "@/lib/aiden/aiden-support-phase2-schema"

const STORAGE_NS = "equipify:aiden:chat:v1"
const MAX_MESSAGES = 40
const MAX_CONTENT_CHARS = 6000

export type SerializedChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  answer?: AidenSupportPhase2Answer | null
  createdAt: string
}

export type AidenChatSessionPayload = {
  version: 1
  messages: SerializedChatMessage[]
  /** Last known UI context (path + module label only — no record payloads). */
  context: { path: string; moduleLabel: string }
  createdAt: string
  updatedAt: string
}

export function buildAidenChatStorageKey(organizationId: string, userId: string | null): string {
  const u = userId?.trim() || "unknown"
  return `${STORAGE_NS}:${organizationId}:${u}`
}

function trimContent(s: string): string {
  const t = s.trim()
  if (t.length <= MAX_CONTENT_CHARS) return t
  return `${t.slice(0, MAX_CONTENT_CHARS)}…`
}

function capMessages(messages: SerializedChatMessage[]): SerializedChatMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages
  return messages.slice(-MAX_MESSAGES)
}

export function serializeAidenChatSession(args: {
  organizationId: string
  userId: string | null
  messages: Array<{
    id: string
    role: "user" | "assistant"
    content: string
    answer?: AidenSupportPhase2Answer
    createdAt: Date
  }>
  path: string
  moduleLabel: string
  sessionCreatedAt: Date
}): void {
  if (typeof window === "undefined") return
  const key = buildAidenChatStorageKey(args.organizationId, args.userId)
  const now = new Date().toISOString()
  const messages: SerializedChatMessage[] = capMessages(
    args.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: trimContent(m.content),
      answer: m.answer ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  )

  const payload: AidenChatSessionPayload = {
    version: 1,
    messages,
    context: {
      path: args.path.slice(0, 300),
      moduleLabel: args.moduleLabel.slice(0, 120),
    },
    createdAt: args.sessionCreatedAt.toISOString(),
    updatedAt: now,
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    /* quota / private mode — ignore */
  }
}

export function loadAidenChatSession(
  organizationId: string,
  userId: string | null,
): AidenChatSessionPayload | null {
  if (typeof window === "undefined") return null
  const key = buildAidenChatStorageKey(organizationId, userId)
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const o = parsed as Record<string, unknown>
    if (o.version !== 1) return null
    if (!Array.isArray(o.messages)) return null
    const messages = o.messages.filter((m): m is SerializedChatMessage => {
      if (!m || typeof m !== "object") return false
      const row = m as Record<string, unknown>
      return (
        typeof row.id === "string" &&
        (row.role === "user" || row.role === "assistant") &&
        typeof row.content === "string" &&
        typeof row.createdAt === "string"
      )
    })
    const ctx = o.context as Record<string, unknown> | undefined
    const context =
      ctx && typeof ctx.path === "string" && typeof ctx.moduleLabel === "string"
        ? { path: ctx.path, moduleLabel: ctx.moduleLabel }
        : { path: "", moduleLabel: "" }
    const createdAt = typeof o.createdAt === "string" ? o.createdAt : nowIso()
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : nowIso()
    return {
      version: 1,
      messages: capMessages(messages),
      context,
      createdAt,
      updatedAt,
    }
  } catch {
    return null
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

export function clearAidenChatSession(organizationId: string, userId: string | null): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(buildAidenChatStorageKey(organizationId, userId))
  } catch {
    /* ignore */
  }
}

export function messagesFromPayload(rows: SerializedChatMessage[]): Array<{
  id: string
  role: "user" | "assistant"
  content: string
  answer?: AidenSupportPhase2Answer
  createdAt: Date
}> {
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    answer: m.answer ?? undefined,
    createdAt: new Date(m.createdAt),
  }))
}
