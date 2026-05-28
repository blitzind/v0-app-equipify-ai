/** In-memory stream ownership registry for duplicate prevention and reconnect handling. */

export type VoiceMediaStreamOwnershipRecord = {
  connectionId: string
  organizationId: string
  mediaSessionId: string
  providerStreamSid: string
  connectedAt: string
  lastFrameAt: string
  reconnectCount: number
}

const ownershipByStreamSid = new Map<string, VoiceMediaStreamOwnershipRecord>()
const ownershipByConnectionId = new Map<string, VoiceMediaStreamOwnershipRecord>()

function streamKey(organizationId: string, providerStreamSid: string): string {
  return `${organizationId}:${providerStreamSid}`
}

export type StreamOwnershipAcquireResult =
  | { ok: true; record: VoiceMediaStreamOwnershipRecord; duplicate: false }
  | { ok: true; record: VoiceMediaStreamOwnershipRecord; duplicate: true; reason: "reconnect" | "duplicate_active" }
  | { ok: false; reason: "conflicting_owner" }

export function acquireVoiceMediaStreamOwnership(input: {
  connectionId: string
  organizationId: string
  mediaSessionId: string
  providerStreamSid: string
  allowReconnect?: boolean
}): StreamOwnershipAcquireResult {
  const key = streamKey(input.organizationId, input.providerStreamSid)
  const existing = ownershipByStreamSid.get(key)

  if (existing) {
    if (existing.connectionId === input.connectionId) {
      existing.lastFrameAt = new Date().toISOString()
      return { ok: true, record: existing, duplicate: true, reason: "duplicate_active" }
    }

    if (input.allowReconnect && existing.mediaSessionId === input.mediaSessionId) {
      const record: VoiceMediaStreamOwnershipRecord = {
        ...existing,
        connectionId: input.connectionId,
        reconnectCount: existing.reconnectCount + 1,
        lastFrameAt: new Date().toISOString(),
      }
      ownershipByConnectionId.delete(existing.connectionId)
      ownershipByStreamSid.set(key, record)
      ownershipByConnectionId.set(input.connectionId, record)
      return { ok: true, record, duplicate: true, reason: "reconnect" }
    }
    if (existing.mediaSessionId === input.mediaSessionId) {
      return { ok: true, record: existing, duplicate: true, reason: "duplicate_active" }
    }
    return { ok: false, reason: "conflicting_owner" }
  }

  const now = new Date().toISOString()
  const record: VoiceMediaStreamOwnershipRecord = {
    connectionId: input.connectionId,
    organizationId: input.organizationId,
    mediaSessionId: input.mediaSessionId,
    providerStreamSid: input.providerStreamSid,
    connectedAt: now,
    lastFrameAt: now,
    reconnectCount: existing?.reconnectCount ?? 0,
  }
  ownershipByStreamSid.set(key, record)
  ownershipByConnectionId.set(input.connectionId, record)
  return { ok: true, record, duplicate: false }
}

export function touchVoiceMediaStreamOwnership(connectionId: string): void {
  const record = ownershipByConnectionId.get(connectionId)
  if (!record) return
  record.lastFrameAt = new Date().toISOString()
}

export function releaseVoiceMediaStreamOwnership(connectionId: string): VoiceMediaStreamOwnershipRecord | null {
  const record = ownershipByConnectionId.get(connectionId)
  if (!record) return null
  ownershipByConnectionId.delete(connectionId)
  ownershipByStreamSid.delete(streamKey(record.organizationId, record.providerStreamSid))
  return record
}

export function getVoiceMediaStreamOwnershipMetrics(): {
  activeStreamCount: number
  reconnectCount: number
} {
  let reconnectCount = 0
  for (const record of ownershipByStreamSid.values()) {
    reconnectCount += record.reconnectCount
  }
  return { activeStreamCount: ownershipByStreamSid.size, reconnectCount }
}

export function resetVoiceMediaStreamOwnershipForTests(): void {
  ownershipByStreamSid.clear()
  ownershipByConnectionId.clear()
}

export function cleanupStaleVoiceMediaStreamOwnership(staleBeforeMs: number): number {
  const cutoff = Date.now() - staleBeforeMs
  let cleaned = 0
  for (const [connectionId, record] of ownershipByConnectionId.entries()) {
    if (Date.parse(record.lastFrameAt) < cutoff) {
      releaseVoiceMediaStreamOwnership(connectionId)
      cleaned += 1
    }
  }
  return cleaned
}
