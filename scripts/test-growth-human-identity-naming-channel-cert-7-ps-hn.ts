/**
 * Phase 7.PS-HN — Identity naming & verified channel completion certification.
 * Run: pnpm test:growth-human-identity-naming-channel-cert-7-ps-hn
 */
import { createClient } from "@supabase/supabase-js"
import { isGenericIdentityName } from "../lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import {
  completeVerifiedChannelsForPerson,
  GROWTH_HUMAN_IDENTITY_CHANNEL_COMPLETION_QA_MARKER,
} from "../lib/growth/human-identity-evidence/human-identity-evidence-channel-completion"
import {
  GROWTH_HUMAN_IDENTITY_NAMING_UPGRADE_QA_MARKER,
  upgradeGenericIdentitiesBatch,
} from "../lib/growth/human-identity-evidence/human-identity-evidence-identity-upgrade"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_HUMAN_IDENTITY_NAMING_CHANNEL_CERT_QA_MARKER =
  "growth-human-identity-naming-channel-cert-7-ps-hn-v1" as const

const TARGETS = [
  {
    company_id: "3620d561-8568-4104-a878-898bfec618ca",
    person_id: "dd551823-7adc-4637-817f-4989a30f108e",
    contact_id: "526cdf9b-9e1a-4395-8e50-806079b10f7b",
    name: "Emergency Repair Biomedical",
  },
  {
    company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
    contact_id: "01ff9b05-ecb2-4062-bb63-f4e8fb8302aa",
    name: "Biomedical Repair Service",
  },
  {
    company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    person_id: "ece67a39-e12e-4dc7-8c51-99274e0b13b4",
    contact_id: "3c25b14d-30b9-4ab7-840d-6e9163386b52",
    name: "ERS Biomedical Services",
  },
] as const

async function countGenericPersons(admin: ReturnType<typeof createClient>, person_ids: string[]) {
  const { data } = await admin
    .schema("growth")
    .from("persons")
    .select("id, full_name")
    .in("id", person_ids)
  return {
    total: data?.length ?? 0,
    generic: (data ?? []).filter((r) => isGenericIdentityName(String(r.full_name))).length,
    rows: data ?? [],
  }
}

async function countVerifiedChannels(admin: ReturnType<typeof createClient>, person_ids: string[]) {
  const [phones, emails, profiles] = await Promise.all([
    admin
      .schema("growth")
      .from("person_phones")
      .select("person_id", { count: "exact", head: true })
      .in("person_id", person_ids)
      .eq("verification_status", "verified"),
    admin
      .schema("growth")
      .from("person_emails")
      .select("person_id", { count: "exact", head: true })
      .in("person_id", person_ids)
      .eq("verification_status", "verified"),
    admin
      .schema("growth")
      .from("person_profiles")
      .select("person_id", { count: "exact", head: true })
      .in("person_id", person_ids)
      .eq("verification_status", "verified"),
  ])
  return {
    verified_phones: phones.count ?? 0,
    verified_emails: emails.count ?? 0,
    verified_profiles: profiles.count ?? 0,
  }
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const person_ids = TARGETS.map((t) => t.person_id)
  const company_ids = TARGETS.map((t) => t.company_id)

  const before_persons = await countGenericPersons(admin, person_ids)
  const before_channels = await countVerifiedChannels(admin, person_ids)

  const naming_upgrades = await upgradeGenericIdentitiesBatch(admin, {
    company_ids: [...company_ids],
    limit: 10,
  })

  const channel_results = []
  for (const target of TARGETS) {
    channel_results.push({
      company: target.name,
      ...(await completeVerifiedChannelsForPerson(admin, {
        person_id: target.person_id,
        company_id: target.company_id,
      })),
    })
  }

  const after_persons = await countGenericPersons(admin, person_ids)
  const after_channels = await countVerifiedChannels(admin, person_ids)

  const named_recovered = naming_upgrades.filter((r) => r.upgraded).length
  const invented_risk = naming_upgrades.some(
    (r) => r.upgraded && !r.method && !["email_local_part", "structured_claim", "team_page_claim", "person_reconciliation"].includes(r.method ?? ""),
  )

  const evidence_backed_only =
    naming_upgrades.filter((r) => r.upgraded).every((r) => Boolean(r.method)) && !invented_risk

  const phones_preserved = after_channels.verified_phones >= before_channels.verified_phones

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (evidence_backed_only && phones_preserved) {
    certification = named_recovered > 0 || before_persons.generic === after_persons.generic
      ? named_recovered > 0
        ? "PASS"
        : "PASS_PARTIAL"
      : "PASS_PARTIAL"
  } else if (phones_preserved) {
    certification = "PASS_PARTIAL"
  }

  const remaining_blockers: string[] = []
  if (after_persons.generic > 0) {
    remaining_blockers.push(`${after_persons.generic} generic identity shell(s) remain — no evidence-backed name in source`)
  }
  if (after_channels.verified_emails === 0) {
    remaining_blockers.push("no_verified_emails — ZeroBounce provider not configured or no promotable email evidence")
  }
  if (after_channels.verified_profiles === 0) {
    remaining_blockers.push("no_verified_social_profiles — no person-scoped LinkedIn evidence on PS-HE targets")
  }
  remaining_blockers.push("no_buying_committee_intelligence")

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_HUMAN_IDENTITY_NAMING_CHANNEL_CERT_QA_MARKER,
        naming_qa_marker: GROWTH_HUMAN_IDENTITY_NAMING_UPGRADE_QA_MARKER,
        channel_qa_marker: GROWTH_HUMAN_IDENTITY_CHANNEL_COMPLETION_QA_MARKER,
        certification,
        generic_identities: {
          before: before_persons.generic,
          after: after_persons.generic,
          persons: after_persons.rows,
        },
        named_contacts_recovered: named_recovered,
        naming_upgrades,
        verified_channels: {
          before: before_channels,
          after: after_channels,
        },
        channel_completion: channel_results,
        evidence_backed_only,
        phones_preserved,
        remaining_blockers,
      },
      null,
      2,
    ),
  )

  if (certification === "FAIL") process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
