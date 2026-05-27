import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSenderFatigueEvent,
  GrowthSenderFatigueType,
  GrowthSenderPool,
  GrowthSenderPoolMember,
  GrowthSenderPoolMemberStatus,
  GrowthSenderPoolPerformanceSnapshot,
  GrowthSenderPoolRotationStrategy,
  GrowthSenderPoolStatus,
  GrowthSenderRotationDecision,
  GrowthSenderRotationDecisionReason,
  GrowthSenderRotationFallbackCandidate,
  GrowthSenderRotationRiskLevel,
} from "@/lib/growth/sender-pools/sender-pool-types"
import { maskSenderLabel } from "@/lib/growth/sender-pools/sender-pool-types"

function poolsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_pools")
}

function membersTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_pool_members")
}

function decisionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_rotation_decisions")
}

function fatigueTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_fatigue_events")
}

function snapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_pool_performance_snapshots")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapPool(row: Record<string, unknown>, memberCount = 0): GrowthSenderPool {
  return {
    id: asString(row.id),
    name: asString(row.name),
    description: asString(row.description),
    status: asString(row.status) as GrowthSenderPoolStatus,
    rotationStrategy: asString(row.rotation_strategy) as GrowthSenderPoolRotationStrategy,
    dailyPoolCap: row.daily_pool_cap == null ? null : asNumber(row.daily_pool_cap),
    requiresMailbox: Boolean(row.requires_mailbox),
    minComplianceScore: asNumber(row.min_compliance_score, 60),
    allowAutoRotation: row.allow_auto_rotation !== false,
    memberCount,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapMember(row: Record<string, unknown>, senderLabel = "Sender"): GrowthSenderPoolMember {
  return {
    id: asString(row.id),
    senderPoolId: asString(row.sender_pool_id),
    senderAccountId: asString(row.sender_account_id),
    senderLabel,
    senderEmail: senderLabel,
    memberStatus: asString(row.member_status) as GrowthSenderPoolMemberStatus,
    priorityWeight: asNumber(row.priority_weight, 100),
    manualPriority: asNumber(row.manual_priority, 100),
    lastSelectedAt: asString(row.last_selected_at) || null,
    cooldownUntil: asString(row.cooldown_until) || null,
    notes: asString(row.notes),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export async function listSenderPools(admin: SupabaseClient): Promise<GrowthSenderPool[]> {
  const { data, error } = await poolsTable(admin).select("*").order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  const pools = (data ?? []) as Record<string, unknown>[]
  const counts = new Map<string, number>()
  const { data: memberRows } = await membersTable(admin).select("sender_pool_id")
  for (const row of (memberRows ?? []) as Array<{ sender_pool_id?: string }>) {
    const id = asString(row.sender_pool_id)
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return pools.map((row) => mapPool(row, counts.get(asString(row.id)) ?? 0))
}

export async function getSenderPool(admin: SupabaseClient, poolId: string): Promise<GrowthSenderPool | null> {
  const { data, error } = await poolsTable(admin).select("*").eq("id", poolId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { count } = await membersTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("sender_pool_id", poolId)
  return mapPool(data as Record<string, unknown>, count ?? 0)
}

export async function createSenderPool(
  admin: SupabaseClient,
  input: {
    name: string
    description?: string
    status?: GrowthSenderPoolStatus
    rotationStrategy?: GrowthSenderPoolRotationStrategy
    dailyPoolCap?: number | null
    requiresMailbox?: boolean
    minComplianceScore?: number
    allowAutoRotation?: boolean
  },
): Promise<GrowthSenderPool> {
  const now = new Date().toISOString()
  const { data, error } = await poolsTable(admin)
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      status: input.status ?? "draft",
      rotation_strategy: input.rotationStrategy ?? "weighted_health",
      daily_pool_cap: input.dailyPoolCap ?? null,
      requires_mailbox: input.requiresMailbox ?? true,
      min_compliance_score: input.minComplianceScore ?? 60,
      allow_auto_rotation: input.allowAutoRotation ?? true,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapPool(data as Record<string, unknown>, 0)
}

export async function updateSenderPool(
  admin: SupabaseClient,
  poolId: string,
  input: Partial<{
    name: string
    description: string
    status: GrowthSenderPoolStatus
    rotationStrategy: GrowthSenderPoolRotationStrategy
    dailyPoolCap: number | null
    requiresMailbox: boolean
    minComplianceScore: number
    allowAutoRotation: boolean
  }>,
): Promise<GrowthSenderPool> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name != null) patch.name = input.name.trim()
  if (input.description != null) patch.description = input.description.trim()
  if (input.status != null) patch.status = input.status
  if (input.rotationStrategy != null) patch.rotation_strategy = input.rotationStrategy
  if (input.dailyPoolCap !== undefined) patch.daily_pool_cap = input.dailyPoolCap
  if (input.requiresMailbox != null) patch.requires_mailbox = input.requiresMailbox
  if (input.minComplianceScore != null) patch.min_compliance_score = input.minComplianceScore
  if (input.allowAutoRotation != null) patch.allow_auto_rotation = input.allowAutoRotation

  const { data, error } = await poolsTable(admin).update(patch).eq("id", poolId).select("*").single()
  if (error) throw new Error(error.message)
  return mapPool(data as Record<string, unknown>)
}

export async function deleteSenderPool(admin: SupabaseClient, poolId: string): Promise<void> {
  const { error } = await poolsTable(admin).delete().eq("id", poolId)
  if (error) throw new Error(error.message)
}

export async function listSenderPoolMembers(
  admin: SupabaseClient,
  poolId: string,
): Promise<GrowthSenderPoolMember[]> {
  const { data, error } = await membersTable(admin)
    .select("*")
    .eq("sender_pool_id", poolId)
    .order("manual_priority", { ascending: false })
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Record<string, unknown>[]
  const senderIds = rows.map((row) => asString(row.sender_account_id)).filter(Boolean)
  const senderLabels = new Map<string, string>()
  if (senderIds.length > 0) {
    const { data: senders } = await admin
      .schema("growth")
      .from("sender_accounts")
      .select("id, email_address, display_name")
      .in("id", senderIds)
    for (const sender of (senders ?? []) as Array<{ id?: string; email_address?: string; display_name?: string }>) {
      const id = asString(sender.id)
      if (id) {
        senderLabels.set(id, maskSenderLabel(asString(sender.email_address), asString(sender.display_name)))
      }
    }
  }

  return rows.map((row) => {
    const senderId = asString(row.sender_account_id)
    const label = senderLabels.get(senderId) ?? "Sender"
    return { ...mapMember(row, label), senderEmail: label }
  })
}

export async function addSenderPoolMember(
  admin: SupabaseClient,
  input: {
    senderPoolId: string
    senderAccountId: string
    memberStatus?: GrowthSenderPoolMemberStatus
    priorityWeight?: number
    manualPriority?: number
    notes?: string
  },
): Promise<GrowthSenderPoolMember> {
  const { data, error } = await membersTable(admin)
    .insert({
      sender_pool_id: input.senderPoolId,
      sender_account_id: input.senderAccountId,
      member_status: input.memberStatus ?? "eligible",
      priority_weight: input.priorityWeight ?? 100,
      manual_priority: input.manualPriority ?? 100,
      notes: input.notes?.trim() ?? "",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const { data: sender } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("email_address, display_name")
    .eq("id", input.senderAccountId)
    .maybeSingle()
  const label = maskSenderLabel(
    asString((sender as { email_address?: string } | null)?.email_address),
    asString((sender as { display_name?: string } | null)?.display_name),
  )
  return { ...mapMember(data as Record<string, unknown>, label), senderEmail: label }
}

export async function removeSenderPoolMember(admin: SupabaseClient, memberId: string): Promise<void> {
  const { error } = await membersTable(admin).delete().eq("id", memberId)
  if (error) throw new Error(error.message)
}

export async function touchSenderPoolMemberSelection(admin: SupabaseClient, memberId: string): Promise<void> {
  const now = new Date().toISOString()
  await membersTable(admin)
    .update({ last_selected_at: now, updated_at: now })
    .eq("id", memberId)
}

export async function createSenderRotationDecision(
  admin: SupabaseClient,
  input: {
    senderPoolId: string
    sequenceExecutionJobId?: string | null
    deliveryAttemptId?: string | null
    selectedSenderAccountId: string | null
    selectedProviderId?: string | null
    selectedRouteId?: string | null
    decisionReason: GrowthSenderRotationDecisionReason
    riskLevel: GrowthSenderRotationRiskLevel
    allowAutoRotation: boolean
    fallbackCandidates: GrowthSenderRotationFallbackCandidate[]
  },
): Promise<GrowthSenderRotationDecision> {
  const { data, error } = await decisionsTable(admin)
    .insert({
      sender_pool_id: input.senderPoolId,
      sequence_execution_job_id: input.sequenceExecutionJobId ?? null,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      selected_sender_account_id: input.selectedSenderAccountId,
      selected_provider_id: input.selectedProviderId ?? null,
      selected_route_id: input.selectedRouteId ?? null,
      decision_reason: input.decisionReason,
      risk_level: input.riskLevel,
      allow_auto_rotation: input.allowAutoRotation,
      fallback_candidates: input.fallbackCandidates,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const pool = await getSenderPool(admin, input.senderPoolId)
  let senderLabel: string | null = null
  if (input.selectedSenderAccountId) {
    const { data: sender } = await admin
      .schema("growth")
      .from("sender_accounts")
      .select("email_address, display_name")
      .eq("id", input.selectedSenderAccountId)
      .maybeSingle()
    senderLabel = maskSenderLabel(
      asString((sender as { email_address?: string } | null)?.email_address),
      asString((sender as { display_name?: string } | null)?.display_name),
    )
  }

  return {
    id: asString((data as Record<string, unknown>).id),
    senderPoolId: input.senderPoolId,
    senderPoolName: pool?.name ?? "Pool",
    sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
    deliveryAttemptId: input.deliveryAttemptId ?? null,
    selectedSenderAccountId: input.selectedSenderAccountId,
    selectedSenderLabel: senderLabel,
    selectedProviderId: input.selectedProviderId ?? null,
    selectedRouteId: input.selectedRouteId ?? null,
    decisionReason: input.decisionReason,
    riskLevel: input.riskLevel,
    allowAutoRotation: input.allowAutoRotation,
    fallbackCandidates: input.fallbackCandidates,
    createdAt: asString((data as Record<string, unknown>).created_at),
  }
}

export async function listSenderRotationDecisions(
  admin: SupabaseClient,
  input?: { poolId?: string; limit?: number },
): Promise<GrowthSenderRotationDecision[]> {
  let query = decisionsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.poolId) query = query.eq("sender_pool_id", input.poolId)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const pools = new Map((await listSenderPools(admin)).map((pool) => [pool.id, pool.name]))
  const rows = (data ?? []) as Record<string, unknown>[]
  const result: GrowthSenderRotationDecision[] = []
  for (const row of rows) {
    const senderId = asString(row.selected_sender_account_id) || null
    let senderLabel: string | null = null
    if (senderId) {
      const { data: sender } = await admin
        .schema("growth")
        .from("sender_accounts")
        .select("email_address, display_name")
        .eq("id", senderId)
        .maybeSingle()
      senderLabel = maskSenderLabel(
        asString((sender as { email_address?: string } | null)?.email_address),
        asString((sender as { display_name?: string } | null)?.display_name),
      )
    }
    const poolId = asString(row.sender_pool_id)
    result.push({
      id: asString(row.id),
      senderPoolId: poolId,
      senderPoolName: pools.get(poolId) ?? "Pool",
      sequenceExecutionJobId: asString(row.sequence_execution_job_id) || null,
      deliveryAttemptId: asString(row.delivery_attempt_id) || null,
      selectedSenderAccountId: senderId,
      selectedSenderLabel: senderLabel,
      selectedProviderId: asString(row.selected_provider_id) || null,
      selectedRouteId: asString(row.selected_route_id) || null,
      decisionReason: asString(row.decision_reason) as GrowthSenderRotationDecisionReason,
      riskLevel: asString(row.risk_level) as GrowthSenderRotationRiskLevel,
      allowAutoRotation: row.allow_auto_rotation !== false,
      fallbackCandidates: Array.isArray(row.fallback_candidates)
        ? (row.fallback_candidates as GrowthSenderRotationFallbackCandidate[])
        : [],
      createdAt: asString(row.created_at),
    })
  }
  return result
}

export async function recordSenderFatigueEvent(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    senderPoolId?: string | null
    fatigueType: GrowthSenderFatigueType
    severity: "low" | "medium" | "high" | "critical"
    title: string
    description: string
    signals?: Record<string, unknown>
  },
): Promise<void> {
  await fatigueTable(admin).insert({
    sender_account_id: input.senderAccountId,
    sender_pool_id: input.senderPoolId ?? null,
    fatigue_type: input.fatigueType,
    severity: input.severity,
    title: input.title.slice(0, 200),
    description: input.description.slice(0, 1000),
    signals: input.signals ?? {},
  })
}

export async function listSenderFatigueEvents(
  admin: SupabaseClient,
  input?: { poolId?: string; limit?: number },
): Promise<GrowthSenderFatigueEvent[]> {
  let query = fatigueTable(admin)
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 50)
  if (input?.poolId) query = query.eq("sender_pool_id", input.poolId)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const pools = new Map((await listSenderPools(admin)).map((pool) => [pool.id, pool.name]))
  const rows = (data ?? []) as Record<string, unknown>[]
  const result: GrowthSenderFatigueEvent[] = []
  for (const row of rows) {
    const senderId = asString(row.sender_account_id)
    const { data: sender } = await admin
      .schema("growth")
      .from("sender_accounts")
      .select("email_address, display_name")
      .eq("id", senderId)
      .maybeSingle()
    const poolId = asString(row.sender_pool_id) || null
    result.push({
      id: asString(row.id),
      senderAccountId: senderId,
      senderLabel: maskSenderLabel(
        asString((sender as { email_address?: string } | null)?.email_address),
        asString((sender as { display_name?: string } | null)?.display_name),
      ),
      senderPoolId: poolId,
      senderPoolName: poolId ? pools.get(poolId) ?? null : null,
      fatigueType: asString(row.fatigue_type) as GrowthSenderFatigueType,
      severity: asString(row.severity) as GrowthSenderFatigueEvent["severity"],
      title: asString(row.title),
      description: asString(row.description),
      resolved: Boolean(row.resolved),
      createdAt: asString(row.created_at),
    })
  }
  return result
}

export async function recordSenderPoolPerformanceSnapshot(
  admin: SupabaseClient,
  input: {
    senderPoolId: string
    eligibleMembers: number
    cooldownMembers: number
    fatigueWarnings: number
    averageReputation: number
    rotationHealthScore: number
  },
): Promise<GrowthSenderPoolPerformanceSnapshot> {
  const now = new Date().toISOString()
  const { data, error } = await snapshotsTable(admin)
    .insert({
      sender_pool_id: input.senderPoolId,
      eligible_members: input.eligibleMembers,
      cooldown_members: input.cooldownMembers,
      fatigue_warnings: input.fatigueWarnings,
      average_reputation: input.averageReputation,
      rotation_health_score: input.rotationHealthScore,
      recorded_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const pool = await getSenderPool(admin, input.senderPoolId)
  return {
    id: asString((data as Record<string, unknown>).id),
    senderPoolId: input.senderPoolId,
    senderPoolName: pool?.name ?? "Pool",
    eligibleMembers: input.eligibleMembers,
    cooldownMembers: input.cooldownMembers,
    fatigueWarnings: input.fatigueWarnings,
    averageReputation: input.averageReputation,
    rotationHealthScore: input.rotationHealthScore,
    recordedAt: now,
  }
}

export async function listSenderPoolPerformanceSnapshots(
  admin: SupabaseClient,
  input?: { poolId?: string; limit?: number },
): Promise<GrowthSenderPoolPerformanceSnapshot[]> {
  let query = snapshotsTable(admin)
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(input?.limit ?? 30)
  if (input?.poolId) query = query.eq("sender_pool_id", input.poolId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const pools = new Map((await listSenderPools(admin)).map((pool) => [pool.id, pool.name]))
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: asString(row.id),
    senderPoolId: asString(row.sender_pool_id),
    senderPoolName: pools.get(asString(row.sender_pool_id)) ?? "Pool",
    eligibleMembers: asNumber(row.eligible_members),
    cooldownMembers: asNumber(row.cooldown_members),
    fatigueWarnings: asNumber(row.fatigue_warnings),
    averageReputation: asNumber(row.average_reputation),
    rotationHealthScore: asNumber(row.rotation_health_score),
    recordedAt: asString(row.recorded_at),
  }))
}
