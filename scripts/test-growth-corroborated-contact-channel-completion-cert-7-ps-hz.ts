/**
 * Phase 7.PS-HZ-RUNTIME — Corroborated contact channel completion certification.
 * Run: pnpm test:growth-corroborated-contact-channel-completion-cert-7-ps-hz
 */
import { execSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { evaluateCorroboratedContactChannelCompletionCertification } from "../lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-certification"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_CERT_7_PS_HZ_RUNTIME_QA_MARKER =
  "growth-corroborated-contact-channel-completion-cert-7-ps-hz-runtime-v1" as const

function runFollowupCert(script: string): { ok: boolean; output: string } {
  try {
    const output = execSync(
      `NODE_OPTIONS='--require ./scripts/shim-server-only.cjs' pnpm ${script}`,
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 600_000,
      },
    )
    return { ok: true, output }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      output: `${err.stdout ?? ""}\n${err.stderr ?? ""}\n${err.message ?? ""}`.trim(),
    }
  }
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { runCorroboratedContactChannelCompletion },
    { loadPersonCommitteeDensityExpansionCohort },
    { GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_RUNTIME_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-expansion"),
    import("../lib/growth/graph-expansion/person-committee-density-expansion"),
    import("../lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-types"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluateCorroboratedContactChannelCompletionCertification()

  const cohort = await loadPersonCommitteeDensityExpansionCohort(admin, {
    include_anchors: true,
    limit: 20,
  })

  const expansion = await runCorroboratedContactChannelCompletion(admin, { cohort })

  const outreach_contacts_increased =
    expansion.after.outreach_ready_contacts > expansion.before.outreach_ready_contacts
  const outreach_companies_increased =
    expansion.after.outreach_ready_companies > expansion.before.outreach_ready_companies
  const verified_channel_gained = expansion.metrics.persons_with_new_verified_channel > 0

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    compliance.no_invented_emails &&
    compliance.no_provider_bypasses &&
    compliance.no_threshold_lowering &&
    verified_channel_gained &&
    (expansion.metrics.emails_verified > 0 ||
      expansion.metrics.phones_verified > 0 ||
      expansion.metrics.social_profiles_verified > 0)
  ) {
    certification = "PASS"
  } else if (
    expansion.metrics.corroborated_persons_processed > 0 &&
    (expansion.metrics.emails_discovered > 0 ||
      expansion.metrics.phones_discovered > 0 ||
      expansion.metrics.social_profiles_discovered > 0 ||
      expansion.metrics.emails_promoted > 0 ||
      expansion.metrics.phones_promoted > 0 ||
      expansion.metrics.social_profiles_promoted > 0 ||
      expansion.runtime_context.email_execution_path === "deployed_runtime")
  ) {
    certification = "PASS_PARTIAL"
  } else if (expansion.targets.length > 0) {
    certification = "PASS_PARTIAL"
  }

  const channel_promotion_occurred =
    verified_channel_gained ||
    outreach_contacts_increased ||
    outreach_companies_increased

  const followup_certs: Record<string, { ran: boolean; ok: boolean; excerpt: string }> = {}

  if (channel_promotion_occurred) {
    const psHl = runFollowupCert("test:growth-prospect-search-outreach-readiness-cert-7-ps-hl")
    followup_certs.ps_hl = {
      ran: true,
      ok: psHl.ok,
      excerpt: psHl.output.slice(-1200),
    }
  }

  const remaining_blockers = [
    ...(!verified_channel_gained ? ["no_corroborated_person_gained_verified_channel"] : []),
    ...(!outreach_contacts_increased ? ["outreach_ready_contacts_unchanged"] : []),
    ...(!outreach_companies_increased ? ["outreach_ready_companies_unchanged"] : []),
    ...(expansion.metrics.emails_verified === 0 && expansion.metrics.phones_verified === 0
      ? ["no_verified_email_or_phone_through_gates"]
      : []),
    ...(expansion.targets.length === 0 ? ["no_ps_hy_corroborated_persons_loaded"] : []),
    ...(expansion.runtime_context.email_execution_path === "unavailable"
      ? ["email_runtime_path_unavailable"]
      : []),
  ]

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_CERT_7_PS_HZ_RUNTIME_QA_MARKER,
        certification,
        compliance,
        cohort_size: cohort.length,
        corroborated_persons_processed: expansion.metrics.corroborated_persons_processed,
        runtime_path_used: expansion.runtime_context.email_execution_path,
        runtime_context: expansion.runtime_context,
        emails_discovered: expansion.metrics.emails_discovered,
        emails_verified: expansion.metrics.emails_verified,
        emails_promoted: expansion.metrics.emails_promoted,
        phones_discovered: expansion.metrics.phones_discovered,
        phones_verified: expansion.metrics.phones_verified,
        phones_promoted: expansion.metrics.phones_promoted,
        social_profiles_discovered: expansion.metrics.social_profiles_discovered,
        social_profiles_verified: expansion.metrics.social_profiles_verified,
        social_profiles_promoted: expansion.metrics.social_profiles_promoted,
        verified_channels_promoted: expansion.metrics.verified_channels_promoted,
        persons_with_new_verified_channel: expansion.metrics.persons_with_new_verified_channel,
        outreach_ready_contacts: {
          before: expansion.before.outreach_ready_contacts,
          after: expansion.after.outreach_ready_contacts,
          delta: expansion.after.outreach_ready_contacts - expansion.before.outreach_ready_contacts,
        },
        outreach_ready_companies: {
          before: expansion.before.outreach_ready_companies,
          after: expansion.after.outreach_ready_companies,
          delta:
            expansion.after.outreach_ready_companies - expansion.before.outreach_ready_companies,
        },
        verified_channels: {
          emails_before: expansion.before.verified_emails,
          emails_after: expansion.after.verified_emails,
          phones_before: expansion.before.verified_phones,
          phones_after: expansion.after.verified_phones,
          profiles_before: expansion.before.verified_profiles,
          profiles_after: expansion.after.verified_profiles,
        },
        person_results: expansion.person_results,
        expansion_messages: expansion.messages,
        expansion_qa_marker: GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_RUNTIME_QA_MARKER,
        followup_certs,
        remaining_blockers,
      },
      null,
      2,
    ),
  )

  process.exit(certification === "FAIL" ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
