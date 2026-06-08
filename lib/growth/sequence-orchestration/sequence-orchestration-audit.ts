/** Growth Engine Phase 5.4A — Multi-channel sequence architecture audit (client-safe). */

export const GROWTH_MULTI_CHANNEL_SEQUENCE_ORCHESTRATION_QA_MARKER =
  "growth-multi-channel-sequence-orchestration-v1" as const

export const SEQUENCE_EMAIL_ONLY_ASSUMPTIONS = [
  "isCadenceEmailChannel — only email treated as transport; SMS routed to manual cadence",
  "sequence-send-builder — step.channel !== email returns unsupported_channel",
  "sequence-job-runner — executeTransportSend email-only path",
  "queueSequenceStepTransportJob — AI copilot generation email-only for pending steps",
  "isDraftReadyEmailSchedulerStep — draft-ready gating email-only",
  "sequence_execution_jobs — no channel column (email implied)",
  "fetchGrowthSequenceTouchTimeline — outreach_queue + calls; no SMS delivery touches",
  "sms_task cadence — manual copy/paste SMS, not Twilio transport",
] as const

export const MULTI_CHANNEL_MIGRATION_PLAN = [
  "Add sms + voice_drop + call to sequence step channel constraints",
  "Add channel, sms_draft_body, sms_to_e164, voice_drop_campaign_id on sequence_execution_jobs",
  "Create sequence_enrollment_channel_events for unified timeline",
  "Introduce isSequenceTransportChannel(email | sms | voice_drop) for scheduler/worker",
  "SMS steps: buildPersonalizedSmsDraft → pending_approval job → sendSms after approval",
  "Voice drop steps: approved campaign → pending_approval job → certified Twilio provider after approval",
  "Call steps: cadence task + call queue href — no auto-dial",
  "Rule-based channel selection at step advance (no AI)",
] as const

export type GrowthMultiChannelSequenceArchitectureAudit = {
  qa_marker: typeof GROWTH_MULTI_CHANNEL_SEQUENCE_ORCHESTRATION_QA_MARKER
  emailOnlyAssumptions: readonly string[]
  migrationPlan: readonly string[]
  architectureMap: {
    scheduler: string
    transport: string
    cadence: string
    state: string
    rules: string
    timeline: string
  }
}

export function buildGrowthMultiChannelSequenceArchitectureAudit(): GrowthMultiChannelSequenceArchitectureAudit {
  return {
    qa_marker: GROWTH_MULTI_CHANNEL_SEQUENCE_ORCHESTRATION_QA_MARKER,
    emailOnlyAssumptions: SEQUENCE_EMAIL_ONLY_ASSUMPTIONS,
    migrationPlan: MULTI_CHANNEL_MIGRATION_PLAN,
    architectureMap: {
      scheduler:
        "runGrowthSequenceScheduler → isSequenceTransportChannel(email|sms|voice_drop) → transport job | cadence task(call)",
      transport:
        "queueSequenceStepTransportJob → email: AI draft + execution job | sms: SMS personalization + execution job | voice_drop: campaign link + execution job",
      cadence: "createCadenceTaskFromEnrollmentStep → manual_call/call → call queue href, operator completes",
      state: "sequence_enrollment_channel_events + fetchGrowthSequenceTouchTimeline",
      rules: "evaluateSequenceChannelSelectionRules — deterministic skip/pause/advance hints",
      timeline: "recordSequenceEnrollmentChannelEvent on send, call complete, reply",
    },
  }
}
