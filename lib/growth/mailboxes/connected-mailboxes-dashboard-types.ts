/** Growth Engine GE-MAIL-1B — Connected mailboxes operator dashboard (client-safe). */

export const GROWTH_CONNECTED_MAILBOXES_QA_MARKER = "growth-connected-mailboxes-1b-v1" as const

export type GrowthConnectedMailboxPoolMembership = {
  poolId: string
  poolName: string
  memberId: string
  memberStatus: string
  poolStatus: string
}

export type GrowthConnectedMailboxRow = {
  senderId: string
  senderDisplayName: string
  email: string
  domain: string
  connectionStatus: string
  healthTier: string
  healthScore: number
  warmupStatus: string | null
  warmupProfileId: string | null
  poolMemberships: GrowthConnectedMailboxPoolMembership[]
  dailyCap: number
  dailyUsed: number
  lastValidationAt: string | null
  mailboxId: string | null
  mailboxTokenConfigured: boolean
  senderStatus: string
  deliveryRouteEnabled: boolean
  providerFamily: string
  needsReconnect: boolean
  operationalPaused: boolean
}

export type GrowthConnectedMailboxesSummary = {
  connectedMailboxes: number
  disconnectedMailboxes: number
  warmingMailboxes: number
  healthyMailboxes: number
  pausedMailboxes: number
  dailyCapacity: number
  dailyUsed: number
}

export type GrowthConnectedMailboxesDashboardPayload = {
  qa_marker: typeof GROWTH_CONNECTED_MAILBOXES_QA_MARKER
  summary: GrowthConnectedMailboxesSummary
  rows: GrowthConnectedMailboxRow[]
  domains: string[]
  pools: Array<{ id: string; name: string }>
}

export type GrowthConnectedMailboxFilter =
  | "all"
  | "connected"
  | "warming"
  | "paused"
  | "unhealthy"
  | "domain"
  | "pool"
