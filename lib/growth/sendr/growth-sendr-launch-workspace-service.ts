import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthAudiences } from "@/lib/growth/audiences/growth-audience-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { listSenderProfiles } from "@/lib/growth/signatures/sender-profile-repository"
import { listSendrAssetPickerItems } from "@/lib/growth/sendr/growth-sendr-asset-picker-service"
import { listRecentSendrLaunchRuns } from "@/lib/growth/sendr/growth-sendr-launch-run-repository"
import type { GrowthSendrLaunchWorkspaceSummary } from "@/lib/growth/sendr/growth-sendr-types"

export async function getSendrLaunchWorkspaceSummary(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<GrowthSendrLaunchWorkspaceSummary> {
  const [audiencesResult, pageItems, patterns, recentLaunches, senderProfiles] = await Promise.all([
    listGrowthAudiences(admin, { organizationId: input.organizationId, limit: 50 }),
    listSendrAssetPickerItems(admin, {
      organizationId: input.organizationId,
      kind: "landing_page",
      limit: 50,
    }),
    listGrowthSequencePatterns(admin),
    listRecentSendrLaunchRuns(admin, { organizationId: input.organizationId, limit: 10 }),
    listSenderProfiles(admin),
  ])

  const publishedPages = pageItems
    .filter((item) => item.status === "published")
    .map((item) => ({
      id: item.id,
      title: item.name,
      slug: typeof item.metadata.publishedSlug === "string" ? item.metadata.publishedSlug : null,
      publishedAt: typeof item.metadata.publishedAt === "string" ? item.metadata.publishedAt : null,
    }))

  return {
    audiences: audiencesResult.items.map((audience) => ({
      id: audience.id,
      name: audience.name,
      memberCount: audience.memberCount ?? null,
      lastSnapshotId: audience.lastSnapshotId,
    })),
    publishedPages,
    sequencePatterns: patterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.label,
      channelMix: pattern.patternKind,
    })),
    senderProfiles: senderProfiles
      .filter((profile) => profile.active)
      .map((profile) => ({
        id: profile.id,
        senderAccountId: profile.sender_account_id,
        displayName: profile.display_name,
        title: profile.title,
        email: profile.email,
      })),
    recentLaunches,
  }
}
