/** LE-1 synthetic fixtures for CI — client-safe. */

import { buildApolloLivePilotAi3ApprovedEvidence } from "@/lib/growth/apollo/apollo-live-pilot-fixture"
import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  LE_1_MANUAL_ENROLLMENT_EVIDENCE_QA_MARKER,
  LE_1_NON_VOICE_CHANNEL_EVIDENCE_QA_MARKER,
  LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER,
  type Le1ManualEnrollmentEvidence,
  type Le1NonVoiceChannelEvidence,
  type Le1VoiceDropLiveEvidence,
} from "@/lib/growth/live-execution/le-1-evidence-types"

export const LE_1_FIXTURE_QA_MARKER = "le-1-fixture-v1" as const

export function buildLe1ApolloLiveEvidence(): ApolloLivePilotEvidence {
  return {
    ...buildApolloLivePilotAi3ApprovedEvidence(),
    contact_ids: {
      candidate_ids: ["cccccccc-cccc-4ccc-8ccc-ccccccccccc1"],
      company_contact_ids: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
      canonical_person_ids: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
    },
  }
}

export function buildLe1ManualEnrollmentEvidence(
  overrides?: Partial<Le1ManualEnrollmentEvidence>,
): Le1ManualEnrollmentEvidence {
  return {
    qa_marker: LE_1_MANUAL_ENROLLMENT_EVIDENCE_QA_MARKER,
    enrolled_at: "2026-06-09T12:00:00.000Z",
    lead_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    enrollment_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    pattern_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    company_candidate_id: "22222222-2222-4222-8222-222222222222",
    canonical_person_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    operator_approved: true,
    bulk_enrollment: false,
    contacts_enrolled: 1,
    ...overrides,
  }
}

export function buildLe1NonVoiceChannelEvidence(
  overrides?: Partial<Le1NonVoiceChannelEvidence>,
): Le1NonVoiceChannelEvidence {
  return {
    qa_marker: LE_1_NON_VOICE_CHANNEL_EVIDENCE_QA_MARKER,
    validated_at: "2026-06-09T12:30:00.000Z",
    lead_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    enrollment_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email_job_created: true,
    email_execution_job_id: "gggggggg-gggg-4ggg-8ggg-gggggggggggg",
    sms_eligibility_evaluated: true,
    sms_eligible: true,
    approval_workflow_verified: true,
    timeline_event_emitted: true,
    timeline_event_ids: ["hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh"],
    channel_event_ids: ["iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii"],
    send_executed: false,
    ...overrides,
  }
}

export function buildLe1VoiceDropLiveEvidence(
  overrides?: Partial<Le1VoiceDropLiveEvidence>,
): Le1VoiceDropLiveEvidence {
  return {
    qa_marker: LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER,
    validated_at: "2026-06-09T13:00:00.000Z",
    callSid: "CA1234567890abcdef1234567890abcdef",
    recipientId: "jjjjjjjj-jjjj-4jjj-8jjj-jjjjjjjjjjjj",
    deliveryAttemptId: "kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk",
    enrollmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    campaignId: "llllllll-llll-4lll-8lll-llllllllllll",
    leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    timelineEventIds: ["hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh"],
    channelEventIds: ["iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii"],
    amd_detected: true,
    twiml_playback_confirmed: true,
    status_callback_received: true,
    delivery_status: "delivered",
    ...overrides,
  }
}
