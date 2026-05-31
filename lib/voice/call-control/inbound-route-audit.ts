/** Temporary inbound routing audit logs — remove after voicemail root-cause is resolved. */

export const VOICE_INBOUND_ROUTE_AUDIT_MARKER = "[Voice:inbound-route-audit]" as const

export function logInboundRouteAudit(stage: string, payload: Record<string, unknown>): void {
  console.log(VOICE_INBOUND_ROUTE_AUDIT_MARKER, {
    stage,
    ...payload,
  })
}
