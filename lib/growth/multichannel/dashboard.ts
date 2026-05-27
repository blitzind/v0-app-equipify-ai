import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listChannelRoutingRules,
  listChannelTaskEvents,
  listSequenceChannelTasks,
} from "@/lib/growth/multichannel/channel-events"
import { listChannelPerformanceSnapshots } from "@/lib/growth/multichannel/channel-performance"
import {
  GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER,
  isFuturePlaceholderChannel,
  type GrowthMultichannelDashboard,
} from "@/lib/growth/multichannel/multichannel-types"

export async function fetchGrowthMultichannelDashboard(
  admin: SupabaseClient,
  input?: { leadId?: string },
): Promise<GrowthMultichannelDashboard> {
  const [taskQueue, channelPerformance, routingRules, recentEvents] = await Promise.all([
    listSequenceChannelTasks(admin, { leadId: input?.leadId, limit: 100 }),
    listChannelPerformanceSnapshots(admin, { leadId: input?.leadId, limit: 50 }),
    listChannelRoutingRules(admin),
    listChannelTaskEvents(admin, { leadId: input?.leadId, limit: 30 }),
  ])

  const dueStatuses = new Set(["pending", "approved", "in_progress"])
  const channelTasksDue = taskQueue.filter((task) => dueStatuses.has(task.status)).length
  const emailSteps = taskQueue.filter((task) => task.channel === "email").length
  const callTasks = taskQueue.filter((task) => task.channel === "manual_call").length
  const linkedinManualTasks = taskQueue.filter((task) => task.channel === "linkedin_manual").length
  const bookingFollowups = taskQueue.filter((task) => task.channel === "booking_followup").length
  const blockedFutureChannels = taskQueue.filter(
    (task) => isFuturePlaceholderChannel(task.channel) || task.status === "blocked",
  ).length

  return {
    qa_marker: GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER,
    channelTasksDue,
    emailSteps,
    callTasks,
    linkedinManualTasks,
    bookingFollowups,
    blockedFutureChannels,
    taskQueue: taskQueue.slice(0, 50),
    channelPerformance: channelPerformance.slice(0, 30),
    routingRules,
    recentEvents,
  }
}
