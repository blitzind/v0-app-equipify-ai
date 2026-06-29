/** Today's Action Queue on Growth Command Center — promoted for SDR-2A daily work queue. */

export {
  GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER,
  type DailyRevenueWorkQueue,
  type WorkQueueItem,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"

export { buildDailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-engine"

export const GROWTH_COMMAND_CENTER_DAILY_ACTION_QUEUE_QA_MARKER =
  "growth-command-center-daily-action-queue-v1" as const
