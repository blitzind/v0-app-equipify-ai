import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthDomainSenderMapping } from "@/lib/growth/deliverability/deliverability-intelligence-types"
import { listSenderAccounts, listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { listSenderPoolMembers, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"

function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? ""
}

export async function buildDomainSenderMappings(admin: SupabaseClient): Promise<GrowthDomainSenderMapping[]> {
  const [domains, senders, pools] = await Promise.all([
    listSenderDomains(admin),
    listSenderAccounts(admin),
    listSenderPools(admin),
  ])

  const poolMembersNested = await Promise.all(pools.map((pool) => listSenderPoolMembers(admin, pool.id)))
  const senderPoolMap = new Map<string, string[]>()
  for (let i = 0; i < pools.length; i += 1) {
    for (const member of poolMembersNested[i] ?? []) {
      const labels = senderPoolMap.get(member.senderAccountId) ?? []
      labels.push(pools[i].name)
      senderPoolMap.set(member.senderAccountId, labels)
    }
  }

  return domains.map((domain) => {
    const domainSenders = senders.filter((s) => extractDomain(s.email_address) === domain.domain.toLowerCase())
    const poolsUsed = new Set<string>()
    const senderEmails: string[] = []

    for (const sender of domainSenders) {
      senderEmails.push(sender.email_address)
      for (const poolName of senderPoolMap.get(sender.id) ?? []) {
        poolsUsed.add(poolName)
      }
    }

    let concentrationRisk: GrowthDomainSenderMapping["concentrationRisk"] = "low"
    if (domainSenders.length >= 8 || poolsUsed.size === 1 && domainSenders.length >= 4) {
      concentrationRisk = "high"
    } else if (domainSenders.length >= 4) {
      concentrationRisk = "medium"
    }

    return {
      domain: domain.domain,
      domainId: domain.id,
      senderCount: domainSenders.length,
      poolCount: poolsUsed.size,
      senders: senderEmails,
      pools: [...poolsUsed],
      concentrationRisk,
    }
  })
}
