import "server-only"

/** Log BlitzPay server failures with full detail; never forward this to client JSON. */
export function logBlitzpayServerFailure(context: string, cause: unknown): void {
  if (cause instanceof Error) {
    console.error(`[blitzpay] ${context}`, cause.stack ?? cause.message)
  } else {
    console.error(`[blitzpay] ${context}`, cause)
  }
}
