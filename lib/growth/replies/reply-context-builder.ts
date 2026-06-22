import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthAiCopilotInput } from "@/lib/growth/ai-copilot-input"
import { resolveGrowthAiCopilotPlaybookRules } from "@/lib/growth/ai-copilot-playbook-resolver"
import { resolveOutreachLeadIndustryTags } from "@/lib/growth/outreach/personalization/context-packet-builder"
import { fetchGrowthCopilotSettings } from "@/lib/growth/ai-copilot-repository"
import { getInboxThread } from "@/lib/growth/inbox/thread-repository"
import { fetchInboxThreadSyncDetail } from "@/lib/growth/inbox-sync/inbox-sync-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import type { GrowthReplyDraftContext, GrowthReplyDraftType } from "@/lib/growth/replies/reply-draft-types"
import { resolveReplyDraftTypeFromClassification } from "@/lib/growth/replies/reply-draft-types"

function truncate(value: string, max = 240): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

export async function buildReplyDraftContext(
  admin: SupabaseClient,
  input: { inboxThreadId: string; draftType?: GrowthReplyDraftType },
): Promise<
  | {
      ok: true
      context: GrowthReplyDraftContext
      leadId: string
      inboxMessageId: string | null
      sequenceEnrollmentId: string | null
      recipientEmail: string | null
      threadStatus: string
    }
  | { ok: false; code: string; message: string }
> {
  const thread = await getInboxThread(admin, input.inboxThreadId, true)
  if (!thread) return { ok: false, code: "thread_not_found", message: "Inbox thread not found." }

  const lead = await fetchGrowthLeadById(admin, thread.lead_id)
  if (!lead) return { ok: false, code: "lead_not_found", message: "Lead not found." }

  const inbound = (thread.messages ?? []).find((message) => message.direction === "inbound")
  if (!inbound) {
    return { ok: false, code: "no_inbound_message", message: "Thread has no inbound message context." }
  }

  const [emailSummary, syncDetail, copilotInput, settings, memory] = await Promise.all([
    fetchGrowthLeadEmailEventSummary(admin, lead.id, lead.contactEmail),
    fetchInboxThreadSyncDetail(admin, thread.id).catch(() => null),
    buildGrowthAiCopilotInput(admin, lead),
    fetchGrowthCopilotSettings(admin),
    buildLeadMemoryInfluenceContext(admin, lead.id),
  ])

  const complianceFlags: string[] = []
  if (emailSummary.suppressed) complianceFlags.push("suppressed")
  if (emailSummary.unsubscribed) complianceFlags.push("unsubscribed")
  if (emailSummary.complaint) complianceFlags.push("complaint")
  if (emailSummary.hardBounce) complianceFlags.push("hard_bounce")

  let playbookInfluence: string[] = []
  if (settings.aiCopilotPlaybookEnabled) {
    const leadIndustryTags = await resolveOutreachLeadIndustryTags(admin, lead)
    const rules = await resolveGrowthAiCopilotPlaybookRules(admin, {
      generationType: "response_draft",
      maxRules: settings.aiCopilotPlaybookMaxRulesPerGeneration,
      leadIndustryTags,
    })
    playbookInfluence = rules.rules.slice(0, 5).map((rule) => truncate(rule.rule_text, 80))
  }

  const draftType = input.draftType ?? resolveReplyDraftTypeFromClassification(thread.classification)
  const marketSignals = (copilotInput.topGrowthSignals ?? [])
    .slice(0, 3)
    .map((signal) => truncate(`${signal.signalType}: ${signal.evidence}`, 80))

  return {
    ok: true,
    leadId: lead.id,
    inboxMessageId: inbound.id,
    sequenceEnrollmentId: syncDetail?.sequenceEnrollmentId ?? null,
    recipientEmail: lead.contactEmail,
    threadStatus: thread.thread_status,
    context: {
      companyLabel: truncate(lead.companyName ?? "Company", 80),
      contactLabel: truncate(lead.contactName ?? "Contact", 80),
      threadSubject: truncate(thread.subject || inbound.subject || "Follow up", 120),
      inboundPreview: truncate(inbound.body_preview, 240),
      classification: thread.classification,
      engagementSummary: truncate(lead.engagementSummary ?? "", 160),
      complianceFlags,
      sequenceActive: Boolean(syncDetail?.sequenceEnrollmentId),
      playbookInfluence,
      marketSignals,
      draftType,
      relationshipMemory: {
        available: memory.available,
        relationshipStage: memory.relationshipStage,
        relationshipSummary: memory.relationshipSummary,
        topObjections: memory.topObjections,
        topPreferences: memory.topPreferences,
        priorInteractions: memory.priorInteractionSummaries,
        commitments: memory.commitmentSummaries,
        avoidRepeatingTopics: memory.avoidRepeating,
      },
    },
  }
}

export function buildReplyDraftSnapshotOverrides(context: GrowthReplyDraftContext): Record<string, unknown> {
  return {
    replyPreview: context.inboundPreview,
    threadSubject: context.threadSubject,
    draftType: context.draftType,
    complianceFlags: context.complianceFlags,
    playbookInfluence: context.playbookInfluence,
    marketSignals: context.marketSignals,
    relationshipMemory: context.relationshipMemory,
  }
}
