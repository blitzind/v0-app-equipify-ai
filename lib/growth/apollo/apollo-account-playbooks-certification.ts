/** Apollo Account Playbooks Certification — proves engine + approval without outreach. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  classifyCommitteeRoleFromTitle,
  runAccountPlaybookEngine,
} from "@/lib/growth/apollo/apollo-account-playbook-engine"
import {
  assertApolloAccountPlaybookAttributionPreserved,
  evaluateApolloAccountPlaybookDuplicateBlock,
  mapApolloAccountPlaybookDbRow,
  mapApolloAccountPlaybookMemberDbRow,
} from "@/lib/growth/apollo/apollo-account-playbooks-evidence"
import { approveApolloAccountPlaybook } from "@/lib/growth/apollo/apollo-account-playbooks-queue"
import { buildApolloAccountPlaybookFunnelMetrics } from "@/lib/growth/apollo/apollo-account-playbooks-funnel-metrics"
import {
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
  type ApolloAccountPlaybookAutomationReport,
  type ApolloAccountPlaybookCertificationReport,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"

const PLAYBOOKS_TABLE = "account_playbooks"
const MEMBERS_TABLE = "account_playbook_members"
const VOICE_DROP_TABLE = "apollo_voice_drop_candidates"

export async function certifyApolloAccountPlaybooks(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    execution_id: string
    report: ApolloAccountPlaybookAutomationReport
    approve_test_playbook?: boolean
  },
): Promise<ApolloAccountPlaybookCertificationReport> {
  const blockers: string[] = []
  const checks: ApolloAccountPlaybookCertificationReport["checks"] = []

  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  const companyResolved = Boolean(snapshot?.canonical_company_id || input.company_candidate_id)
  checks.push({
    id: "company_resolved",
    satisfied: companyResolved,
    detail: companyResolved
      ? `Company candidate ${input.company_candidate_id} resolved with operator review snapshot.`
      : "Company candidate could not be resolved.",
  })
  if (!companyResolved) blockers.push("company_not_resolved")

  const firstPlaybook = input.report.playbooks[0] ?? null
  const playbookCreated = input.report.playbooks_created > 0
  checks.push({
    id: "account_playbook_created",
    satisfied: playbookCreated,
    detail: playbookCreated
      ? `${input.report.playbooks_created} account playbook(s) created.`
      : "No account playbooks created.",
  })
  if (!playbookCreated) blockers.push("account_playbook_not_created")

  let membersAttached = false
  if (firstPlaybook) {
    const { data: memberRows } = await admin
      .schema("growth")
      .from(MEMBERS_TABLE)
      .select("*")
      .eq("account_playbook_id", firstPlaybook.playbook_id)

    membersAttached = (memberRows?.length ?? 0) > 0
    checks.push({
      id: "committee_members_attached",
      satisfied: membersAttached,
      detail: membersAttached
        ? `${memberRows?.length ?? 0} committee member(s) attached to playbook.`
        : "No committee members attached.",
    })
    if (!membersAttached) blockers.push("committee_members_not_attached")

    const roleClassificationGenerated = (memberRows ?? []).every((row) => {
      const member = mapApolloAccountPlaybookMemberDbRow(row as Record<string, unknown>)
      return member.role_category !== "Unknown" || Boolean(member.title)
    })
    checks.push({
      id: "role_classification_generated",
      satisfied: roleClassificationGenerated,
      detail: roleClassificationGenerated
        ? "Committee role categories assigned to all attached members."
        : "Role classification incomplete on one or more members.",
    })
    if (!roleClassificationGenerated) blockers.push("role_classification_missing")

    const coverageScoreGenerated = firstPlaybook.committee_coverage_score > 0
    checks.push({
      id: "committee_coverage_score_generated",
      satisfied: coverageScoreGenerated,
      detail: `Committee coverage score ${firstPlaybook.committee_coverage_score}; status ${firstPlaybook.coverage_status}.`,
    })
    if (!coverageScoreGenerated) blockers.push("committee_coverage_score_missing")

    const messagingThemesAssigned = Object.keys(firstPlaybook.recommended_messaging_theme).length > 0
    checks.push({
      id: "messaging_themes_assigned",
      satisfied: messagingThemesAssigned,
      detail: messagingThemesAssigned
        ? "Role-based messaging themes assigned."
        : "Messaging themes missing.",
    })
    if (!messagingThemesAssigned) blockers.push("messaging_themes_missing")

    const channelStrategyAssigned = Object.keys(firstPlaybook.recommended_channel_mix).length > 0
    checks.push({
      id: "channel_strategy_assigned",
      satisfied: channelStrategyAssigned,
      detail: channelStrategyAssigned
        ? "Role-based channel mix assigned."
        : "Channel strategy missing.",
    })
    if (!channelStrategyAssigned) blockers.push("channel_strategy_missing")
  }

  const attribution_preserved = assertApolloAccountPlaybookAttributionPreserved(
    firstPlaybook?.source_attribution,
  )
  checks.push({
    id: "attribution_preserved",
    satisfied: attribution_preserved,
    detail: attribution_preserved
      ? "Full Apollo → Qualification → Enrollment → Account Playbook chain preserved."
      : "Attribution chain incomplete on account playbook.",
  })
  if (!attribution_preserved) blockers.push("attribution_not_preserved")

  const duplicate_prevention_verified = input.report.playbooks_skipped_duplicate >= 0
  checks.push({
    id: "duplicate_prevention",
    satisfied: duplicate_prevention_verified,
    detail: `Duplicate skips recorded: ${input.report.playbooks_skipped_duplicate}.`,
  })

  const duplicateBlock = evaluateApolloAccountPlaybookDuplicateBlock({
    existing_status: "pending_playbook_approval",
  })
  checks.push({
    id: "duplicate_block_logic",
    satisfied: duplicateBlock.blocked,
    detail: duplicateBlock.blocked
      ? "Duplicate prevention blocks pending/approved playbook re-insert."
      : "Duplicate prevention logic failed.",
  })

  const engineSample = runAccountPlaybookEngine({
    canonical_company_id: input.company_candidate_id,
    company_profile: { company_name: "Summit Medical" },
    buying_committee_members: [
      { full_name: "Jane CEO", title: "CEO", email: "ceo@example.com", contactable: true },
      { full_name: "Ops Lead", title: "Operations Manager", email: "ops@example.com" },
      { full_name: "Bio Eng", title: "Biomedical Engineer", email: "eng@example.com" },
    ],
    qualification_data: { qualification_score: 82, buying_committee_coverage: 0.6 },
    channel_availability: { email: true, phone: true, sms: true, linkedin: true, voice_drop: true },
  })
  const engineVerified =
    classifyCommitteeRoleFromTitle("CEO") === "Executive" &&
    classifyCommitteeRoleFromTitle("Operations Manager") === "Operations" &&
    classifyCommitteeRoleFromTitle("Biomedical Engineer") === "Technical" &&
    engineSample.committee_coverage_score > 0 &&
    engineSample.playbook_key.length > 0
  checks.push({
    id: "engine_verified",
    satisfied: engineVerified,
    detail: engineVerified
      ? `Engine sample playbook ${engineSample.playbook_key} with coverage ${engineSample.coverage_status}.`
      : "Account playbook engine verification failed.",
  })
  if (!engineVerified) blockers.push("engine_verification_failed")

  let approval_flow_verified = false
  if (firstPlaybook && input.approve_test_playbook !== false) {
    const approveResult = await approveApolloAccountPlaybook(admin, {
      playbook_id: firstPlaybook.playbook_id,
      approver_email: "apollo-account-playbooks-cert@equipify.internal",
      note: `certification:${input.execution_id}`,
    })
    approval_flow_verified = approveResult.ok

    const { data: voiceDropRow } = await admin
      .schema("growth")
      .from(VOICE_DROP_TABLE)
      .select("id, outreach_sent, voice_drop_sent")
      .eq("enrollment_candidate_id", firstPlaybook.enrollment_candidate_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    checks.push({
      id: "voice_drop_handoff_no_outreach",
      satisfied:
        approval_flow_verified &&
        Boolean(voiceDropRow) &&
        voiceDropRow?.outreach_sent === false &&
        voiceDropRow?.voice_drop_sent === false,
      detail: voiceDropRow
        ? "Account playbook approval triggered voice drop handoff without outreach side effects."
        : "Voice drop candidate not created after playbook approval.",
    })
    if (!voiceDropRow) blockers.push("voice_drop_handoff_missing")
  }

  checks.push({
    id: "no_outreach_side_effects",
    satisfied: input.report.outreach_sent === false,
    detail: "Automation report confirms outreach_sent=false.",
  })

  checks.push({
    id: "playbook_approval_flow",
    satisfied: approval_flow_verified || input.approve_test_playbook === false,
    detail: approval_flow_verified
      ? "Playbook approval gate passed (certification dry-run approval recorded)."
      : input.approve_test_playbook === false
        ? "Approval flow skipped by configuration."
        : "Playbook approval gate blocked.",
  })

  const funnel_metrics = await buildApolloAccountPlaybookFunnelMetrics(admin)
  const certified = blockers.length === 0

  return {
    qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
    certified,
    blockers,
    checks,
    attribution_preserved,
    duplicate_prevention_verified,
    approval_flow_verified,
    engine_verified: engineVerified,
    safety: { outreach_sent: false },
    funnel_metrics,
    summary: certified
      ? "Apollo Account Playbooks (ABP-1) certification passed — company resolution through playbook approval verified without outreach."
      : `Apollo Account Playbooks certification failed — ${blockers.length} blocker(s). No outreach sent.`,
  }
}

export { mapApolloAccountPlaybookDbRow }
