import "server-only"

import { createHash } from "crypto"
import type { AiChatMessage, AiTaskDefinition, AiModelRef, AiTaskId } from "@/lib/ai/types"

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex")
}

/** Deterministic SHA-256 of full file bytes — stable across imports for same binary. */
export function sha256BufferHex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableStringify(x)).join(",")}]`
  }
  const o = value as Record<string, unknown>
  const keys = Object.keys(o).sort()
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",")}}`
}

/**
 * Normalize chat messages to a stable representation (text-only; multimodal excluded upstream).
 */
export function canonicalizeMessagesForCache(messages: AiChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content.trim() }
    }
    const parts = m.content
      .filter((p) => p.type === "text")
      .map((p) => ("text" in p ? String(p.text).trim() : ""))
      .join("\n")
    return { role: m.role, content: parts }
  })
}

/**
 * Signature for model routing + decoding behavior (excludes volatile retry counts).
 */
export function computeModelSignature(def: AiTaskDefinition, primaryRef: AiModelRef): string {
  const payload = {
    provider: primaryRef.provider,
    model: primaryRef.model,
    temperature: def.temperature,
    maxOutputTokens: def.maxOutputTokens,
    structuredMode: def.structuredMode,
    confidenceThreshold: def.confidenceThreshold,
  }
  return sha256Hex(stableStringify(payload))
}

export type RouterCacheHashParts = {
  taskId: AiTaskId
  /** Canonical message payload after augmentation (same bytes the model sees semantically). */
  messagesCanonical: unknown[]
  /** Caller-supplied schema / extraction revision — bump when Zod shape changes. */
  schemaVersion: string
  /** Registry revision — must change when prompts or output contract change. */
  prompt?: { promptId: string; promptVersion: number; schemaVersion: string }
  /** e.g. file_sha256 for extraction tasks — sorted when serialized. */
  extras?: Record<string, string>
}

export function computeInputHash(parts: RouterCacheHashParts): string {
  const extrasSorted: Record<string, string> = {}
  if (parts.extras) {
    const keys = Object.keys(parts.extras).sort()
    for (const k of keys) {
      extrasSorted[k] = parts.extras[k]
    }
  }
  const body = stableStringify({
    task: parts.taskId,
    messages: parts.messagesCanonical,
    schemaVersion: parts.schemaVersion,
    prompt: parts.prompt,
    extras: Object.keys(extrasSorted).length ? extrasSorted : undefined,
  })
  return sha256Hex(body)
}

export function computeStorageKey(
  organizationId: string | null,
  taskId: AiTaskId,
  inputHash: string,
  modelSignature: string,
): string {
  const orgPart = organizationId?.trim() ? organizationId.trim() : "__global__"
  return sha256Hex(`${orgPart}|${taskId}|${inputHash}|${modelSignature}`)
}

export type FileExtractionCacheParts = {
  organizationId: string | null
  taskId: AiTaskId
  systemPrompt: string
  userInstruction: string
  fileSha256: string
  mimeType: string
  modelSignature: string
}

/** Same-file + same-prompt extraction dedupe (binary fingerprint included). */
export function computeFileExtractionInputHash(parts: FileExtractionCacheParts): string {
  const body = stableStringify({
    task: parts.taskId,
    system: parts.systemPrompt.trim(),
    userInstruction: parts.userInstruction.trim(),
    fileSha256: parts.fileSha256,
    mimeType: parts.mimeType.trim(),
    promptId: parts.promptId,
    promptVersion: parts.promptVersion,
    schemaVersion: parts.schemaVersion,
  })
  return sha256Hex(body)
}

export function computeFileExtractionStorageKey(parts: FileExtractionCacheParts): string {
  const orgPart = parts.organizationId?.trim() ? parts.organizationId.trim() : "__global__"
  const inputHash = computeFileExtractionInputHash(parts)
  return sha256Hex(`${orgPart}|${parts.taskId}|${inputHash}|${parts.modelSignature}`)
}
