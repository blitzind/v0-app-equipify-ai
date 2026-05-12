import "server-only"

/** Outbound SMS (transactional / service). Implementations must never run in the browser. */
export type SmsSendRequest = {
  organizationId: string
  toE164: string
  body: string
  /** Correlates attempts in logs; not shown to end users. */
  idempotencyKey: string
}

export type SmsSendResult =
  | { ok: true; provider: string; externalId: string | null }
  | { ok: false; provider: string; code: string }

export interface SmsOutboundProvider {
  readonly id: "noop" | "twilio" | "telnyx"
  send(_req: SmsSendRequest): Promise<SmsSendResult>
}
